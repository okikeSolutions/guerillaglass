import Foundation

/// A normalized timed transcript span consumed by the deterministic Agent Mode planner.
public struct AgentTranscriptSpan: Codable, Equatable {
    public var text: String
    public var startSeconds: Double
    public var endSeconds: Double

    public init(text: String, startSeconds: Double, endSeconds: Double) {
        self.text = text
        self.startSeconds = startSeconds
        self.endSeconds = endSeconds
    }
}

/// Canonical normalized transcript artifact.
public struct AgentTranscriptArtifact: Codable, Equatable {
    public let version: Int
    public var segments: [AgentTranscriptSpan]
    public var words: [AgentTranscriptSpan]

    public init(version: Int = 1, segments: [AgentTranscriptSpan], words: [AgentTranscriptSpan]) {
        self.version = version
        self.segments = segments
        self.words = words
    }
}

/// Narrative beat used by deterministic Agent Mode planning.
public enum AgentNarrativeBeat: String, Codable, CaseIterable {
    case hook
    case action
    case payoff
    case takeaway
}

/// Timed narrative anchor emitted by Agent Mode analysis.
public struct AgentBeatAnchor: Codable, Equatable {
    public var beat: AgentNarrativeBeat
    public var startSeconds: Double
    public var endSeconds: Double

    public init(beat: AgentNarrativeBeat, startSeconds: Double, endSeconds: Double) {
        self.beat = beat
        self.startSeconds = startSeconds
        self.endSeconds = endSeconds
    }
}

/// Versioned beat-map artifact.
public struct AgentBeatMapArtifact: Codable, Equatable {
    public let version: Int
    public var anchors: [AgentBeatAnchor]

    public init(version: Int = 1, anchors: [AgentBeatAnchor]) {
        self.version = version
        self.anchors = anchors
    }
}

/// Rational source frame rate retained without rounding fractional broadcast rates.
public struct AgentFrameRate: Codable, Equatable {
    public var numerator: Int
    public var denominator: Int

    public init(numerator: Int, denominator: Int = 1) {
        self.numerator = numerator
        self.denominator = denominator
    }

    public var framesPerSecond: Double {
        Double(numerator) / Double(denominator)
    }

    public func seconds(forFrame frame: Int) -> Double {
        Double(frame) * Double(denominator) / Double(numerator)
    }
}

/// End-exclusive frame range selected by a deterministic cut plan.
public struct AgentCutPlanSegment: Codable, Equatable {
    public var id: String
    public var beat: AgentNarrativeBeat
    public var startFrame: Int
    public var endFrame: Int

    public init(id: String, beat: AgentNarrativeBeat, startFrame: Int, endFrame: Int) {
        self.id = id
        self.beat = beat
        self.startFrame = startFrame
        self.endFrame = endFrame
    }
}

/// Canonical frame-based Agent Mode cut-plan artifact.
public struct AgentCutPlanArtifact: Codable, Equatable {
    public let version: Int
    public var sourceFps: AgentFrameRate
    public var sourceFrameCount: Int
    public var segments: [AgentCutPlanSegment]

    public init(
        version: Int = 1,
        sourceFps: AgentFrameRate,
        sourceFrameCount: Int,
        segments: [AgentCutPlanSegment]
    ) {
        self.version = version
        self.sourceFps = sourceFps
        self.sourceFrameCount = sourceFrameCount
        self.segments = segments
    }

    public func validated() throws -> AgentCutPlanArtifact {
        guard version == 1, sourceFps.numerator > 0, sourceFps.denominator > 0,
              sourceFrameCount > 0, !segments.isEmpty
        else {
            throw AgentArtifactError.invalidCutPlan
        }
        guard segments.map(\.beat) == AgentNarrativeBeat.allCases,
              Set(segments.map(\.id)).count == segments.count
        else { throw AgentArtifactError.invalidCutPlan }
        var previousEnd = 0
        for segment in segments {
            guard !segment.id.isEmpty,
                  segment.startFrame >= previousEnd,
                  segment.endFrame > segment.startFrame,
                  segment.endFrame <= sourceFrameCount
            else { throw AgentArtifactError.invalidCutPlan }
            previousEnd = segment.endFrame
        }
        return self
    }

