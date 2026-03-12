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

    func recordCaptureCallbackDuration(_ durationMs: Double) {
        telemetryStore.recordCaptureCallbackDuration(durationMs)
    }

    func recordRecordQueueLag(_ lagMs: Double) {
        telemetryStore.recordRecordQueueLag(lagMs)
    }

    func recordWriterAppendSample(_ sample: AssetWriter.VideoAppendSample) {
        let mappedOutcome: CaptureTelemetryStore.WriterAppendOutcome = switch sample.outcome {
        case .appended:
            .appended
        case .droppedBackpressure:
            .droppedBackpressure
        case .droppedWriterState:
            .droppedWriterState
        case .failed:
            .failed
        }

        telemetryStore.recordWriterAppendSample(
            outcome: mappedOutcome,
            appendDurationMs: sample.appendDurationMs
        )
    }
}
