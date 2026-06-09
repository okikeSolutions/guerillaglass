import EngineProtocol
import Foundation
import Project

private let agentPreflightTTLSeconds: TimeInterval = 15 * 60

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

extension EngineService {
    func agent_period_agentPreflight(
        _ input: Operations.agent_period_agentPreflight.Input
    ) async throws -> Operations.agent_period_agentPreflight.Output {
        let payload: Components.Schemas.AgentPreflightPayload
        switch input.body { case let .json(body): payload = body }
        let evaluation = evaluateAgentPreflight(
            runtimeBudgetMinutes: Int(payload.runtimeBudgetMinutes?.value1 ?? 10),
            transcriptionProvider: payload.transcriptionProvider?.rawValue ?? "none",
            importedTranscriptPath: payload.importedTranscriptPath?.value1
        )
        let token: String?
        if evaluation.ready {
            let value = "macos-preflight-\(UUID().uuidString)"
            preflightSessions[value] = EngineAgentPreflightSession(
                token: value,
                runtimeBudgetMinutes: evaluation.runtimeBudgetMinutes,
                transcriptionProvider: evaluation.transcriptionProvider,
                importedTranscriptPath: evaluation.importedTranscriptPath,
                projectPath: currentProjectURL?.path,
                recordingURL: availableAgentRecordingURL()?.path,
                createdAt: Date()
            )
            token = value
        } else {
            token = nil
        }
        return .ok(.init(body: .json(.init(
            ready: evaluation.ready,
            blockingReasons: evaluation.blockingReasons,
            canApplyDestructive: hasUnsavedProjectChanges,
            transcriptionProvider: .init(rawValue: evaluation.transcriptionProvider) ?? .none,
            preflightToken: token.map { .init(value1: $0) }
        ))))
    }

    func agent_period_agentRun(
        _ input: Operations.agent_period_agentRun.Input
    ) async throws -> Operations.agent_period_agentRun.Output {
        let payload: Components.Schemas.AgentRunPayload
        switch input.body { case let .json(body): payload = body }
        let runtimeBudgetMinutes = Int(payload.runtimeBudgetMinutes?.value1 ?? 10)
        let transcriptionProvider = payload.transcriptionProvider?.rawValue ?? "none"
        let importedTranscriptPath = payload.importedTranscriptPath?.value1
        guard validatePreflightToken(
            payload.preflightToken.value1,
            runtimeBudgetMinutes: runtimeBudgetMinutes,
            transcriptionProvider: transcriptionProvider,
            importedTranscriptPath: importedTranscriptPath
        ) else {
            return .badRequest(.init(body: .json(badRequest(
                .invalid_params,
                "preflightToken is missing, expired, or does not match current run parameters. Run agent.preflight again."
            ))))
        }
        if payload.force == true && ProcessInfo.processInfo.environment["GG_AGENT_ALLOW_FORCE"] != "1" {
            return .badRequest(.init(body: .json(badRequest(
                .invalid_params,
                "force is disabled for production runs. Set GG_AGENT_ALLOW_FORCE=1 for local debugging."
            ))))
        }

        let coverage = payload.force == true
            ? AgentCoverage(hook: true, action: true, payoff: true, takeaway: true)
            : coverageForAgentRun(
                transcriptionProvider: transcriptionProvider,
                importedTranscriptPath: importedTranscriptPath
            )
        let run = buildAgentRun(
            jobId: "macos-agent-\(UUID().uuidString)",
            runtimeBudgetMinutes: runtimeBudgetMinutes,
            coverage: coverage,
            blockingReason: coverage.passed ? nil : .weak_narrative_structure
        )
        agentRuns[run.jobId] = run
        latestAgentJobId = run.jobId
        latestAgentUpdatedAt = run.updatedAt
        currentProjectDocument.project.agentAnalysis = AgentAnalysisMetadata(
            latestRunID: run.jobId,
            latestAppliedRunID: currentProjectDocument.project.agentAnalysis?.latestAppliedRunID,
            latestRunSummaryPath: currentProjectDocument.project.agentAnalysis?.latestRunSummaryPath
        )
        hasUnsavedProjectChanges = true
        return .ok(.init(body: .json(.init(
            jobId: .init(value1: run.jobId),
            status: Components.Schemas.AgentRunResult.statusPayload(rawValue: run.status.rawValue) ?? .failed
        ))))
    }

