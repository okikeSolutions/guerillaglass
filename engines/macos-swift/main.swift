import AVFoundation
import Capture
import EngineProtocol
import Foundation
import InputTracking
import ScreenCaptureKit

final class EngineService {
    private let captureEngine = CaptureEngine()
    private let inputPermissionManager = InputPermissionManager()

    func handleLine(_ line: String) async -> EngineResponse {
        do {
            let request = try EngineLineCodec.decodeRequest(from: line)
            return await handle(request)
        } catch {
            return .failure(id: "unknown", code: "invalid_request", message: error.localizedDescription)
        }
    }

    private func handle(_ request: EngineRequest) async -> EngineResponse {
        switch request.method {
        case "system.ping":
            return pingResponse(id: request.id)
        case "permissions.get":
            return permissionsGet(id: request.id)
        case "sources.list":
            return await sourcesListResponse(id: request.id)
        case "capture.startDisplay":
            return await startDisplayResponse(id: request.id, params: request.params)
        case "capture.startWindow":
            return await startWindowResponse(id: request.id, params: request.params)
        case "capture.stop":
            await captureEngine.stopCapture()
            return await captureStatusResponse(id: request.id)
        case "recording.start":
            return await startRecordingResponse(id: request.id)
        case "recording.stop":
            await captureEngine.stopRecording()
            return await captureStatusResponse(id: request.id)
        case "capture.status":
            return await captureStatusResponse(id: request.id)
        default:
            return .failure(
                id: request.id,
                code: "unsupported_method",
                message: "Unsupported method: \(request.method)"
            )
        }
    }

    private func pingResponse(id: String) -> EngineResponse {
        .success(
            id: id,
            result: .object([
                "app": .string("guerillaglass"),
                "engineVersion": .string("0.1.0"),
                "protocolVersion": .string("1"),
                "platform": .string("macOS")
            ])
        )
    }

    private func sourcesListResponse(id: String) async -> EngineResponse {
        do {
            let result = try await listSources()
            return .success(id: id, result: result)
        } catch {
            return .failure(id: id, code: "runtime_error", message: error.localizedDescription)
        }
    }

    private func startDisplayResponse(id: String, params: [String: JSONValue]) async -> EngineResponse {
        let enableMic = params["enableMic"]?.boolValue ?? false
        do {
            try await captureEngine.startDisplayCapture(enableMic: enableMic)
            return await captureStatusResponse(id: id)
        } catch {
            return .failure(id: id, code: "runtime_error", message: error.localizedDescription)
        }
    }

    private func startWindowResponse(id: String, params: [String: JSONValue]) async -> EngineResponse {
        guard let windowID = params["windowId"]?.intValue else {
            return .failure(id: id, code: "invalid_params", message: "windowId is required")
        }
        let enableMic = params["enableMic"]?.boolValue ?? false
        do {
            try await captureEngine.startWindowCapture(windowID: CGWindowID(windowID), enableMic: enableMic)
            return await captureStatusResponse(id: id)
        } catch {
            return .failure(id: id, code: "runtime_error", message: error.localizedDescription)
        }
    }

    private func startRecordingResponse(id: String) async -> EngineResponse {
        do {
            try await captureEngine.startRecording()
            return await captureStatusResponse(id: id)
        } catch {
            return .failure(id: id, code: "runtime_error", message: error.localizedDescription)
        }
    }

    private func permissionsGet(id: String) -> EngineResponse {
        let screenRecordingGranted = CGPreflightScreenCaptureAccess()
        let microphoneStatus = AVCaptureDevice.authorizationStatus(for: .audio)
        let microphoneGranted = microphoneStatus == .authorized

        let inputMonitoring: JSONValue = switch inputPermissionManager.status() {
        case .authorized:
            .string("authorized")
        case .denied:
            .string("denied")
        case .notDetermined:
            .string("notDetermined")
        }

        return .success(
            id: id,
            result: .object([
                "screenRecordingGranted": .bool(screenRecordingGranted),
                "microphoneGranted": .bool(microphoneGranted),
                "inputMonitoring": inputMonitoring
            ])
        )
    }

    private func listSources() async throws -> JSONValue {
        let content = try await SCShareableContent.excludingDesktopWindows(true, onScreenWindowsOnly: true)

        let displays: [JSONValue] = content.displays.map { display in
            .object([
                "id": .number(Double(display.displayID)),
                "width": .number(Double(display.width)),
                "height": .number(Double(display.height))
            ])
        }

        let windows = filteredWindows(from: content.windows)
        let sorted = ShareableWindow.sorted(windows.map(ShareableWindow.init(window:)))
        let encodedWindows: [JSONValue] = sorted.map { window in
            .object([
                "id": .number(Double(window.id)),
                "title": .string(window.title),
                "appName": .string(window.appName),
                "width": .number(window.size.width),
                "height": .number(window.size.height),
                "isOnScreen": .bool(window.isOnScreen)
            ])
        }

        return .object([
            "displays": .array(displays),
            "windows": .array(encodedWindows)
        ])
    }

    private func filteredWindows(from windows: [SCWindow]) -> [SCWindow] {
        windows.filter { window in
            guard window.isOnScreen else { return false }
            guard window.frame.width > 1, window.frame.height > 1 else { return false }
            guard let app = window.owningApplication else { return false }
            let bundleID = app.bundleIdentifier
            if bundleID == "com.apple.WindowServer" || bundleID == "com.apple.dock" {
                return false
            }
            return true
        }
    }

    private func captureStatusResponse(id: String) async -> EngineResponse {
        .success(
            id: id,
            result: .object([
                "isRunning": .bool(captureEngine.isRunning),
                "isRecording": .bool(captureEngine.isRecording),
                "recordingDurationSeconds": .number(captureEngine.recordingDuration),
                "recordingURL": captureEngine.recordingURL.map { .string($0.path) } ?? .null,
                "lastError": captureEngine.lastError.map { .string($0) } ?? .null
            ])
        )
    }
}

@main
struct GuerillaglassEngineMain {
    static func main() async {
        let service = EngineService()

        while let line = readLine() {
            let response = await service.handleLine(line)
            do {
                let encoded = try EngineLineCodec.encodeResponse(response)
                FileHandle.standardOutput.write(Data((encoded + "\n").utf8))
            } catch {
                let fallback = EngineResponse.failure(
                    id: response.id,
                    code: "runtime_error",
                    message: "Failed to encode response: \(error.localizedDescription)"
                )
                if let line = try? EngineLineCodec.encodeResponse(fallback) {
                    FileHandle.standardOutput.write(Data((line + "\n").utf8))
                }
            }
        }
    }
}
