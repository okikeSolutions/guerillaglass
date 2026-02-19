import Foundation

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
}
