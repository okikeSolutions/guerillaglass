import Foundation

/// Externally authored timeline proposal. Clip IDs identify storyboard scenes.
public struct EditPlan: Codable, Equatable {
    public var version: Int
    public var id: String
    public var baseRevision: String
    public var sourceRevision: String
    public var timeline: TimelineDocument

    /// Validates the complete proposal before the caller mutates project state.
    public func validate(sourceDuration: Double) throws {
        guard version == 1, !id.isEmpty, sourceDuration.isFinite, sourceDuration > 0,
              timeline.version == 2, !timeline.items.isEmpty, timeline.items.count <= 10000,
              Set(timeline.items.map(\.id)).count == timeline.items.count
        else { throw ValidationError.invalidPlan }
        var hasClip = false
        for item in timeline.items {
            guard !item.id.isEmpty else { throw ValidationError.invalidPlan }
            switch item {
            case let .clip(clip):
                guard clip.sourceStartSeconds.isFinite, clip.sourceEndSeconds.isFinite,
                      clip.sourceStartSeconds >= 0, clip.sourceEndSeconds > clip.sourceStartSeconds,
                      clip.sourceEndSeconds <= sourceDuration
                else { throw ValidationError.invalidPlan }
                if let camera = clip.camera {
                    try SceneCameraKeyframe.validate(camera, sourceDuration: sourceDuration)
                }
                hasClip = true
            case let .gap(gap):
                guard gap.durationSeconds.isFinite, gap.durationSeconds > 0 else {
                    throw ValidationError.invalidPlan
                }
            }
        }
        guard hasClip else { throw ValidationError.invalidPlan }
    }

    public enum ValidationError: Error {
        case invalidPlan
    }
}
