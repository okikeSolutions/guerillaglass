import CoreMedia
import Export
import ScreenCaptureKit

extension CaptureEngine {
    public func telemetrySnapshot() -> CaptureTelemetrySnapshot {
        let recordingOutputURL = activeRecordingOutputURL() ?? recordingURL
        return telemetryStore.snapshot(
            recordingOutputURL: recordingOutputURL,
            recordingDurationSeconds: recordingDuration,
            isCaptureActive: isRunning || isRecording
        )
    }

    func resetTelemetry() {
        telemetryStore.reset()
    }

    func recordVideoSample(status: SCFrameStatus?, sampleBuffer: CMSampleBuffer) {
        if let status, status != .complete {
            telemetryStore.recordSourceStatusDrop()
            return
        }

        telemetryStore.recordCompleteFrame(
            presentationTimestamp: CMSampleBufferGetPresentationTimeStamp(sampleBuffer),
            captureFrameRate: captureFrameRate
        )
    }

    func recordWriterAppendOutcome(_ outcome: AssetWriter.VideoAppendOutcome) {
        let mappedOutcome: CaptureTelemetryStore.WriterAppendOutcome = switch outcome {
        case .appended:
            .appended
        case .droppedBackpressure:
            .droppedBackpressure
        case .droppedWriterState:
            .droppedWriterState
        case .failed:
            .failed
        }

        telemetryStore.recordWriterAppendOutcome(mappedOutcome)
    }

    func recordAudioLevel(_ level: Double?) {
        telemetryStore.recordAudioLevel(level)
    }
}