    public func timeline() throws -> TimelineDocument {
        let validated = try validated()
        return TimelineDocument(items: validated.segments.map { segment in
            .clip(TimelineClip(
                id: segment.id,
                sourceStartSeconds: validated.sourceFps.seconds(forFrame: segment.startFrame),
                sourceEndSeconds: validated.sourceFps.seconds(forFrame: segment.endFrame)
            ))
        })
    }
}

/// Canonical persisted manifest for the latest Agent Mode run in a project.
public struct AgentRunSummaryArtifact: Codable, Equatable {
    public let version: Int
    public var jobId: String
    public var projectId: UUID
    public var recordingFileName: String
    public var recordingRevision: String
    public var status: AgentJobStatus
    public var runtimeBudgetMinutes: Int
    public var qaReport: AgentQAReport
    public var artifacts: [AgentArtifactReference]
    public var cutPlan: AgentCutPlanArtifact
    public var baseTimeline: TimelineDocument
    public var requiresDestructiveConfirmation: Bool
    public var createdAt: Date
    public var updatedAt: Date

    public init(
        version: Int = 1,
        jobId: String,
        projectId: UUID,
        recordingFileName: String,
        recordingRevision: String,
        status: AgentJobStatus,
        runtimeBudgetMinutes: Int,
        qaReport: AgentQAReport,
        artifacts: [AgentArtifactReference],
        cutPlan: AgentCutPlanArtifact,
        baseTimeline: TimelineDocument,
        requiresDestructiveConfirmation: Bool,
        createdAt: Date,
        updatedAt: Date
    ) {
        self.version = version
        self.jobId = jobId
        self.projectId = projectId
        self.recordingFileName = recordingFileName
        self.recordingRevision = recordingRevision
        self.status = status
        self.runtimeBudgetMinutes = runtimeBudgetMinutes
        self.qaReport = qaReport
        self.artifacts = artifacts
        self.cutPlan = cutPlan
        self.baseTimeline = baseTimeline
        self.requiresDestructiveConfirmation = requiresDestructiveConfirmation
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

/// Validation failures for persisted Agent Mode artifacts.
public enum AgentArtifactError: Error {
    case invalidTranscript
    case invalidCutPlan
    case invalidRunSummary
    case unsafeArtifactPath
    case projectMismatch
}

/// Pure deterministic imported-transcript planner used by Agent Mode.
public enum ImportedTranscriptAgentPlanner {
    private struct ImportedTranscript: Decodable {
        struct Segment: Decodable {
            let text: String
            let startSeconds: Double
            let endSeconds: Double
        }

        struct Word: Decodable {
            let word: String
            let startSeconds: Double
            let endSeconds: Double
        }

        let segments: [Segment]?
        let words: [Word]?
    }

    public struct Result: Equatable {
        public var transcript: AgentTranscriptArtifact
        public var beatMap: AgentBeatMapArtifact
        public var qaReport: AgentQAReport
        public var cutPlan: AgentCutPlanArtifact
    }

    public static func plan(data: Data, sourceDuration: Double, sourceFps: AgentFrameRate) throws -> Result {
        guard sourceDuration.isFinite, sourceDuration > 0,
              sourceFps.numerator > 0, sourceFps.denominator > 0,
              let imported = try? JSONDecoder().decode(ImportedTranscript.self, from: data)
        else { throw AgentArtifactError.invalidTranscript }

        func normalized(text: String, start: Double, end: Double) -> AgentTranscriptSpan? {
            let value = text.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !value.isEmpty, start.isFinite, end.isFinite,
                  start >= 0, end > start, start < sourceDuration
            else { return nil }
            return AgentTranscriptSpan(text: value, startSeconds: start, endSeconds: min(end, sourceDuration))
        }

        let importedSegments = imported.segments ?? []
        let importedWords = imported.words ?? []
        let segments = importedSegments.compactMap {
            normalized(text: $0.text, start: $0.startSeconds, end: $0.endSeconds)
        }.sorted { $0.startSeconds < $1.startSeconds }
        let words = importedWords.compactMap {
            normalized(text: $0.word, start: $0.startSeconds, end: $0.endSeconds)
        }.sorted { $0.startSeconds < $1.startSeconds }
        guard segments.count == importedSegments.count,
              words.count == importedWords.count,
              !segments.isEmpty || !words.isEmpty
        else { throw AgentArtifactError.invalidTranscript }

        let transcript = AgentTranscriptArtifact(segments: segments, words: words)
        let narrativeUnits = segments.isEmpty ? words : segments
        let candidates: [AgentNarrativeBeat: Set<String>] = [
            .hook: ["hook", "intro", "opening"],
            .action: ["action", "step", "steps", "process"],
            .payoff: ["payoff", "result", "outcome"],
            .takeaway: ["takeaway", "lesson", "conclusion"],
        ]
        var anchors: [AgentBeatAnchor] = []
        var searchStart = 0
        for beat in AgentNarrativeBeat.allCases {
            guard let accepted = candidates[beat] else { continue }
            var match: (Int, AgentTranscriptSpan)?
            for index in searchStart ..< narrativeUnits.count {
                let tokens = Set(narrativeUnits[index].text.lowercased().split { !$0.isLetter && !$0.isNumber }.map(String.init))
                if !tokens.isDisjoint(with: accepted) {
                    match = (index, narrativeUnits[index])
                    break
                }
            }
            guard let match else { continue }
            anchors.append(.init(beat: beat, startSeconds: match.1.startSeconds, endSeconds: match.1.endSeconds))
            searchStart = match.0 + 1
        }

        let covered = Set(anchors.map(\.beat))
        let missing = AgentNarrativeBeat.allCases.filter { !covered.contains($0) }
        let coverage = AgentQACoverage(
            hook: covered.contains(.hook),
            action: covered.contains(.action),
            payoff: covered.contains(.payoff),
            takeaway: covered.contains(.takeaway)
        )
        let qa = AgentQAReport(
            passed: missing.isEmpty,
            score: Double(covered.count) / Double(AgentNarrativeBeat.allCases.count),
            coverage: coverage,
            missingBeats: missing.map(\.rawValue)
        )
        let framesPerSecond = sourceFps.framesPerSecond
        let sourceFrameCount = max(1, Int(floor(sourceDuration * framesPerSecond)))
        guard qa.passed else {
            return Result(
                transcript: transcript,
                beatMap: .init(anchors: anchors),
                qaReport: qa,
                cutPlan: .init(sourceFps: sourceFps, sourceFrameCount: sourceFrameCount, segments: [])
            )
        }

        var plannedSegments: [AgentCutPlanSegment] = []
        var previousEndFrame = 0
        for (index, beat) in AgentNarrativeBeat.allCases.enumerated() {
            let anchor = anchors[index]
            let startFrame = max(
                previousEndFrame,
                max(0, Int(floor(anchor.startSeconds * framesPerSecond)))
            )
            let endFrame = min(
                sourceFrameCount,
                Int(ceil(anchor.endSeconds * framesPerSecond))
            )
            guard endFrame > startFrame else { throw AgentArtifactError.invalidTranscript }
            plannedSegments.append(AgentCutPlanSegment(
                id: "agent-\(beat.rawValue)-\(index)",
                beat: beat,
                startFrame: startFrame,
                endFrame: endFrame
            ))
            previousEndFrame = endFrame
        }
        let cutPlan = try AgentCutPlanArtifact(
            sourceFps: sourceFps,
            sourceFrameCount: sourceFrameCount,
            segments: plannedSegments
        ).validated()
        return Result(transcript: transcript, beatMap: .init(anchors: anchors), qaReport: qa, cutPlan: cutPlan)
    }
}
