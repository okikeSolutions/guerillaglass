import Foundation

public enum CaptureTelemetryHealthState: String {
    case good
    case warning
    case critical
}

public enum CaptureTelemetryHealthReason: String {
    case engineError = "engine_error"
    case highDroppedFrameRate = "high_dropped_frame_rate"
    case elevatedDroppedFrameRate = "elevated_dropped_frame_rate"
    case lowMicrophoneLevel = "low_microphone_level"
}

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

public enum CaptureTelemetryHealthEvaluator {
    public static func evaluate(
        droppedFramePercent: Double,
        audioLevelDbfs: Double?,
        lastError: String?,
        isRecording: Bool
    ) -> CaptureTelemetryHealth {
        if let lastError, !lastError.isEmpty {
            return CaptureTelemetryHealth(
                state: .critical,
                reason: .engineError
            )
        }

        if droppedFramePercent >= 5 {
            return CaptureTelemetryHealth(
                state: .critical,
                reason: .highDroppedFrameRate
            )
        }

        if droppedFramePercent >= 1 {
            return CaptureTelemetryHealth(
                state: .warning,
                reason: .elevatedDroppedFrameRate
            )
        }

        if isRecording, let audioLevelDbfs, audioLevelDbfs < -45 {
            return CaptureTelemetryHealth(
                state: .warning,
                reason: .lowMicrophoneLevel
            )
        }

        return CaptureTelemetryHealth(
            state: .good,
            reason: nil
        )
    }
}
