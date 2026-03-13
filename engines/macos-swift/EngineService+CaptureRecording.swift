import Capture
import CoreGraphics
import EngineProtocol
import Foundation
import InputTracking
import Project

extension EngineService {
    private func resolveCaptureFrameRate(from params: [String: JSONValue]) -> Int? {
        let frameRate = params["captureFps"]?.intValue ?? CaptureFrameRatePolicy.defaultValue
        guard CaptureFrameRatePolicy.isSupported(frameRate) else {
            return nil
        }
        return frameRate
    }

    private func captureFrameRateValidationMessage() -> String {
        let supportedValues = CaptureFrameRatePolicy.supportedValues
            .map(String.init)
            .joined(separator: ", ")
        return "captureFps must be one of \(supportedValues)"
    }

    private func captureStartFailureResponse(id: String, error: Error) -> EngineResponse {
        if case .unsupportedCaptureFrameRate = error as? CaptureError {
            return .failure(id: id, code: "invalid_params", message: error.localizedDescription)
        }
        return .failure(id: id, code: "runtime_error", message: error.localizedDescription)
    }

    private func telemetryPayload(
        from telemetry: CaptureEngine.CaptureTelemetrySnapshot
    ) -> JSONValue {
        .object([
            "sourceDroppedFrames": .number(Double(telemetry.sourceDroppedFrames)),
            "writerDroppedFrames": .number(Double(telemetry.writerDroppedFrames)),
            "writerBackpressureDrops": .number(Double(telemetry.writerBackpressureDrops)),
            "achievedFps": .number(telemetry.achievedFps),
            "cpuPercent": telemetry.cpuPercent.map { .number($0) } ?? .null,
            "memoryBytes": telemetry.memoryBytes.map { .number(Double($0)) } ?? .null,
            "recordingBitrateMbps": telemetry.recordingBitrateMbps.map { .number($0) } ?? .null,
            "captureCallbackMs": .number(telemetry.captureCallbackMs),
            "recordQueueLagMs": .number(telemetry.recordQueueLagMs),
            "writerAppendMs": .number(telemetry.writerAppendMs)
        ])
    }

    func startDisplayResponse(id: String, params: [String: JSONValue]) async -> EngineResponse {
        let enableMic = params["enableMic"]?.boolValue ?? false
        guard let captureFps = resolveCaptureFrameRate(from: params) else {
            return .failure(
                id: id,
                code: "invalid_params",
                message: captureFrameRateValidationMessage()
            )
        }
        do {
            try await captureEngine.startDisplayCapture(enableMic: enableMic, targetFrameRate: captureFps)
            return captureStatusResponse(id: id)
        } catch {
            return captureStartFailureResponse(id: id, error: error)
        }
    }

    func startWindowResponse(id: String, params: [String: JSONValue]) async -> EngineResponse {
        guard let windowID = params["windowId"]?.intValue else {
            return .failure(id: id, code: "invalid_params", message: "windowId is required")
        }
        let enableMic = params["enableMic"]?.boolValue ?? false
        guard let captureFps = resolveCaptureFrameRate(from: params) else {
            return .failure(
                id: id,
                code: "invalid_params",
                message: captureFrameRateValidationMessage()
            )
        }

        do {
            if windowID == 0 {
                if #available(macOS 14.0, *) {
                    try await captureEngine.startCaptureUsingPicker(
                        enableMic: enableMic,
                        targetFrameRate: captureFps
                    )
                } else {
                    return .failure(
                        id: id,
                        code: "invalid_params",
                        message: "windowId must be greater than 0 on macOS 13"
                    )
                }
            } else {
                try await captureEngine.startWindowCapture(
                    windowID: CGWindowID(windowID),
                    enableMic: enableMic,
                    targetFrameRate: captureFps
                )
            }
            return captureStatusResponse(id: id)
        } catch {
            return captureStartFailureResponse(id: id, error: error)
        }
    }

    func startCurrentWindowResponse(id: String, params: [String: JSONValue]) async -> EngineResponse {
        let enableMic = params["enableMic"]?.boolValue ?? false
        guard let captureFps = resolveCaptureFrameRate(from: params) else {
            return .failure(
                id: id,
                code: "invalid_params",
                message: captureFrameRateValidationMessage()
            )
        }

        do {
            try await captureEngine.startCurrentWindowCapture(
                enableMic: enableMic,
                targetFrameRate: captureFps
            )
            return captureStatusResponse(id: id)
        } catch {
            return captureStartFailureResponse(id: id, error: error)
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
            try await captureEngine.startRecording()
            currentEventsURL = nil
            currentProjectDocument.eventsFileName = nil

            trackInputEventsWhileRecording = false
            if shouldTrackInputEvents, inputPermissionManager.status() == .authorized {
                trackInputEventsWhileRecording = true
                let referenceTime = CaptureClock().now().seconds
                await MainActor.run {
                    inputSession.start(referenceTime: referenceTime)
                }
            }
            if let descriptor = captureEngine.captureDescriptor {
                currentProjectDocument.project.captureMetadata = makeCaptureMetadata(from: descriptor)
            }
            hasUnsavedProjectChanges = true
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
        hasUnsavedProjectChanges = true

        return captureStatusResponse(id: id)
    }

    func stopInputTrackingIfNeeded() async {
        guard trackInputEventsWhileRecording else { return }
        trackInputEventsWhileRecording = false

        let result = await MainActor.run {
            inputSession.stop()
        }

        guard !result.log.events.isEmpty else { return }

        let eventsURL = makeEventsURL()
        try? result.log.write(to: eventsURL)
        try? InputTrackingMetricsStore(metrics: result.metrics).write(to: makeEventsMetricsURL(for: eventsURL))
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

    func makeEventsMetricsURL(for eventsURL: URL) -> URL {
        let baseName = eventsURL.deletingPathExtension().lastPathComponent
        return eventsURL.deletingLastPathComponent()
            .appendingPathComponent("\(baseName).stats.json")
    }

    func captureStatusResponse(id: String) -> EngineResponse {
        let recordingDurationSeconds = captureEngine.recordingDuration
        let telemetry = captureEngine.telemetrySnapshot()
        let captureMetadataPayload: JSONValue
        if let descriptor = captureEngine.captureDescriptor {
            let metadata = makeCaptureMetadata(from: descriptor)
            captureMetadataPayload = captureMetadataJSON(from: metadata)
        } else {
            captureMetadataPayload = .null
        }

        return .success(
            id: id,
            result: .object([
                "isRunning": .bool(captureEngine.isRunning),
                "isRecording": .bool(captureEngine.isRecording),
                "recordingDurationSeconds": .number(recordingDurationSeconds),
                "recordingURL": captureEngine.recordingURL.map { .string($0.path) } ?? .null,
                "captureMetadata": captureMetadataPayload,
                "lastError": captureEngine.lastError.map { .string($0) } ?? .null,
                "eventsURL": currentEventsURL.map { .string($0.path) } ?? .null,
                "telemetry": telemetryPayload(from: telemetry)
            ])
        )
    }
}
