import Capture
import CoreGraphics
import EngineProtocol
import Foundation

extension EngineService {
    private func resolvedFrameRate(_ value: Double?) -> Int? {
        let frameRate = Int(value ?? Double(CaptureFrameRatePolicy.defaultValue))
        return CaptureFrameRatePolicy.isSupported(frameRate) ? frameRate : nil
    }

    private func frameRateError() -> Components.Schemas.EngineBadRequestError {
        badRequest(
            .invalid_params,
            "captureFps must be one of \(CaptureFrameRatePolicy.supportedValues.map(String.init).joined(separator: ", "))"
        )
    }

    func capture_period_captureStartDisplay(
        _ input: Operations.capture_period_captureStartDisplay.Input
    ) async throws -> Operations.capture_period_captureStartDisplay.Output {
        let payload: Components.Schemas.CaptureStartDisplayPayload = switch input.body { case let .json(body): body }
        guard let fps = resolvedFrameRate(payload.captureFps) else {
            return .badRequest(.init(body: .json(frameRateError())))
        }
        do {
            try await captureEngine.startDisplayCapture(
                displayID: payload.displayId.map { CGDirectDisplayID($0.value1) },
                enableMic: payload.enableMic ?? false,
                targetFrameRate: fps,
                enablePreview: payload.enablePreview ?? true
            )
            return .ok(.init(body: .json(captureStatus())))
        } catch {
            return .badRequest(.init(body: .json(badRequest(.invalid_request, error.localizedDescription))))
        }
    }

    func capture_period_captureStartCurrentWindow(
        _ input: Operations.capture_period_captureStartCurrentWindow.Input
    ) async throws -> Operations.capture_period_captureStartCurrentWindow.Output {
        let payload: Components.Schemas.CaptureStartCurrentWindowPayload = switch input.body { case let .json(body): body }
        guard let fps = resolvedFrameRate(payload.captureFps) else {
            return .badRequest(.init(body: .json(frameRateError())))
        }
        do {
            try await captureEngine.startCurrentWindowCapture(
                enableMic: payload.enableMic ?? false,
                targetFrameRate: fps,
                enablePreview: payload.enablePreview ?? true
            )
            return .ok(.init(body: .json(captureStatus())))
        } catch {
            return .badRequest(.init(body: .json(badRequest(.invalid_request, error.localizedDescription))))
        }
    }

    func capture_period_captureStartWindow(
        _ input: Operations.capture_period_captureStartWindow.Input
    ) async throws -> Operations.capture_period_captureStartWindow.Output {
        let payload: Components.Schemas.CaptureStartWindowPayload = switch input.body { case let .json(body): body }
        guard let fps = resolvedFrameRate(payload.captureFps) else {
            return .badRequest(.init(body: .json(frameRateError())))
        }
        let windowId = CGWindowID(payload.windowId.value1)
        do {
            if windowId == 0 {
                try await captureEngine.startCaptureUsingPicker(
                    enableMic: payload.enableMic ?? false,
                    targetFrameRate: fps,
                    enablePreview: payload.enablePreview ?? true
                )
            } else {
                try await captureEngine.startWindowCapture(
                    windowID: windowId,
                    enableMic: payload.enableMic ?? false,
                    targetFrameRate: fps,
                    enablePreview: payload.enablePreview ?? true
                )
            }
            return .ok(.init(body: .json(captureStatus())))
        } catch {
            return .badRequest(.init(body: .json(badRequest(.invalid_request, error.localizedDescription))))
        }
    }

    func capture_period_captureStop(
        _: Operations.capture_period_captureStop.Input
    ) async throws -> Operations.capture_period_captureStop.Output {
        await captureEngine.stopCapture()
        return .ok(.init(body: .json(captureStatus())))
    }

    func capture_period_captureStatus(
        _: Operations.capture_period_captureStatus.Input
    ) async throws -> Operations.capture_period_captureStatus.Output {
        .ok(.init(body: .json(captureStatus())))
    }

    func capture_period_capturePreviewFrame(
        _: Operations.capture_period_capturePreviewFrame.Input
    ) async throws -> Operations.capture_period_capturePreviewFrame.Output {
        let frame = captureEngine.latestPreviewFrame().map {
            Components.Schemas.CapturePreviewFrame(
                frameId: .init(value1: Double($0.frameId)),
                bytesBase64: .init(value1: $0.bytesBase64)
            )
        }
        return .ok(.init(body: .json(.init(frame: frame))))
    }

    func recording_period_recordingStart(
        _: Operations.recording_period_recordingStart.Input
    ) async throws -> Operations.recording_period_recordingStart.Output {
        do {
            try await captureEngine.startRecording()
            return .ok(.init(body: .json(captureStatus())))
        } catch {
            return .badRequest(.init(body: .json(badRequest(.invalid_request, error.localizedDescription))))
        }
    }

    func recording_period_recordingStop(
        _: Operations.recording_period_recordingStop.Input
    ) async throws -> Operations.recording_period_recordingStop.Output {
        await captureEngine.stopRecording()
        return .ok(.init(body: .json(captureStatus())))
    }
}
