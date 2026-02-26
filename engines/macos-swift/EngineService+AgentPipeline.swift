import Foundation
import Project

let maxAgentRuntimeBudgetMinutes = 10
let maxAgentSourceDurationSeconds: TimeInterval = 10 * 60
let defaultAgentSourceFPS = 30.0
let audioEnergyPeakThreshold: Float = 0.015
let audioEnergyScanWindowSeconds = 8.0

enum AgentBlockingReason: String, Codable {
    case missingProject = "missing_project"
    case missingRecording = "missing_recording"
    case invalidRuntimeBudget = "invalid_runtime_budget"
    case sourceTooLong = "source_too_long"
    case sourceDurationInvalid = "source_duration_invalid"
    case missingLocalModel = "missing_local_model"
    case missingImportedTranscript = "missing_imported_transcript"
    case invalidImportedTranscript = "invalid_imported_transcript"
    case noAudioTrack = "no_audio_track"
    case silentAudio = "silent_audio"
    case emptyTranscript = "empty_transcript"
    case weakNarrativeStructure = "weak_narrative_structure"
}

enum AgentTranscriptionProvider: String, Codable {
    case none
    case importedTranscript = "imported_transcript"
}

enum NarrativeBeatKind: String, Codable, CaseIterable {
    case hook
    case action
    case payoff
    case takeaway
}

struct NarrativeBeat: Codable {
    let kind: NarrativeBeatKind
    let startSeconds: Double
    let endSeconds: Double
    let summary: String
}

struct TranscriptSegment: Codable {
    let startSeconds: Double
    let endSeconds: Double
    let text: String
}

struct TranscriptWord: Codable {
    let word: String
    let startSeconds: Double
    let endSeconds: Double
}

struct TranscriptFullDocument: Codable {
    let schemaVersion: Int
    let jobId: String
    let recordingURL: String
    let durationSeconds: Double
    let segments: [TranscriptSegment]
}

struct TranscriptWordsDocument: Codable {
    let schemaVersion: Int
    let jobId: String
    let durationSeconds: Double
    let words: [TranscriptWord]
}

struct BeatMapDocument: Codable {
    let schemaVersion: Int
    let jobId: String
    let beats: [NarrativeBeat]
}

struct QAReportDocument: Codable {
    let schemaVersion: Int
    let jobId: String
    let passed: Bool
    let score: Double
    let coverage: AgentQACoverage
    let missingBeats: [String]
    let blockingReason: String?
}

struct AgentCutPlanSegment: Codable {
    let startFrame: Int64
    let endFrame: Int64
    let beat: NarrativeBeatKind
}

struct AgentCutPlanDocument: Codable {
    let schemaVersion: Int
    let jobId: String
    let sourceDurationSeconds: Double
    let sourceFPS: Double
    let segments: [AgentCutPlanSegment]
}

struct AgentRunSummaryDocument: Codable {
    let schemaVersion: Int
    let jobId: String
    var status: AgentJobStatus
    let runtimeBudgetMinutes: Int
    let qaReport: AgentQAReport?
    let blockingReason: String?
    let artifacts: [AgentArtifactReference]
    var updatedAt: String
}

struct TranscriptionPayload {
    let segments: [TranscriptSegment]
    let words: [TranscriptWord]
}

protocol TranscriptionProvider {
    var kind: AgentTranscriptionProvider { get }
    func transcribe(durationSeconds: Double) throws -> TranscriptionPayload
}

private struct NoTranscriptionProvider: TranscriptionProvider {
    let kind: AgentTranscriptionProvider = .none

    func transcribe(durationSeconds _: Double) throws -> TranscriptionPayload {
        throw AgentModeError.missingLocalModel("No local transcription engine is configured.")
    }
}

private struct ImportedTranscriptProvider: TranscriptionProvider {
    private struct ImportedTranscriptDocument: Decodable {
        let segments: [TranscriptSegment]?
        let words: [TranscriptWord]?
    }

    let transcriptPath: String
    let kind: AgentTranscriptionProvider = .importedTranscript

