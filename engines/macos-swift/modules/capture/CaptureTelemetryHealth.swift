import Foundation

/// Capture health severity levels derived from runtime telemetry.
public enum CaptureTelemetryHealthState: String {
    case good
    case warning
    case critical
}

/// Capture health reason codes used by protocol and UI surfaces.
public enum CaptureTelemetryHealthReason: String {
    case engineError = "engine_error"
    case highDroppedFrameRate = "high_dropped_frame_rate"
    case elevatedDroppedFrameRate = "elevated_dropped_frame_rate"
    case lowMicrophoneLevel = "low_microphone_level"
}

/// Evaluated capture health state plus optional reason.
public struct CaptureTelemetryHealth: Equatable {
    public var state: CaptureTelemetryHealthState
    public var reason: CaptureTelemetryHealthReason?

    public init(
        state: CaptureTelemetryHealthState,
        reason: CaptureTelemetryHealthReason?
    ) {
        self.state = state
        self.reason = reason
    }
}

/// Input fields required to evaluate capture health for a recording session.
public struct CaptureTelemetryHealthInput {
    public let totalFrames: Int
    public let droppedFramePercent: Double
    public let sourceDroppedFramePercent: Double
    public let writerDroppedFramePercent: Double
    public let audioLevelDbfs: Double?
    public let lastError: String?
    public let isRecording: Bool

    public init(
        totalFrames: Int,
        droppedFramePercent: Double,
        sourceDroppedFramePercent: Double,
        writerDroppedFramePercent: Double,
        audioLevelDbfs: Double?,
        lastError: String?,
        isRecording: Bool
    ) {
        self.totalFrames = totalFrames
        self.droppedFramePercent = droppedFramePercent
        self.sourceDroppedFramePercent = sourceDroppedFramePercent
        self.writerDroppedFramePercent = writerDroppedFramePercent
        self.audioLevelDbfs = audioLevelDbfs
        self.lastError = lastError
        self.isRecording = isRecording
    }
}

/// Computes health state from capture telemetry inputs.
public enum CaptureTelemetryHealthEvaluator {
    private static let minimumDroppedFrameSamples = 90

    public static func evaluate(_ input: CaptureTelemetryHealthInput) -> CaptureTelemetryHealth {
        if let lastError = input.lastError, !lastError.isEmpty {
            return CaptureTelemetryHealth(
                state: .critical,
                reason: .engineError
            )
        }

        // Dropped-frame health is only meaningful during an active recording session
        // once enough samples are collected to avoid start-up noise.
        if input.isRecording, input.totalFrames >= minimumDroppedFrameSamples {
            let dominantDroppedFramePercent = max(
                input.droppedFramePercent,
                input.sourceDroppedFramePercent,
                input.writerDroppedFramePercent
            )

            if dominantDroppedFramePercent >= 5 {
                return CaptureTelemetryHealth(
                    state: .critical,
                    reason: .highDroppedFrameRate
                )
            }

            if dominantDroppedFramePercent >= 1 {
                return CaptureTelemetryHealth(
                    state: .warning,
                    reason: .elevatedDroppedFrameRate
                )
            }
        }

        if input.isRecording {
            let audioLevelDbfs = input.audioLevelDbfs ?? .infinity
            if audioLevelDbfs < -45 {
                return CaptureTelemetryHealth(
                    state: .warning,
                    reason: .lowMicrophoneLevel
                )
            }
        }

        return CaptureTelemetryHealth(
            state: .good,
            reason: nil
        )
    }
}
