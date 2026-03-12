import CoreMedia
import Foundation

/// ScreenCaptureKit pacing policy used to request frame delivery cadence.
enum CaptureFrameIntervalStrategy {
    private static let preferredTimescale: CMTimeScale = 120_000
    private static let highFrameRateOversubscriptionFactor = 1.10

    static func minimumFrameInterval(for targetFrameRate: Int) -> CMTime {
        let sanitizedFrameRate = max(1, targetFrameRate)
        let oversubscriptionFactor = sanitizedFrameRate >= 60 ? highFrameRateOversubscriptionFactor : 1.0
        let requestedIntervalSeconds = 1.0 / (Double(sanitizedFrameRate) * oversubscriptionFactor)
        return CMTime(seconds: requestedIntervalSeconds, preferredTimescale: preferredTimescale)
    }
}
