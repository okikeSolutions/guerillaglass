import Foundation

/// Public value type exposed by the macOS engine module.
public struct TimelineClip: Codable, Equatable {
    public enum SourceAssetID: String, Codable, Equatable {
        case recording
    }

    public var id: String
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

/// Public value type exposed by the macOS engine module.
public struct TimelineGap: Codable, Equatable {
    public var id: String
    public var durationSeconds: Double

    public init(
        id: String,
        durationSeconds: Double
    ) {
        self.id = id
        self.durationSeconds = durationSeconds
    }
}

/// Public value type exposed by the macOS engine module.
public enum TimelineItem: Equatable, Identifiable {
    case clip(TimelineClip)
    case gap(TimelineGap)

    public var id: String {
        switch self {
        case let .clip(clip):
            clip.id
        case let .gap(gap):
            gap.id
        }
    }
}

extension TimelineItem: Codable {
    private enum CodingKeys: String, CodingKey {
        case kind
        case id
        case sourceAssetId
        case sourceStartSeconds
        case sourceEndSeconds
        case durationSeconds
    }

    private enum Kind: String, Codable {
        case clip
        case gap
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        switch try container.decode(Kind.self, forKey: .kind) {
        case .clip:
            self = try .clip(
                TimelineClip(
                    id: container.decode(String.self, forKey: .id),
                    sourceAssetId: container.decode(TimelineClip.SourceAssetID.self, forKey: .sourceAssetId),
                    sourceStartSeconds: container.decode(Double.self, forKey: .sourceStartSeconds),
                    sourceEndSeconds: container.decode(Double.self, forKey: .sourceEndSeconds)
                )
            )
        case .gap:
            self = try .gap(
                TimelineGap(
                    id: container.decode(String.self, forKey: .id),
                    durationSeconds: container.decode(Double.self, forKey: .durationSeconds)
                )
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case let .clip(clip):
            try container.encode(Kind.clip, forKey: .kind)
            try container.encode(clip.id, forKey: .id)
            try container.encode(clip.sourceAssetId, forKey: .sourceAssetId)
            try container.encode(clip.sourceStartSeconds, forKey: .sourceStartSeconds)
            try container.encode(clip.sourceEndSeconds, forKey: .sourceEndSeconds)
        case let .gap(gap):
            try container.encode(Kind.gap, forKey: .kind)
            try container.encode(gap.id, forKey: .id)
            try container.encode(gap.durationSeconds, forKey: .durationSeconds)
        }
    }
}

/// Public value type exposed by the macOS engine module.
public struct TimelineDocument: Codable, Equatable {
    public let version: Int
    public var items: [TimelineItem]

    public init(version: Int = 2, items: [TimelineItem] = []) {
        self.version = version
        self.items = items
    }

    public static func singleSegment(recordingDuration: Double) -> TimelineDocument {
        guard recordingDuration > 0 else {
            return TimelineDocument()
        }

        return TimelineDocument(
            items: [
                .clip(
                    TimelineClip(
                        id: "segment-0",
                        sourceAssetId: .recording,
                        sourceStartSeconds: 0,
                        sourceEndSeconds: recordingDuration
                    )
                )
            ]
        )
    }

    private enum CodingKeys: String, CodingKey {
        case version
        case items
        case segments
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        version = (try? container.decode(Int.self, forKey: .version)) ?? 2
        if let items = try? container.decode([TimelineItem].self, forKey: .items) {
            self.items = items
            return
        }
        if let legacySegments = try? container.decode([TimelineClip].self, forKey: .segments) {
            items = legacySegments.map(TimelineItem.clip)
            return
        }
        items = []
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(version, forKey: .version)
        try container.encode(items, forKey: .items)
    }
}
