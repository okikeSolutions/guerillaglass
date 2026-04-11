import Foundation

/// Public value type exposed by the macOS engine module.
public struct TimelineDocument: Codable, Equatable {
    public let version: Int
    public var segments: [TimelineSegment]

    public init(version: Int = 1, segments: [TimelineSegment] = []) {
        self.version = version
        self.segments = segments
    }

    public static func singleSegment(recordingDuration: Double) -> TimelineDocument {
        guard recordingDuration > 0 else {
            return TimelineDocument()
        }

        return TimelineDocument(
            segments: [
                TimelineSegment(
                    id: "segment-0",
                    sourceAssetId: .recording,
                    sourceStartSeconds: 0,
                    sourceEndSeconds: recordingDuration
                )
            ]
        )
    }
}

/// Public value type exposed by the macOS engine module.
public struct TimelineSegment: Codable, Equatable, Identifiable {
    public enum SourceAssetID: String, Codable, Equatable {
        case recording
    }

    public let id: String
    public var sourceAssetId: SourceAssetID
    public var sourceStartSeconds: Double
    public var sourceEndSeconds: Double

    public init(
        id: String,
        sourceAssetId: SourceAssetID = .recording,
        sourceStartSeconds: Double,
        sourceEndSeconds: Double
    ) {
        self.id = id
        self.sourceAssetId = sourceAssetId
        self.sourceStartSeconds = sourceStartSeconds
        self.sourceEndSeconds = sourceEndSeconds
    }
}
