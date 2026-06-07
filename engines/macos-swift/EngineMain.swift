import EngineProtocol
import Foundation
import Network

actor EngineConnectionWriter {
    private let connection: NWConnection

    init(connection: NWConnection) {
        self.connection = connection
    }

    func writeLine(_ line: String) {
        connection.send(
            content: Data((line + "\n").utf8),
            completion: .contentProcessed { error in
                if let error {
                    FileHandle.standardError.write(Data(("engine socket write failed: \(error)\n").utf8))
                }
            }
        )
    }

    func writeResponse(_ response: EngineResponse) {
        do {
            writeLine(try EngineLineCodec.encodeResponse(response))
        } catch {
            writeLine("{\"type\":\"error\",\"id\":\"\(response.id)\",\"error\":{\"code\":\"runtime_error\",\"message\":\"Failed to encode response\"}}")
        }
    }

    func writeChunk(id: String, value: JSONValue) {
        do {
            writeLine(try EngineLineCodec.encodeChunk(EngineChunkResponse(id: id, values: [value])))
        } catch {
            writeResponse(.failure(id: id, code: "runtime_error", message: "Failed to encode stream chunk"))
        }
    }

    func writePong() {
        writeLine("{\"type\":\"pong\"}")
    }
}

func wireMessageType(from line: String) -> String? {
    guard
        let data = line.data(using: .utf8),
        let raw = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    else {
        return nil
    }
    return raw["type"] as? String
}

func wireMessageId(from line: String) -> String? {
    guard
        let data = line.data(using: .utf8),
        let raw = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
        let id = raw["id"]
    else {
        return nil
    }
    if let stringId = id as? String { return stringId }
    if let intId = id as? Int { return String(intId) }
    if let doubleId = id as? Double { return String(Int(doubleId)) }
    return nil
}

func requestHasExpectedAuthToken(_ line: String) -> Bool {
    guard let expectedToken = ProcessInfo.processInfo.environment["GG_ENGINE_RPC_AUTH_TOKEN"], !expectedToken.isEmpty else {
        return false
    }
    guard
        let data = line.data(using: .utf8),
        let raw = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    else {
        return false
    }
    return raw["authToken"] as? String == expectedToken
}

actor EngineRequestSession {
    private let service: EngineService
    private var activeStreams: [String: Task<Void, Never>] = [:]

    init(service: EngineService) {
        self.service = service
    }

    func stopAllStreams() {
        for stream in activeStreams.values {
            stream.cancel()
        }
        activeStreams.removeAll()
    }

    private func stopStream(id: String) {
        activeStreams.removeValue(forKey: id)?.cancel()
    }

    func handleSocketLine(_ line: String, writer: EngineConnectionWriter) async {
        if wireMessageType(from: line) == "ping" {
            await writer.writePong()
            return
        }
        if wireMessageType(from: line) == "interrupt", let requestId = wireMessageId(from: line) {
            stopStream(id: requestId)
            return
        }

        guard requestHasExpectedAuthToken(line) else {
            await writer.writeResponse(.failure(
                id: "unknown",
                code: "permission_denied",
                message: "Missing or invalid engine socket auth token"
            ))
            return
        }

        guard let request = try? EngineLineCodec.decodeRequest(from: line) else {
            await writer.writeResponse(.failure(
                id: "unknown",
                code: "invalid_request",
                message: "Invalid JSON request"
            ))
            return
        }

        if request.method == "capture.statusStream" || request.method == "capture.previewFrameStream" {
            stopStream(id: request.id)
            activeStreams[request.id] = Task {
                while !Task.isCancelled {
                    let response: EngineResponse = request.method == "capture.statusStream"
                        ? await service.captureStatusResponse(id: request.id)
                        : await service.capturePreviewFrameResponse(id: request.id)
                    await writer.writeChunk(id: request.id, value: response.result ?? .null)
                    try? await Task.sleep(nanoseconds: 250_000_000)
                }
            }
            return
        }

        await writer.writeResponse(await service.handleLine(line))
    }
}

final class EngineSocketStartupContinuation: @unchecked Sendable {
    private let lock = NSLock()
    private var didResume = false
    private let continuation: CheckedContinuation<Void, Error>

    init(_ continuation: CheckedContinuation<Void, Error>) {
        self.continuation = continuation
    }

    func resume() {
        lock.lock()
        defer { lock.unlock() }
        guard !didResume else { return }
        didResume = true
        continuation.resume()
    }

