import CoreMedia
import Foundation
import QuartzCore

/// Monotonic capture clock used for media timing.
public struct CaptureClock {
    public init() {}

    public func now() -> CMTime {
        CMTime(seconds: CACurrentMediaTime(), preferredTimescale: 1_000_000_000)
    }
}
