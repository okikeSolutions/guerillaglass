import Foundation
import CoreMedia
import QuartzCore

public struct CaptureClock {
    public init() {}

    public func now() -> CMTime {
        CMTime(seconds: CACurrentMediaTime(), preferredTimescale: 1_000_000_000)
    }
}