    func transcribe(durationSeconds: Double) throws -> TranscriptionPayload {
        guard !transcriptPath.isEmpty else {
            throw AgentModeError.invalidImportedTranscript("importedTranscriptPath is required for imported_transcript.")
        }

        let url = URL(fileURLWithPath: transcriptPath)
        guard FileManager.default.fileExists(atPath: url.path) else {
            throw AgentModeError.invalidImportedTranscript("Imported transcript file does not exist.")
        }

        let data = try Data(contentsOf: url)
        let decoder = JSONDecoder()
        let document: ImportedTranscriptDocument
        do {
            document = try decoder.decode(ImportedTranscriptDocument.self, from: data)
        } catch {
            throw AgentModeError.invalidImportedTranscript("Imported transcript JSON is invalid.")
        }

        var segments = sanitizeSegments(document.segments ?? [], durationSeconds: durationSeconds)
        var words = sanitizeWords(document.words ?? [], durationSeconds: durationSeconds)

        if words.isEmpty, !segments.isEmpty {
            words = deriveWords(from: segments)
        }
        if segments.isEmpty, !words.isEmpty {
            segments = deriveSegments(from: words)
        }

        guard !segments.isEmpty, !words.isEmpty else {
            throw AgentModeError.invalidImportedTranscript(
                "Imported transcript must contain segments or words with valid timing."
            )
        }

        return TranscriptionPayload(segments: segments, words: words)
    }

    private func sanitizeSegments(_ input: [TranscriptSegment], durationSeconds: Double) -> [TranscriptSegment] {
        input
            .map { segment in
                let start = max(0, min(durationSeconds, segment.startSeconds))
                let end = max(start, min(durationSeconds, segment.endSeconds))
                return TranscriptSegment(startSeconds: start, endSeconds: end, text: segment.text)
            }
            .filter { !$0.text.isEmpty && $0.endSeconds > $0.startSeconds }
            .sorted { $0.startSeconds < $1.startSeconds }
    }

    private func sanitizeWords(_ input: [TranscriptWord], durationSeconds: Double) -> [TranscriptWord] {
        input
            .map { word in
                let start = max(0, min(durationSeconds, word.startSeconds))
                let end = max(start, min(durationSeconds, word.endSeconds))
                return TranscriptWord(word: word.word, startSeconds: start, endSeconds: end)
            }
            .filter { !$0.word.isEmpty && $0.endSeconds > $0.startSeconds }
            .sorted { $0.startSeconds < $1.startSeconds }
    }

    private func deriveWords(from segments: [TranscriptSegment]) -> [TranscriptWord] {
        segments.flatMap { segment in
            let chunkWords = segment.text.split(separator: " ").map(String.init)
            guard !chunkWords.isEmpty else { return [TranscriptWord]() }

            let duration = max(segment.endSeconds - segment.startSeconds, 0.001)
            return chunkWords.enumerated().map { index, word in
                let start = segment.startSeconds + duration * Double(index) / Double(chunkWords.count)
                let end = segment.startSeconds + duration * Double(index + 1) / Double(chunkWords.count)
                return TranscriptWord(word: word, startSeconds: start, endSeconds: max(start, end))
            }
        }
    }

    private func deriveSegments(from words: [TranscriptWord]) -> [TranscriptSegment] {
        guard let first = words.first, let last = words.last else {
            return []
        }
        return [
            TranscriptSegment(
                startSeconds: first.startSeconds,
                endSeconds: last.endSeconds,
                text: words.map(\.word).joined(separator: " ")
            )
        ]
    }
}

struct AgentPipelineInput {
    let jobId: String
    let durationSeconds: Double
    let sourceFPS: Double
    let forceNarrativeCompletion: Bool
    let transcriptionProvider: any TranscriptionProvider
}

struct AgentPipelineOutput {
    let transcriptSegments: [TranscriptSegment]
    let words: [TranscriptWord]
    let beatMap: [NarrativeBeat]
    let qaReport: AgentQAReport
    let cutPlan: AgentCutPlanDocument
}

struct DeterministicLocalAgentPipelineService {
    let input: AgentPipelineInput

    func run() throws -> AgentPipelineOutput {
        let transcription = try input.transcriptionProvider.transcribe(durationSeconds: input.durationSeconds)
        let beatMap = mapNarrativeBeats(from: transcription.segments, words: transcription.words)
        let qaReport = makeQAReport(from: beatMap)
        let cutPlan = buildCutPlan(from: beatMap)
        return AgentPipelineOutput(
            transcriptSegments: transcription.segments,
            words: transcription.words,
            beatMap: beatMap,
            qaReport: qaReport,
            cutPlan: cutPlan
        )
    }

    private func mapNarrativeBeats(from transcriptSegments: [TranscriptSegment], words: [TranscriptWord]) -> [NarrativeBeat] {
        guard !transcriptSegments.isEmpty else { return [] }
        let beatKinds: [NarrativeBeatKind] = if input.forceNarrativeCompletion {
            NarrativeBeatKind.allCases
        } else {
            detectedBeatKinds(from: transcriptSegments, words: words)
        }
        guard !beatKinds.isEmpty else { return [] }

        let beatDuration = input.durationSeconds / Double(max(beatKinds.count, 1))
        return beatKinds.enumerated().map { index, kind in
            let start = beatDuration * Double(index)
            let end = min(input.durationSeconds, beatDuration * Double(index + 1))
            return NarrativeBeat(
                kind: kind,
                startSeconds: max(0, start),
                endSeconds: max(start, end),
                summary: narrativeSummary(for: kind)
            )
        }
    }

