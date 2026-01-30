import AVFoundation
import Foundation

public struct TrimRangeValues: Equatable {
    public let start: Double
    public let end: Double

    public init(start: Double, end: Double) {
        self.start = start
        self.end = end
    }
}

public enum TrimRangeCalculator {
    public static func clamped(
        start: Double,
        end: Double,
        duration: Double
    ) -> TrimRangeValues? {
        guard duration > 0 else { return nil }
        let clampedStart = min(max(0, start), duration)
        var clampedEnd = end
        if clampedEnd <= 0 || clampedEnd > duration {
            clampedEnd = duration
        }
        clampedEnd = max(clampedEnd, clampedStart)
        return TrimRangeValues(start: clampedStart, end: clampedEnd)
    }

    public static func timeRange(
        start: Double,
        end: Double,
        duration: Double
    ) -> CMTimeRange? {
        guard duration > 0 else { return nil }
        let clampedStart = min(max(0, start), duration)
        var clampedEnd = end
        if clampedEnd <= 0 || clampedEnd > duration {
            clampedEnd = duration
        }
        if clampedEnd <= clampedStart {
            return nil
        }
        return CMTimeRange(
            start: CMTime(seconds: clampedStart, preferredTimescale: 600),
            duration: CMTime(seconds: clampedEnd - clampedStart, preferredTimescale: 600)
        )
    }
}
