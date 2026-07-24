import AVFoundation
import CoreGraphics

public struct ExportTimelineClip: Equatable, Sendable {
    public var id: String
    public var sourceStartSeconds: Double
    public var sourceEndSeconds: Double

    public init(id: String, sourceStartSeconds: Double, sourceEndSeconds: Double) {
        self.id = id
        self.sourceStartSeconds = sourceStartSeconds
        self.sourceEndSeconds = sourceEndSeconds
    }
}

public struct ExportTimelineGap: Equatable, Sendable {
    public var id: String
    public var durationSeconds: Double

    public init(id: String, durationSeconds: Double) {
        self.id = id
        self.durationSeconds = durationSeconds
    }
}

public enum ExportTimelineItem: Equatable, Sendable {
    case clip(ExportTimelineClip)
    case gap(ExportTimelineGap)
}

public struct ExportTimelineDocument: Equatable, Sendable {
    public var version: Int
    public var items: [ExportTimelineItem]

    public init(version: Int = 2, items: [ExportTimelineItem]) {
        self.version = version
        self.items = items
    }

    public var isEmpty: Bool {
        items.isEmpty
    }
}

public enum CompiledExportTimelineItem: Equatable, Sendable {
    case clip(id: String, sourceRange: CMTimeRange, programRange: CMTimeRange)
    case gap(id: String, programRange: CMTimeRange)

    public var programRange: CMTimeRange {
        switch self {
        case let .clip(_, _, programRange): programRange
        case let .gap(_, programRange): programRange
        }
    }

    /// Whether the compiled interval contains source media rather than a gap.
    public var isClip: Bool {
        if case .clip = self {
            return true
        }
        return false
    }
}

public struct ExportTimelineComposition {
    public let composition: AVMutableComposition
    public let videoTrack: AVCompositionTrack?
    public let sourceNaturalSize: CGSize?
    public let sourcePreferredTransform: CGAffineTransform?
    public let items: [CompiledExportTimelineItem]
}

enum TimelineCompositionBuilder {
    static let timescale: CMTimeScale = 600

    static func makeComposition(asset: AVAsset, timeline: ExportTimelineDocument) async throws -> ExportTimelineComposition {
        guard timeline.version == 2 else {
            throw ExportPipeline.ExportError.invalidTimeline("Unsupported timeline version: \(timeline.version)")
        }

        let assetDuration = try await asset.load(.duration)
        let sourceVideoTrack = try await asset.loadTracks(withMediaType: .video).first
        let sourceAudioTrack = try await asset.loadTracks(withMediaType: .audio).first

        let composition = AVMutableComposition()
        let compositionVideoTrack = sourceVideoTrack.flatMap { sourceTrack in
            composition.addMutableTrack(withMediaType: .video, preferredTrackID: sourceTrack.trackID)
        }
        let compositionAudioTrack = sourceAudioTrack.flatMap { sourceTrack in
            composition.addMutableTrack(withMediaType: .audio, preferredTrackID: sourceTrack.trackID)
        }

        let sourceNaturalSize = try await sourceVideoTrack?.load(.naturalSize)
        let sourcePreferredTransform = try await sourceVideoTrack?.load(.preferredTransform)
        if let sourcePreferredTransform, let compositionVideoTrack {
            compositionVideoTrack.preferredTransform = sourcePreferredTransform
        }

        var cursor = CMTime.zero
        var compiledItems: [CompiledExportTimelineItem] = []
        for item in timeline.items {
            switch item {
            case let .clip(clip):
                guard clip.sourceStartSeconds.isFinite, clip.sourceEndSeconds.isFinite else {
                    throw ExportPipeline.ExportError.invalidTimeline("Timeline clip \(clip.id) has non-finite bounds.")
                }
                guard clip.sourceStartSeconds >= 0, clip.sourceEndSeconds >= 0 else {
                    throw ExportPipeline.ExportError.invalidTimeline("Timeline clip \(clip.id) has negative bounds.")
                }
                guard clip.sourceEndSeconds >= clip.sourceStartSeconds else {
                    throw ExportPipeline.ExportError.invalidTimeline("Timeline clip \(clip.id) ends before it starts.")
                }
                let sourceStart = secondsToTime(clip.sourceStartSeconds)
                let requestedSourceEnd = secondsToTime(clip.sourceEndSeconds)
                let sourceEnd = min(requestedSourceEnd, assetDuration)
                guard sourceEnd > sourceStart else { continue }

                let sourceRange = CMTimeRange(start: sourceStart, end: sourceEnd)
                let programRange = CMTimeRange(start: cursor, duration: sourceRange.duration)

                if let sourceVideoTrack, let compositionVideoTrack {
                    try compositionVideoTrack.insertTimeRange(sourceRange, of: sourceVideoTrack, at: cursor)
                }
                if let sourceAudioTrack, let compositionAudioTrack {
                    try compositionAudioTrack.insertTimeRange(sourceRange, of: sourceAudioTrack, at: cursor)
                }

                compiledItems.append(.clip(id: clip.id, sourceRange: sourceRange, programRange: programRange))
                cursor = cursor + sourceRange.duration // swiftlint:disable:this shorthand_operator

            case let .gap(gap):
                guard gap.durationSeconds.isFinite else {
                    throw ExportPipeline.ExportError.invalidTimeline("Timeline gap \(gap.id) has a non-finite duration.")
                }
                guard gap.durationSeconds >= 0 else {
                    throw ExportPipeline.ExportError.invalidTimeline("Timeline gap \(gap.id) has a negative duration.")
                }
                let duration = secondsToTime(gap.durationSeconds)
                guard duration > .zero else { continue }
                let programRange = CMTimeRange(start: cursor, duration: duration)
                compositionVideoTrack?.insertEmptyTimeRange(programRange)
                compositionAudioTrack?.insertEmptyTimeRange(programRange)
                compiledItems.append(.gap(id: gap.id, programRange: programRange))
                cursor = cursor + duration // swiftlint:disable:this shorthand_operator
            }
        }

        return ExportTimelineComposition(
            composition: composition,
            videoTrack: compositionVideoTrack,
            sourceNaturalSize: sourceNaturalSize,
            sourcePreferredTransform: sourcePreferredTransform,
            items: compiledItems
        )
    }

    private static func secondsToTime(_ seconds: Double) -> CMTime {
        CMTime(seconds: seconds, preferredTimescale: timescale)
    }
}
