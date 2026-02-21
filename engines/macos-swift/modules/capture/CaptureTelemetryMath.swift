import Foundation

/// Shared telemetry math helpers used by capture health calculations.
public enum CaptureTelemetryMath {
    public static func estimateMissedFrames(
        deltaSeconds: Double,
        expectedFrameIntervalSeconds: Double
    ) -> Int {
        guard deltaSeconds.isFinite,
              expectedFrameIntervalSeconds.isFinite,
              expectedFrameIntervalSeconds > 0
        else {
            return 0
        }

        guard deltaSeconds > expectedFrameIntervalSeconds * 1.5 else {
            return 0
        }

        let estimatedFrames = Int((deltaSeconds / expectedFrameIntervalSeconds).rounded(.down))
        return max(0, estimatedFrames - 1)
    }

    public static func percentage(
        numerator: Int,
        denominator: Int
    ) -> Double {
        guard denominator > 0 else { return 0 }
        return (Double(numerator) / Double(denominator)) * 100
    }

    public static func achievedFramesPerSecond(
        frameCount: Int,
        firstPTSSeconds: Double?,
        lastPTSSeconds: Double?
    ) -> Double {
        guard frameCount > 1,
              let firstPTSSeconds,
              let lastPTSSeconds
        else {
            return 0
        }

        let span = lastPTSSeconds - firstPTSSeconds
        guard span.isFinite, span > 0 else {
            return 0
        }

        return Double(frameCount - 1) / span
    }
}