    func resume(throwing error: Error) {
        lock.lock()
        defer { lock.unlock() }
        guard !didResume else { return }
        didResume = true
        continuation.resume(throwing: error)
    }
}

final class EngineSocketServer {
    private let service: EngineService
    private let session: EngineRequestSession
    private let listener: NWListener
    private let queue = DispatchQueue(label: "guerillaglass.engine.socket")
    private let maxFrameBytes = 1024 * 1024
    private var connection: NWConnection?
    private var buffer = Data()

    init(service: EngineService) throws {
        self.service = service
        self.session = EngineRequestSession(service: service)
        let parameters = NWParameters.tcp
        parameters.requiredLocalEndpoint = .hostPort(host: .ipv4(.loopback), port: .any)
        self.listener = try NWListener(using: parameters)
        self.listener.newConnectionLimit = 1
    }

    func start() async throws {
        try await withCheckedThrowingContinuation { continuation in
            let startup = EngineSocketStartupContinuation(continuation)
            listener.stateUpdateHandler = { state in
                switch state {
                case .ready:
                    startup.resume()
                case .failed(let error):
                    startup.resume(throwing: error)
                default:
                    break
                }
            }
            listener.newConnectionHandler = { [weak self] connection in
                self?.accept(connection)
            }
            listener.start(queue: queue)
        }
    }

    var port: UInt16? {
        guard let port = listener.port else { return nil }
        return UInt16(port.debugDescription) ?? port.rawValue.byteSwapped
    }

    private func accept(_ connection: NWConnection) {
        self.connection?.cancel()
        self.connection = connection
        let writer = EngineConnectionWriter(connection: connection)
        connection.stateUpdateHandler = { [weak self] state in
            if case .cancelled = state {
                Task { await self?.session.stopAllStreams() }
            }
        }
        connection.start(queue: queue)
        receiveNext(connection: connection, writer: writer)
    }

    private func receiveNext(connection: NWConnection, writer: EngineConnectionWriter) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 64 * 1024) { [weak self] data, _, isComplete, error in
            guard let self else { return }
            if let error {
                FileHandle.standardError.write(Data(("engine socket read failed: \(error)\n").utf8))
                Task { await self.session.stopAllStreams() }
                return
            }
            if let data, !data.isEmpty {
                self.buffer.append(data)
                if self.buffer.count > self.maxFrameBytes {
                    FileHandle.standardError.write(Data("engine socket frame exceeded maximum size\n".utf8))
                    connection.cancel()
                    Task { await self.session.stopAllStreams() }
                    return
                }
                while let newline = self.buffer.firstIndex(of: 0x0a) {
                    let lineData = self.buffer[..<newline]
                    self.buffer.removeSubrange(...newline)
                    guard let line = String(data: lineData, encoding: .utf8) else {
                        FileHandle.standardError.write(Data("engine socket received invalid UTF-8 frame\n".utf8))
                        connection.cancel()
                        Task { await self.session.stopAllStreams() }
                        return
                    }
                    Task { await self.session.handleSocketLine(line, writer: writer) }
                }
            }
            if isComplete {
                Task { await self.session.stopAllStreams() }
                return
            }
            self.receiveNext(connection: connection, writer: writer)
        }
    }

    func cancel() {
        connection?.cancel()
        listener.cancel()
        Task { await session.stopAllStreams() }
    }
}

@main
struct GuerillaglassEngineMain {
    static func main() async {
        await MainActor.run {
            EngineApplicationContext.prepareIfNeeded()
        }
        let service = EngineService()

        if ProcessInfo.processInfo.environment["GG_ENGINE_RPC_TRANSPORT"] == "socket" {
            do {
                let server = try EngineSocketServer(service: service)
                try await server.start()
                guard let port = server.port else {
                    throw NSError(domain: "GuerillaglassEngine", code: 1, userInfo: [NSLocalizedDescriptionKey: "Missing listener port"])
                }
                print("{\"type\":\"guerillaglass.engine.ready\",\"host\":\"127.0.0.1\",\"port\":\(port)}")
                fflush(stdout)
                while !Task.isCancelled {
                    try? await Task.sleep(nanoseconds: 3_600_000_000_000)
                }
                server.cancel()
            } catch {
                FileHandle.standardError.write(Data(("engine socket startup failed: \(error)\n").utf8))
                Foundation.exit(1)
            }
            return
        }

        FileHandle.standardError.write(Data("engine stdio transport has been removed; set GG_ENGINE_RPC_TRANSPORT=socket\n".utf8))
        Foundation.exit(1)
    }
}
