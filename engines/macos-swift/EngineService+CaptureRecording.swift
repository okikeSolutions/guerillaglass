import Capture
import CoreGraphics
import EngineProtocol
import Foundation
import Project

extension EngineService {
    func startDisplayResponse(id: String, params: [String: JSONValue]) async -> EngineResponse {
        let enableMic = params["enableMic"]?.boolValue ?? false
        do {
            try await captureEngine.startDisplayCapture(enableMic: enableMic)
            return captureStatusResponse(id: id)
        } catch {
            return .failure(id: id, code: "runtime_error", message: error.localizedDescription)
        }
    }

    func startWindowResponse(id: String, params: [String: JSONValue]) async -> EngineResponse {
        guard let windowID = params["windowId"]?.intValue else {
            return .failure(id: id, code: "invalid_params", message: "windowId is required")
        }
        let enableMic = params["enableMic"]?.boolValue ?? false

        do {
            try await captureEngine.startWindowCapture(windowID: CGWindowID(windowID), enableMic: enableMic)
            return captureStatusResponse(id: id)
        } catch {
            return .failure(id: id, code: "runtime_error", message: error.localizedDescription)
        }
    }

    func stopCaptureResponse(id: String) async -> EngineResponse {
        await captureEngine.stopCapture()
        await stopInputTrackingIfNeeded()
        return captureStatusResponse(id: id)
    }

    func startRecordingResponse(id: String, params: [String: JSONValue]) async -> EngineResponse {
        let shouldTrackInputEvents = params["trackInputEvents"]?.boolValue ?? false

        do {
            if !captureEngine.isRunning {
                try await captureEngine.startDisplayCapture(enableMic: false)
            }
            try await captureEngine.startRecording()
            trackInputEventsWhileRecording = shouldTrackInputEvents
            if shouldTrackInputEvents {
                let referenceTime = CaptureClock().now().seconds
                await MainActor.run {
                    inputSession.start(referenceTime: referenceTime)
                }
            }
            if let descriptor = captureEngine.captureDescriptor {
                currentProjectDocument.project.captureMetadata = makeCaptureMetadata(from: descriptor)
            }
            return captureStatusResponse(id: id)
        } catch {
            return .failure(id: id, code: "runtime_error", message: error.localizedDescription)
        }
    }

    func stopRecordingResponse(id: String) async -> EngineResponse {
        await captureEngine.stopRecording()
        await stopInputTrackingIfNeeded()

        if let recordingURL = captureEngine.recordingURL {
            currentProjectDocument.recordingFileName = recordingURL.lastPathComponent
        }

        return captureStatusResponse(id: id)
    }

    func stopInputTrackingIfNeeded() async {
        guard trackInputEventsWhileRecording else { return }
        trackInputEventsWhileRecording = false

        let log = await MainActor.run {
            inputSession.stop()
        }
        guard !log.events.isEmpty else { return }

        let eventsURL = makeEventsURL()
        try? log.write(to: eventsURL)
        currentEventsURL = eventsURL
        currentProjectDocument.eventsFileName = ProjectFile.eventsJSON
    }

    func makeEventsURL() -> URL {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withDashSeparatorInDate, .withColonSeparatorInTime]
        let timestamp = formatter.string(from: Date())
        return FileManager.default.temporaryDirectory
            .appendingPathComponent("guerillaglass-events-\(timestamp).json")
    }

    func captureStatusResponse(id: String) -> EngineResponse {
        .success(
            id: id,
            result: .object([
                "isRunning": .bool(captureEngine.isRunning),
                "isRecording": .bool(captureEngine.isRecording),
                "recordingDurationSeconds": .number(captureEngine.recordingDuration),
                "recordingURL": captureEngine.recordingURL.map { .string($0.path) } ?? .null,
                "lastError": captureEngine.lastError.map { .string($0) } ?? .null,
                "eventsURL": currentEventsURL.map { .string($0.path) } ?? .null
            ])
        )
    }
}
