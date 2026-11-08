import Foundation

/// A source-time camera keyframe, shared by persisted projects and native rendering.
public struct SceneCameraKeyframe: Codable, Equatable, Sendable {
    public var timeSeconds: Double
    public var centerX: Double
    public var centerY: Double
    public var zoom: Double

    public init(timeSeconds: Double, centerX: Double, centerY: Double, zoom: Double) {
        self.timeSeconds = timeSeconds
        self.centerX = centerX
        self.centerY = centerY
        self.zoom = zoom
    }

    public static func validate(_ camera: [SceneCameraKeyframe], sourceDuration: Double = .greatestFiniteMagnitude) throws {
        guard !camera.isEmpty, camera.count <= 256 else { throw EditPlan.ValidationError.invalidPlan }
        var previousTime = -Double.infinity
        for key in camera {
            guard key.timeSeconds.isFinite, key.timeSeconds >= 0, key.timeSeconds <= sourceDuration,
                  key.timeSeconds > previousTime,
                  key.centerX.isFinite, (0 ... 1).contains(key.centerX),
                  key.centerY.isFinite, (0 ... 1).contains(key.centerY),
                  key.zoom.isFinite, (1 ... 8).contains(key.zoom)
            else { throw EditPlan.ValidationError.invalidPlan }
            previousTime = key.timeSeconds
        }
    }

    /// Interpolates affine camera transforms, matching AVFoundation's transform ramps.
    public static func sample(_ camera: [SceneCameraKeyframe], at time: Double) -> SceneCameraKeyframe? {
        guard let first = camera.first else { return nil }
        guard time > first.timeSeconds else { return first }
        var previous = first
        for next in camera.dropFirst() {
            if time <= next.timeSeconds {
                let progress = (time - previous.timeSeconds) / (next.timeSeconds - previous.timeSeconds)
                let zoom = previous.zoom + (next.zoom - previous.zoom) * progress
                return .init(
                    timeSeconds: time,
                    centerX: (previous.centerX * previous.zoom * (1 - progress) + next.centerX * next.zoom * progress) / zoom,
                    centerY: (previous.centerY * previous.zoom * (1 - progress) + next.centerY * next.zoom * progress) / zoom,
                    zoom: zoom
                )
            }
            previous = next
        }
        return previous
    }
}
