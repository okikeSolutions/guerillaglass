import Foundation

/// Policy helpers for supported capture frame rates.
public enum CaptureFrameRatePolicy {
    public static let supportedValues: [Int] = [24, 30, 60]
    public static let defaultValue: Int = 30

    public static func isSupported(_ frameRate: Int) -> Bool {
        supportedValues.contains(frameRate)
    }

    public static func sanitize(_ frameRate: Int) -> Int {
        guard isSupported(frameRate) else {
            return defaultValue
        }
        return frameRate
    }
}
