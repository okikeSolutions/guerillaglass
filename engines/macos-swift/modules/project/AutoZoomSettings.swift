import Foundation

public struct AutoZoomSettings: Codable, Equatable {
    public static let intensityRange: ClosedRange<Double> = 0 ... 1
    public static let minimumKeyframeIntervalRange: ClosedRange<TimeInterval> =
        1.0 / 60.0 ... 1.0 / 10.0

    public var isEnabled: Bool
    public var intensity: Double
    public var minimumKeyframeInterval: TimeInterval

    public init(
        isEnabled: Bool = true,
        intensity: Double = 1.0,
        minimumKeyframeInterval: TimeInterval = 1.0 / 30.0
    ) {
        self.isEnabled = isEnabled
        self.intensity = intensity
        self.minimumKeyframeInterval = minimumKeyframeInterval
    }

    public func clamped() -> AutoZoomSettings {
        var clamped = self
        let intensity = intensity.isFinite ? intensity : 1.0
        clamped.intensity = min(
            max(intensity, AutoZoomSettings.intensityRange.lowerBound),
            AutoZoomSettings.intensityRange.upperBound
        )
        let interval = minimumKeyframeInterval.isFinite ? minimumKeyframeInterval : 1.0 / 30.0
        let range = AutoZoomSettings.minimumKeyframeIntervalRange
        clamped.minimumKeyframeInterval = min(max(interval, range.lowerBound), range.upperBound)
        return clamped
    }
}
