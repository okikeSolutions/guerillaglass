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
        recordingOutputURL: URL?,
        recordingDurationSeconds: Double,
        isCaptureActive: Bool
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
                totalFrames: state.totalFrames,
                droppedFrames: state.droppedFrames,
                droppedFramePercent: state.droppedFramePercent,
                sourceDroppedFrames: state.sourceDroppedFrames,
                sourceDroppedFramePercent: state.sourceDroppedFramePercent,
                writerDroppedFrames: state.writerDroppedFrames,
                writerBackpressureDrops: state.writerBackpressureDrops,
                writerDroppedFramePercent: state.writerDroppedFramePercent,
                achievedFps: state.achievedFps,
                cpuPercent: state.cpuPercent,
                memoryBytes: state.memoryBytes,
                recordingBitrateMbps: state.recordingBitrateMbps,
                audioLevelDbfs: state.audioLevelDbfs
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

    func recordWriterAppendOutcome(_ outcome: WriterAppendOutcome) {
        queue.async {
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

    func recordAudioLevel(_ level: Double?) {
        guard let level else { return }
        queue.async {
            let smoothingFactor = 0.18
            if let previous = self.state.audioLevelDbfs {
                self.state.audioLevelDbfs = previous + (level - previous) * smoothingFactor
            } else {
                self.state.audioLevelDbfs = level
            }
        }
    }
}

private extension CaptureTelemetryStore {
    struct State {
        var completeFrames: Int = 0
        var sourceStatusDroppedFrames: Int = 0
        var sourceTimingDroppedFrames: Int = 0
        var writerBackpressureDrops: Int = 0
        var writerFailedDrops: Int = 0
        var cpuPercent: Double?
        var memoryBytes: UInt64?
        var recordingBitrateMbps: Double?
        var audioLevelDbfs: Double?
        var firstCompleteFramePTSSeconds: Double?
        var lastCompleteFramePTSSeconds: Double?

        var sourceDroppedFrames: Int {
            sourceStatusDroppedFrames + sourceTimingDroppedFrames
        }

        var writerDroppedFrames: Int {
            writerBackpressureDrops + writerFailedDrops
        }

        var totalFrames: Int {
            completeFrames + sourceDroppedFrames
        }

        var droppedFrames: Int {
            sourceDroppedFrames + writerDroppedFrames
        }

        var droppedFramePercent: Double {
            CaptureTelemetryMath.percentage(
                numerator: droppedFrames,
                denominator: totalFrames
            )
        }

        var sourceDroppedFramePercent: Double {
            CaptureTelemetryMath.percentage(
                numerator: sourceDroppedFrames,
                denominator: totalFrames
            )
        }

        var writerDroppedFramePercent: Double {
            CaptureTelemetryMath.percentage(
                numerator: writerDroppedFrames,
                denominator: totalFrames
            )
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