    private func detectedBeatKinds(from segments: [TranscriptSegment], words: [TranscriptWord]) -> [NarrativeBeatKind] {
        let tokens = normalizedTranscriptTokens(segments: segments, words: words)
        var beatKinds: [NarrativeBeatKind] = []
        if containsAny(tokens: tokens, keywords: ["hook", "intro", "opening"]) {
            beatKinds.append(.hook)
        }
        if containsAny(tokens: tokens, keywords: ["action", "step", "steps", "process"]) {
            beatKinds.append(.action)
        }
        if containsAny(tokens: tokens, keywords: ["payoff", "result", "outcome"]) {
            beatKinds.append(.payoff)
        }
        if containsAny(tokens: tokens, keywords: ["takeaway", "lesson", "conclusion"]) {
            beatKinds.append(.takeaway)
        }
        return beatKinds
    }

    private func normalizedTranscriptTokens(segments: [TranscriptSegment], words: [TranscriptWord]) -> Set<String> {
        let allText = segments.map(\.text).joined(separator: " ") + " " + words.map(\.word).joined(separator: " ")
        let separators = CharacterSet.alphanumerics.inverted
        let tokens = allText
            .lowercased()
            .components(separatedBy: separators)
            .filter { !$0.isEmpty }
        return Set(tokens)
    }

    private func containsAny(tokens: Set<String>, keywords: [String]) -> Bool {
        keywords.contains { tokens.contains($0) }
    }

    private func makeQAReport(from beats: [NarrativeBeat]) -> AgentQAReport {
        let beatKinds = Set(beats.map(\.kind))
        let coverage = AgentQACoverage(
            hook: beatKinds.contains(.hook),
            action: beatKinds.contains(.action),
            payoff: beatKinds.contains(.payoff),
            takeaway: beatKinds.contains(.takeaway)
        )

        let allKinds = NarrativeBeatKind.allCases
        let missingKinds = allKinds.filter { !beatKinds.contains($0) }
        let covered = allKinds.count - missingKinds.count
        let score = Double(covered) / Double(allKinds.count)

        return AgentQAReport(
            passed: missingKinds.isEmpty,
            score: score,
            coverage: coverage,
            missingBeats: missingKinds.map(\.rawValue)
        )
    }

    private func buildCutPlan(from beats: [NarrativeBeat]) -> AgentCutPlanDocument {
        let maxFrame = max(1, Int64((input.durationSeconds * input.sourceFPS).rounded(.up)))
        var nextStartFrame: Int64 = 0

        let segments = beats.enumerated().map { index, beat in
            var startFrame = Int64((beat.startSeconds * input.sourceFPS).rounded(.down))
            startFrame = max(nextStartFrame, max(0, startFrame))

            var endFrame = Int64((beat.endSeconds * input.sourceFPS).rounded(.up))
            if index == beats.count - 1 {
                endFrame = maxFrame
            }
            endFrame = min(maxFrame, max(startFrame + 1, endFrame))

            if startFrame >= maxFrame {
                startFrame = max(0, maxFrame - 1)
                endFrame = maxFrame
            }

            nextStartFrame = endFrame
            return AgentCutPlanSegment(startFrame: startFrame, endFrame: endFrame, beat: beat.kind)
        }

        return AgentCutPlanDocument(
            schemaVersion: 1,
            jobId: input.jobId,
            sourceDurationSeconds: input.durationSeconds,
            sourceFPS: input.sourceFPS,
            segments: segments
        )
    }

    private func narrativeSummary(for beat: NarrativeBeatKind) -> String {
        switch beat {
        case .hook:
            "Hook introduces the core tension and stakes for the scene."
        case .action:
            "Action shows concrete progress and escalating momentum through each step."
        case .payoff:
            "Payoff resolves the setup and demonstrates the promised outcome."
        case .takeaway:
            "Takeaway closes with a clear lesson and next move for the viewer."
        }
    }
}

func makeTranscriptionProvider(
    kind: AgentTranscriptionProvider,
    importedTranscriptPath: String?
) -> any TranscriptionProvider {
    switch kind {
    case .none:
        NoTranscriptionProvider()
    case .importedTranscript:
        ImportedTranscriptProvider(transcriptPath: importedTranscriptPath ?? "")
    }
}
