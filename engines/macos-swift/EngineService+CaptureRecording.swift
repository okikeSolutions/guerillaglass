import Capture
import CoreGraphics
import EngineProtocol
import Foundation
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

    private func telemetryHealthInput(
        from telemetry: CaptureEngine.CaptureTelemetrySnapshot
    ) -> CaptureTelemetryHealthInput {
        CaptureTelemetryHealthInput(
            totalFrames: telemetry.totalFrames,
            droppedFramePercent: telemetry.droppedFramePercent,
            sourceDroppedFramePercent: telemetry.sourceDroppedFramePercent,
            writerDroppedFramePercent: telemetry.writerDroppedFramePercent,
            audioLevelDbfs: telemetry.audioLevelDbfs,
            lastError: captureEngine.lastError,
            isRecording: captureEngine.isRecording
        )
    }

    private func telemetryPayload(
        from telemetry: CaptureEngine.CaptureTelemetrySnapshot,
        health: CaptureTelemetryHealth
    ) -> JSONValue {
        .object([
            "totalFrames": .number(Double(telemetry.totalFrames)),
            "droppedFrames": .number(Double(telemetry.droppedFrames)),
            "droppedFramePercent": .number(telemetry.droppedFramePercent),
            "sourceDroppedFrames": .number(Double(telemetry.sourceDroppedFrames)),
            "sourceDroppedFramePercent": .number(telemetry.sourceDroppedFramePercent),
            "writerDroppedFrames": .number(Double(telemetry.writerDroppedFrames)),
            "writerBackpressureDrops": .number(Double(telemetry.writerBackpressureDrops)),
            "writerDroppedFramePercent": .number(telemetry.writerDroppedFramePercent),
            "achievedFps": .number(telemetry.achievedFps),
            "cpuPercent": telemetry.cpuPercent.map { .number($0) } ?? .null,
            "memoryBytes": telemetry.memoryBytes.map { .number(Double($0)) } ?? .null,
            "recordingBitrateMbps": telemetry.recordingBitrateMbps.map { .number($0) } ?? .null,
            "audioLevelDbfs": telemetry.audioLevelDbfs.map { .number($0) } ?? .null,
            "health": .string(health.state.rawValue),
            "healthReason": health.reason.map { .string($0.rawValue) } ?? .null
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
            return .failure(id: id, code: "runtime_error", message: error.localizedDescription)
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
            return .failure(id: id, code: "runtime_error", message: error.localizedDescription)
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
        let recordingDurationSeconds = captureEngine.recordingDuration
        let telemetry = captureEngine.telemetrySnapshot()
        let health = CaptureTelemetryHealthEvaluator.evaluate(
            telemetryHealthInput(from: telemetry)
        )
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
                "telemetry": telemetryPayload(from: telemetry, health: health)
            ])
        )
    }
}