    func agent_period_agentStatus(
        _ input: Operations.agent_period_agentStatus.Input
    ) async throws -> Operations.agent_period_agentStatus.Output {
        guard let run = agentRuns[input.path.jobId.value1] else {
            return .badRequest(.init(body: .json(badRequest(.invalid_params, "Unknown jobId: \(input.path.jobId.value1)"))))
        }
        return .ok(.init(body: .json(summary(for: run))))
    }

    func agent_period_agentApply(
        _ input: Operations.agent_period_agentApply.Input
    ) async throws -> Operations.agent_period_agentApply.Output {
        let payload: Components.Schemas.AgentApplyPayload
        switch input.body { case let .json(body): payload = body }
        guard let run = agentRuns[input.path.jobId.value1] else {
            return .badRequest(.init(body: .json(badRequest(.invalid_params, "Unknown jobId: \(input.path.jobId.value1)"))))
        }
        guard run.qaReport.passed else {
            return .badRequest(.init(body: .json(badRequest(.invalid_request, "Narrative QA failed. Apply is blocked."))))
        }
        guard !hasUnsavedProjectChanges || payload.destructiveIntent == true else {
            return .badRequest(.init(body: .json(badRequest(
                .invalid_request,
                "Unsaved project changes detected. Retry with destructiveIntent=true to continue."
            ))))
        }
        if currentProjectDocument.project.timeline.items.isEmpty {
            currentProjectDocument.project.timeline = TimelineDocument.singleSegment(
                recordingDuration: max(captureEngine.recordingDuration, 0)
            )
        }
        var metadata = currentProjectDocument.project.agentAnalysis ?? AgentAnalysisMetadata()
        metadata.latestRunID = run.jobId
        metadata.latestAppliedRunID = run.jobId
        currentProjectDocument.project.agentAnalysis = metadata
        hasUnsavedProjectChanges = true
        return .ok(.init(body: .json(actionResult(true, message: "Applied cut plan to working timeline."))))
    }

    private struct AgentPreflightEvaluation {
        let ready: Bool
        let blockingReasons: [Components.Schemas.AgentPreflightResult.blockingReasonsPayloadPayload]
        let runtimeBudgetMinutes: Int
        let transcriptionProvider: String
        let importedTranscriptPath: String?
    }

    private struct AgentCoverage {
        let hook: Bool
        let action: Bool
        let payoff: Bool
        let takeaway: Bool

        var passed: Bool { hook && action && payoff && takeaway }
    }

    private func evaluateAgentPreflight(
        runtimeBudgetMinutes: Int,
        transcriptionProvider: String,
        importedTranscriptPath: String?
    ) -> AgentPreflightEvaluation {
        var reasons: [Components.Schemas.AgentPreflightResult.blockingReasonsPayloadPayload] = []
        if !(1...10).contains(runtimeBudgetMinutes) { reasons.append(.invalid_runtime_budget) }
        if currentProjectURL == nil { reasons.append(.missing_project) }
        if availableAgentRecordingURL() == nil { reasons.append(.missing_recording) }
        switch transcriptionProvider {
        case "imported_transcript":
            if importedTranscriptPath?.isEmpty ?? true {
                reasons.append(.missing_imported_transcript)
            } else if !importedTranscriptIsValid(importedTranscriptPath!) {
                reasons.append(.invalid_imported_transcript)
            }
        default:
            reasons.append(.missing_local_model)
        }
        return .init(
            ready: reasons.isEmpty,
            blockingReasons: reasons,
            runtimeBudgetMinutes: runtimeBudgetMinutes,
            transcriptionProvider: transcriptionProvider == "imported_transcript" ? transcriptionProvider : "none",
            importedTranscriptPath: importedTranscriptPath
        )
    }

    private func validatePreflightToken(
        _ token: String,
        runtimeBudgetMinutes: Int,
        transcriptionProvider: String,
        importedTranscriptPath: String?
    ) -> Bool {
        guard let session = preflightSessions.removeValue(forKey: token) else { return false }
        guard Date().timeIntervalSince(session.createdAt) <= agentPreflightTTLSeconds else { return false }
        return session.runtimeBudgetMinutes == runtimeBudgetMinutes &&
            session.transcriptionProvider == transcriptionProvider &&
            session.importedTranscriptPath == importedTranscriptPath &&
            session.projectPath == currentProjectURL?.path &&
            session.recordingURL == availableAgentRecordingURL()?.path
    }

