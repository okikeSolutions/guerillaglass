import Darwin
import Dispatch
import EngineProtocol
import Foundation
import HTTPTypes
import Hummingbird
import OpenAPIHummingbird
import OpenAPIRuntime

private let maxHTTPBodyBytes: Int64 = 2 * 1024 * 1024

private final class ParentProcessExitMonitor: @unchecked Sendable {
    private let source: DispatchSourceProcess?

    init() {
        let parentProcessID = getppid()

        guard parentProcessID > 1 else {
            FileHandle.standardError.write(
                Data("engine started without a live parent process; shutting down\n".utf8)
            )
            DispatchQueue.global().async {
                kill(getpid(), SIGTERM)
            }
            self.source = nil
            return
        }

        let source = DispatchSource.makeProcessSource(
            identifier: parentProcessID,
            eventMask: .exit,
            queue: .global()
        )
        source.setEventHandler { [parentProcessID] in
            FileHandle.standardError.write(
                Data("engine parent process exited: parent=\(parentProcessID); shutting down\n".utf8)
            )
            kill(getpid(), SIGTERM)
        }
        source.resume()
        self.source = source
    }

    deinit {
        source?.cancel()
    }
}

private let parentProcessExitMonitor = ParentProcessExitMonitor()

extension HTTPField.Name {
    static let secFetchSite = Self("Sec-Fetch-Site")!
}

struct EngineHostOriginGuardMiddleware: ServerMiddleware {
    func intercept(
        _ request: HTTPRequest,
        body: HTTPBody?,
        metadata: ServerRequestMetadata,
        operationID _: String,
        next: @Sendable (HTTPRequest, HTTPBody?, ServerRequestMetadata) async throws -> (HTTPResponse, HTTPBody?)
    ) async throws -> (HTTPResponse, HTTPBody?) {
        guard isAllowedHost(request.authority) else {
            return forbidden("Host header must be loopback.")
        }
        guard isAllowedOrigin(request.headerFields[.origin]) else {
            return forbidden("Origin must be loopback, null, or omitted.")
        }
        guard isAllowedFetchSite(request.headerFields[.secFetchSite]) else {
            return forbidden("Sec-Fetch-Site is not allowed.")
        }
        return try await next(request, body, metadata)
    }

    private func forbidden(_ message: String) -> (HTTPResponse, HTTPBody?) {
        var response = HTTPResponse(status: .forbidden)
        response.headerFields[.contentType] = "application/json; charset=utf-8"
        return (response, HTTPBody(#"{"code":"permission_denied","message":"\#(message)"}"#))
    }

    private func isAllowedHost(_ value: String?) -> Bool {
        guard let value, !value.isEmpty else { return false }
        let host = value.lowercased()
        return host == "localhost" ||
            host.hasPrefix("localhost:") ||
            host == "127.0.0.1" ||
            host.hasPrefix("127.0.0.1:") ||
            host == "[::1]" ||
            host.hasPrefix("[::1]:")
    }

    private func isAllowedOrigin(_ value: String?) -> Bool {
        guard let value, !value.isEmpty else { return true }
        if value == "null" { return true }
        guard let url = URL(string: value), url.scheme == "http" else { return false }
        let host = url.host(percentEncoded: false)?.lowercased()
        return host == "localhost" || host == "127.0.0.1" || host == "::1"
    }

    private func isAllowedFetchSite(_ value: String?) -> Bool {
        guard let value, !value.isEmpty else { return true }
        return value == "same-origin" || value == "same-site" || value == "none"
    }
}

@main
struct GuerillaglassEngineMain {
    static func main() async {
        await MainActor.run {
            EngineApplicationContext.prepareIfNeeded()
        }

        guard ProcessInfo.processInfo.environment["GG_ENGINE_TRANSPORT"] == "http" else {
            FileHandle.standardError.write(Data("engine HTTP transport requires GG_ENGINE_TRANSPORT=http\n".utf8))
            Foundation.exit(1)
        }
        guard let token = ProcessInfo.processInfo.environment["GG_ENGINE_HTTP_AUTH_TOKEN"], !token.isEmpty else {
            FileHandle.standardError.write(Data("engine HTTP transport requires GG_ENGINE_HTTP_AUTH_TOKEN\n".utf8))
            Foundation.exit(1)
        }

        do {
            let service = EngineService()
            let router = Router()
            try service.registerHandlers(
                on: router,
                middlewares: [
                    EngineHostOriginGuardMiddleware(),
                    EngineBodyLimitMiddleware(maxBytes: maxHTTPBodyBytes),
                    EngineBearerAuthMiddleware(token: token)
                ]
            )
            let app = Application(
                router: router,
                configuration: .init(address: .hostname("127.0.0.1", port: 0), serverName: nil),
                onServerRunning: { channel in
                    guard let port = channel.localAddress?.port else { return }
                    print("{\"type\":\"guerillaglass.engine.http.ready\",\"host\":\"127.0.0.1\",\"port\":\(port)}")
                    fflush(stdout)
                }
            )
            _ = parentProcessExitMonitor
            try await app.runService()
        } catch {
            FileHandle.standardError.write(Data("engine HTTP startup failed: \(error)\n".utf8))
            Foundation.exit(1)
        }
    }
}
