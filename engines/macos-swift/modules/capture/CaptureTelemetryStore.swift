import CoreMedia
import Foundation

final class CaptureTelemetryStore {
    enum WriterAppendOutcome {
        case appended
        case droppedBackpressure
        case droppedWriterState
        case failed
    }

    private let queue = DispatchQueue(label: "gg.capture.telemetry")
    private let runtimeTelemetryMonitor = CaptureRuntimeTelemetryMonitor()
    private var state = State()

    func snapshot(
        recordingOutputURL: URL? = nil,
        recordingDurationSeconds: Double = 0,
        isCaptureActive: Bool = false
    ) -> CaptureEngine.CaptureTelemetrySnapshot {
        queue.sync {
            if isCaptureActive {
                let runtime = runtimeTelemetryMonitor.sample(
                    recordingOutputURL: recordingOutputURL,
                    recordingDurationSeconds: recordingDurationSeconds
                )
                state.cpuPercent = runtime.cpuPercent
                state.memoryBytes = runtime.memoryBytes
                state.recordingBitrateMbps = runtime.recordingBitrateMbps
            } else {
                runtimeTelemetryMonitor.reset()
                state.cpuPercent = nil
                state.memoryBytes = nil
                state.recordingBitrateMbps = nil
            }
            return CaptureEngine.CaptureTelemetrySnapshot(
                sourceDroppedFrames: state.sourceDroppedFrames,
                writerDroppedFrames: state.writerDroppedFrames,
                writerBackpressureDrops: state.writerBackpressureDrops,
                achievedFps: state.achievedFps,
                cpuPercent: state.cpuPercent,
                memoryBytes: state.memoryBytes,
                recordingBitrateMbps: state.recordingBitrateMbps,
                captureCallbackMs: state.captureCallbackMetric.value,
                recordQueueLagMs: state.recordQueueLagMetric.value,
                writerAppendMs: state.writerAppendMetric.value,
                previewEncodeMs: state.previewEncodeMetric.value
            )
        }
    }

    func reset() {
        queue.sync {
            runtimeTelemetryMonitor.reset()
            state = State()
        }
    }

    func recordSourceStatusDrop() {
        queue.async {
            self.state.sourceStatusDroppedFrames += 1
        }
    }

    func recordCompleteFrame(presentationTimestamp: CMTime, captureFrameRate: Int) {
        let expectedFrameIntervalSeconds = 1.0 / Double(max(1, captureFrameRate))
        queue.async {
            self.state.completeFrames += 1
            guard presentationTimestamp.isNumeric else { return }

            let ptsSeconds = presentationTimestamp.seconds
            if let previousPTS = self.state.lastCompleteFramePTSSeconds {
                let deltaSeconds = max(0, ptsSeconds - previousPTS)
                let missedFrames = CaptureTelemetryMath.estimateMissedFrames(
                    deltaSeconds: deltaSeconds,
                    expectedFrameIntervalSeconds: expectedFrameIntervalSeconds
                )
                self.state.sourceTimingDroppedFrames += missedFrames
            } else {
                self.state.firstCompleteFramePTSSeconds = ptsSeconds
            }
            self.state.lastCompleteFramePTSSeconds = ptsSeconds
        }
    }

    func recordCaptureCallbackDuration(_ durationMs: Double) {
        queue.async {
            self.state.captureCallbackMetric.record(durationMs)
        }
    }

    func recordRecordQueueLag(_ lagMs: Double) {
        queue.async {
            self.state.recordQueueLagMetric.record(lagMs)
        }
    }

    func recordWriterAppendSample(
        outcome: WriterAppendOutcome,
        appendDurationMs: Double
    ) {
        queue.async {
            self.state.writerAppendMetric.record(appendDurationMs)
            switch outcome {
            case .droppedBackpressure:
                self.state.writerBackpressureDrops += 1
            case .failed:
                self.state.writerFailedDrops += 1
            case .droppedWriterState, .appended:
                break
            }
        }
    }

    func recordPreviewEncodeDuration(_ durationMs: Double) {
        queue.async {
            self.state.previewEncodeMetric.record(durationMs)
        }
    }
}

private extension CaptureTelemetryStore {
    struct TimingMetric {
        private(set) var smoothedValueMs: Double?
        private let smoothingFactor: Double

        init(smoothingFactor: Double) {
            self.smoothingFactor = smoothingFactor
        }

        var value: Double {
            smoothedValueMs ?? 0
        }

        mutating func record(_ rawValueMs: Double) {
            let clampedValue = max(0, rawValueMs)
            if let smoothedValueMs {
                self.smoothedValueMs =
                    smoothedValueMs + (clampedValue - smoothedValueMs) * smoothingFactor
            } else {
                smoothedValueMs = clampedValue
            }
        }
    }

    struct State {
        var completeFrames: Int = 0
        var sourceStatusDroppedFrames: Int = 0
        var sourceTimingDroppedFrames: Int = 0
        var writerBackpressureDrops: Int = 0
        var writerFailedDrops: Int = 0
        var cpuPercent: Double?
        var memoryBytes: UInt64?
        var recordingBitrateMbps: Double?
        var firstCompleteFramePTSSeconds: Double?
        var lastCompleteFramePTSSeconds: Double?
        var captureCallbackMetric = TimingMetric(smoothingFactor: 0.2)
        var recordQueueLagMetric = TimingMetric(smoothingFactor: 0.2)
        var writerAppendMetric = TimingMetric(smoothingFactor: 0.18)
        var previewEncodeMetric = TimingMetric(smoothingFactor: 0.18)

        var sourceDroppedFrames: Int {
            sourceStatusDroppedFrames + sourceTimingDroppedFrames
        }

        var writerDroppedFrames: Int {
            writerBackpressureDrops + writerFailedDrops
        }

        var achievedFps: Double {
            CaptureTelemetryMath.achievedFramesPerSecond(
                frameCount: completeFrames,
                firstPTSSeconds: firstCompleteFramePTSSeconds,
                lastPTSSeconds: lastCompleteFramePTSSeconds
            )
        }
    }
}