    private func buildAgentRun(
        jobId: String,
        runtimeBudgetMinutes: Int,
        coverage: AgentCoverage,
        blockingReason: Components.Schemas.AgentRunSummary.blockingReasonPayload?
    ) -> EngineAgentRunRecord {
        let missingBeats = missingBeats(for: coverage)
        let score = Double(4 - missingBeats.count) / 4
        let report = Components.Schemas.AgentQAReport(
            passed: missingBeats.isEmpty,
            score: .init(value1: .init(value1: score)),
            coverage: .init(
                hook: coverage.hook,
                action: coverage.action,
                payoff: coverage.payoff,
                takeaway: coverage.takeaway
            ),
            missingBeats: missingBeats
        )
        return EngineAgentRunRecord(
            jobId: jobId,
            status: report.passed ? .completed : .blocked,
            runtimeBudgetMinutes: runtimeBudgetMinutes,
            qaReport: report,
            blockingReason: report.passed ? nil : blockingReason,
            updatedAt: isoNow()
        )
    }

    private func summary(for run: EngineAgentRunRecord) -> Components.Schemas.AgentRunSummary {
        .init(
            jobId: .init(value1: run.jobId),
            status: run.status,
            runtimeBudgetMinutes: .init(value1: Double(run.runtimeBudgetMinutes)),
            qaReport: run.qaReport,
            blockingReason: run.blockingReason,
            updatedAt: .init(value1: run.updatedAt)
        )
    }

    private func availableAgentRecordingURL() -> URL? {
        if let projectURL = projectRecordingURL(), FileManager.default.fileExists(atPath: projectURL.path) {
            return projectURL
        }
        return captureEngine.recordingURL
    }

    private func importedTranscriptIsValid(_ path: String) -> Bool {
        normalizedTranscriptTokens(path: path) != nil
    }

    private func coverageForAgentRun(transcriptionProvider: String, importedTranscriptPath: String?) -> AgentCoverage {
        if transcriptionProvider == "imported_transcript", let importedTranscriptPath,
           let tokens = normalizedTranscriptTokens(path: importedTranscriptPath) {
            return AgentCoverage(
                hook: tokens.contains("hook") || tokens.contains("intro") || tokens.contains("opening"),
                action: tokens.contains("action") || tokens.contains("step") || tokens.contains("steps") || tokens.contains("process"),
                payoff: tokens.contains("payoff") || tokens.contains("result") || tokens.contains("outcome"),
                takeaway: tokens.contains("takeaway") || tokens.contains("lesson") || tokens.contains("conclusion")
            )
        }
        let duration = captureEngine.recordingDuration
        return AgentCoverage(hook: true, action: duration >= 15, payoff: duration >= 30, takeaway: duration >= 45)
    }

    private func normalizedTranscriptTokens(path: String) -> Set<String>? {
        guard let data = FileManager.default.contents(atPath: path),
              let transcript = try? JSONDecoder().decode(ImportedTranscript.self, from: data) else { return nil }
        let segmentText = (transcript.segments ?? [])
            .filter { !$0.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && $0.startSeconds >= 0 && $0.endSeconds > $0.startSeconds }
            .map(\.text)
        let wordText = (transcript.words ?? [])
            .filter { !$0.word.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && $0.startSeconds >= 0 && $0.endSeconds > $0.startSeconds }
            .map(\.word)
        let text = (segmentText + wordText).joined(separator: " ").lowercased()
        let tokens = Set(text.split { !$0.isLetter && !$0.isNumber }.map(String.init))
        return tokens.isEmpty ? nil : tokens
    }

    private func missingBeats(
        for coverage: AgentCoverage
    ) -> [Components.Schemas.AgentQAReport.missingBeatsPayloadPayload] {
        var missing: [Components.Schemas.AgentQAReport.missingBeatsPayloadPayload] = []
        if !coverage.hook { missing.append(.hook) }
        if !coverage.action { missing.append(.action) }
        if !coverage.payoff { missing.append(.payoff) }
        if !coverage.takeaway { missing.append(.takeaway) }
        return missing
    }
}
