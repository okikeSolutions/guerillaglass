import AVFoundation
import EngineProtocol
import Foundation
import Project

extension EngineService {
    func agentPreflightResponse(id: String, params: [String: JSONValue]) async -> EngineResponse {
        let runtimeBudgetMinutes = params["runtimeBudgetMinutes"]?.intValue ?? maxAgentRuntimeBudgetMinutes
        let transcriptionProvider = transcriptionProvider(from: params)
        let importedTranscriptPath = params["importedTranscriptPath"]?.stringValue
        let normalizedImportedTranscriptPath = importedTranscriptPath?.isEmpty == true ? nil : importedTranscriptPath

        let blockingReasons = await preflightBlockingReasons(
            runtimeBudgetMinutes: runtimeBudgetMinutes,
            transcriptionProvider: transcriptionProvider,
            importedTranscriptPath: normalizedImportedTranscriptPath
        )
        let preflightToken: String?
        if blockingReasons.isEmpty {
            let token = UUID().uuidString.lowercased()
            let recordingPath = resolveCurrentAgentRecordingPath()
            let session = AgentPreflightSession(
                token: token,
                createdAt: Date(),
                runtimeBudgetMinutes: runtimeBudgetMinutes,
                transcriptionProvider: transcriptionProvider,
                importedTranscriptPath: normalizedImportedTranscriptPath,
                projectPath: currentProjectURL?.path,
                recordingPath: recordingPath
            )
            agentPreflightSessions[token] = session
            preflightToken = token
        } else {
            preflightToken = nil
        }

        return .success(
            id: id,
            result: .object([
                "ready": .bool(blockingReasons.isEmpty),
                "blockingReasons": .array(blockingReasons.map { .string($0.rawValue) }),
                "canApplyDestructive": .bool(hasUnsavedProjectChanges),
                "transcriptionProvider": .string(transcriptionProvider.rawValue),
                "preflightToken": preflightToken.map { .string($0) } ?? .null
            ])
        )
    }

    func agentRunResponse(id: String, params: [String: JSONValue]) async -> EngineResponse {
        let preflightToken = params["preflightToken"]?.stringValue ?? ""
        let runtimeBudgetMinutes = params["runtimeBudgetMinutes"]?.intValue ?? maxAgentRuntimeBudgetMinutes
        let forceRequested = params["force"]?.boolValue ?? false
        let transcriptionProvider = transcriptionProvider(from: params)
        let importedTranscriptPath = params["importedTranscriptPath"]?.stringValue
        let normalizedImportedTranscriptPath = importedTranscriptPath?.isEmpty == true ? nil : importedTranscriptPath

        if let preflightValidationFailure = validatePreflightToken(
            id: id,
            token: preflightToken,
            runtimeBudgetMinutes: runtimeBudgetMinutes,
            transcriptionProvider: transcriptionProvider,
            importedTranscriptPath: normalizedImportedTranscriptPath
        ) {
            return preflightValidationFailure
        }

        if let validationFailure = validateAgentRunSettings(
            id: id,
            runtimeBudgetMinutes: runtimeBudgetMinutes,
            forceRequested: forceRequested
        ) {
            return validationFailure
        }

        guard let projectURL = currentProjectURL else {
            return .failure(
                id: id,
                code: "invalid_params",
                message: "Open or save a project package before running Agent Mode."
            )
        }

        guard let recordingURL = resolveAgentRecordingURL(in: projectURL) else {
            return .failure(
                id: id,
                code: "invalid_params",
                message: "No project recording is available for Agent Mode."
            )
        }

        do {
            let durationSeconds = try await validatedAgentRunDuration(for: recordingURL)
            let jobID = UUID().uuidString.lowercased()
            let reasons = await runBlockingReasons(
                durationSeconds: durationSeconds,
                runtimeBudgetMinutes: runtimeBudgetMinutes,
                recordingURL: recordingURL,
                transcriptionProvider: transcriptionProvider,
                importedTranscriptPath: normalizedImportedTranscriptPath
            )

            if let fatalResponse = agentRunFatalFailure(id: id, reasons: reasons) {
                return fatalResponse
            }

            if let blockedReason = firstNarrativeBlockingReason(in: reasons) {
                let output = makeBlockedPipelineOutput(
                    jobID: jobID,
                    durationSeconds: durationSeconds,
                    sourceFPS: defaultAgentSourceFPS
                )
                let runSummary = try writeAgentArtifacts(
                    jobId: jobID,
                    recordingURL: recordingURL,
                    runtimeBudgetMinutes: runtimeBudgetMinutes,
                    output: output,
                    projectURL: projectURL,
                    blockingReason: blockedReason
                )
                return persistAgentRunResponse(id: id, runSummary: runSummary)
            }

            let runSummary = try executeAgentPipeline(
                jobID: jobID,
                recordingURL: recordingURL,
                durationSeconds: durationSeconds,
                runtimeBudgetMinutes: runtimeBudgetMinutes,
                projectURL: projectURL,
                forceRequested: forceRequested,
                transcriptionProvider: transcriptionProvider,
                importedTranscriptPath: normalizedImportedTranscriptPath
            )
            return persistAgentRunResponse(id: id, runSummary: runSummary)
        } catch let error as AgentModeError {
            return .failure(id: id, code: error.code, message: error.message)
        } catch {
            return .failure(id: id, code: "runtime_error", message: error.localizedDescription)
        }
    }

    private func validateAgentRunSettings(
        id: String,
        runtimeBudgetMinutes: Int,
        forceRequested: Bool
    ) -> EngineResponse? {
        guard runtimeBudgetMinutes > 0, runtimeBudgetMinutes <= maxAgentRuntimeBudgetMinutes else {
            return .failure(
                id: id,
                code: "invalid_params",
                message: "runtimeBudgetMinutes must be between 1 and \(maxAgentRuntimeBudgetMinutes)"
            )
        }

        guard !forceRequested || allowsForceNarrativeOverride() else {
            return .failure(
                id: id,
                code: "invalid_params",
                message: "force is disabled for production runs. Set GG_AGENT_ALLOW_FORCE=1 for local debugging."
            )
        }

        return nil
    }

    private func resolveCurrentAgentRecordingPath() -> String? {
        guard let projectURL = currentProjectURL else { return nil }
        return resolveAgentRecordingURL(in: projectURL)?.path
    }

    private func validatePreflightToken(
        id: String,
        token: String,
        runtimeBudgetMinutes: Int,
        transcriptionProvider: AgentTranscriptionProvider,
        importedTranscriptPath: String?
    ) -> EngineResponse? {
        guard !token.isEmpty else {
            return .failure(
                id: id,
                code: "invalid_params",
                message: "agent.preflight must be called first. preflightToken is required."
            )
        }

        guard let session = agentPreflightSessions[token] else {
            return .failure(
                id: id,
                code: "invalid_params",
                message: "preflightToken is missing or expired. Run agent.preflight again."
            )
        }

        if Date().timeIntervalSince(session.createdAt) > agentPreflightTokenTTLSeconds {
            agentPreflightSessions.removeValue(forKey: token)
            return .failure(
                id: id,
                code: "invalid_params",
                message: "preflightToken expired. Run agent.preflight again."
            )
        }

        let importedPath = importedTranscriptPath?.isEmpty == true ? nil : importedTranscriptPath
        let matches = session.token == token &&
            session.runtimeBudgetMinutes == runtimeBudgetMinutes &&
            session.transcriptionProvider == transcriptionProvider &&
            session.importedTranscriptPath == importedPath &&
            session.projectPath == currentProjectURL?.path &&
            session.recordingPath == resolveCurrentAgentRecordingPath()
        guard matches else {
            agentPreflightSessions.removeValue(forKey: token)
            return .failure(
                id: id,
                code: "invalid_params",
                message: "preflightToken does not match current run parameters. Run agent.preflight again."
            )
        }

        agentPreflightSessions.removeValue(forKey: token)
        return nil
    }

    private func validatedAgentRunDuration(for recordingURL: URL) async throws -> Double {
        let duration: Double
        do {
            duration = try await recordingDuration(for: recordingURL)
        } catch {
            throw AgentModeError.invalidParams("Recording cannot be opened for Agent Mode analysis.")
        }

        guard duration > 0 else {
            throw AgentModeError.invalidParams("Recording duration must be greater than zero.")
        }
        guard duration <= maxAgentSourceDurationSeconds else {
            throw AgentModeError.invalidParams("Agent Mode v1 supports recordings up to 10 minutes.")
        }
        return duration
    }

    private func executeAgentPipeline(
        jobID: String,
        recordingURL: URL,
        durationSeconds: Double,
        runtimeBudgetMinutes: Int,
        projectURL: URL,
        forceRequested: Bool,
        transcriptionProvider: AgentTranscriptionProvider,
        importedTranscriptPath: String?
    ) throws -> AgentRunSummaryDocument {
        let provider = makeTranscriptionProvider(kind: transcriptionProvider, importedTranscriptPath: importedTranscriptPath)
        let pipeline = DeterministicLocalAgentPipelineService(
            input: AgentPipelineInput(
                jobId: jobID,
                durationSeconds: durationSeconds,
                sourceFPS: defaultAgentSourceFPS,
                forceNarrativeCompletion: forceRequested,
                transcriptionProvider: provider
            )
        )

        let pipelineOutput = try pipeline.run()
        let blockingReason = resolvePipelineBlockingReason(
            qaReport: pipelineOutput.qaReport,
            words: pipelineOutput.words
        )
        let output = if blockingReason == .emptyTranscript {
            makeBlockedPipelineOutput(
                jobID: jobID,
                durationSeconds: durationSeconds,
                sourceFPS: defaultAgentSourceFPS
            )
        } else {
            pipelineOutput
        }

        return try writeAgentArtifacts(
            jobId: jobID,
            recordingURL: recordingURL,
            runtimeBudgetMinutes: runtimeBudgetMinutes,
            output: output,
            projectURL: projectURL,
            blockingReason: blockingReason
        )
    }

    private func resolvePipelineBlockingReason(
        qaReport: AgentQAReport,
        words: [TranscriptWord]
    ) -> AgentBlockingReason? {
        if words.isEmpty {
            return .emptyTranscript
        }
        if qaReport.passed {
            return nil
        }
        return .weakNarrativeStructure
    }

    private func persistAgentRunResponse(id: String, runSummary: AgentRunSummaryDocument) -> EngineResponse {
        upsertAgentRunSummaryPointer(
            jobId: runSummary.jobId,
            runSummaryPath: artifactPath(fileName: ProjectFile.runSummaryV1JSON)
        )
        hasUnsavedProjectChanges = true

        return .success(
            id: id,
            result: .object([
                "jobId": .string(runSummary.jobId),
                "status": .string(runSummary.status.rawValue)
            ])
        )
    }

    func agentStatusResponse(id: String, params: [String: JSONValue]) -> EngineResponse {
        guard let jobID = params["jobId"]?.stringValue, !jobID.isEmpty else {
            return .failure(id: id, code: "invalid_params", message: "jobId is required")
        }

        do {
            let runSummary = try loadAgentRunSummary(for: jobID)
            return .success(
                id: id,
                result: .object([
                    "jobId": .string(runSummary.jobId),
                    "status": .string(runSummary.status.rawValue),
                    "runtimeBudgetMinutes": .number(Double(runSummary.runtimeBudgetMinutes)),
                    "qaReport": qaReportJSON(from: runSummary.qaReport),
                    "blockingReason": runSummary.blockingReason.map { .string($0) } ?? .null,
                    "updatedAt": .string(runSummary.updatedAt)
                ])
            )
        } catch let error as AgentModeError {
            return .failure(id: id, code: error.code, message: error.message)
        } catch {
            return .failure(id: id, code: "runtime_error", message: error.localizedDescription)
        }
    }

    func agentApplyResponse(id: String, params: [String: JSONValue]) -> EngineResponse {
        guard let jobID = params["jobId"]?.stringValue, !jobID.isEmpty else {
            return .failure(id: id, code: "invalid_params", message: "jobId is required")
        }
        let destructiveIntent = params["destructiveIntent"]?.boolValue ?? false

        do {
            let execution = try resolveCutPlanExecution(
                jobID: jobID,
                requireDestructiveConfirmation: true,
                destructiveIntent: destructiveIntent
            )
            upsertAgentRunSummaryPointer(
                jobId: execution.runSummary.jobId,
                runSummaryPath: artifactPath(fileName: ProjectFile.runSummaryV1JSON),
                latestAppliedRunID: execution.runSummary.jobId
            )
            hasUnsavedProjectChanges = true

            return .success(
                id: id,
                result: .object([
                    "success": .bool(true),
                    "message": .string("Applied cut plan with \(execution.segmentCount) frame-segment(s).")
                ])
            )
        } catch let error as AgentModeError {
            return .failure(id: id, code: error.code, message: error.message)
        } catch {
            return .failure(id: id, code: "runtime_error", message: error.localizedDescription)
        }
    }

    func validatedCutPlanExecutionForJob(jobID: String) throws -> ValidatedCutPlanExecution {
        try resolveCutPlanExecution(jobID: jobID, requireDestructiveConfirmation: false, destructiveIntent: true)
    }

    func resolveAgentRecordingURL(in projectURL: URL) -> URL? {
        if let recordingURL = captureEngine.recordingURL, FileManager.default.fileExists(atPath: recordingURL.path) {
            return recordingURL
        }

        let projectRecordingURL = projectURL.appendingPathComponent(currentProjectDocument.recordingFileName)
        if FileManager.default.fileExists(atPath: projectRecordingURL.path) {
            return projectRecordingURL
        }
        return nil
    }

    func latestAgentRunSummary() -> AgentRunSummaryDocument? {
        guard let analysis = currentProjectDocument.project.agentAnalysis,
              let runSummaryPath = analysis.latestRunSummaryPath,
              let projectURL = currentProjectURL
        else {
            return nil
        }

        let summaryURL = projectURL.appendingPathComponent(runSummaryPath)
        guard let data = try? Data(contentsOf: summaryURL) else { return nil }
        let decoder = JSONDecoder()
        return try? decoder.decode(AgentRunSummaryDocument.self, from: data)
    }

    private func resolveCutPlanExecution(
        jobID: String,
        requireDestructiveConfirmation: Bool,
        destructiveIntent: Bool
    ) throws -> ValidatedCutPlanExecution {
        let runSummary = try loadAgentRunSummary(for: jobID)
        guard runSummary.qaReport?.passed == true else {
            throw AgentModeError.qaFailed("Narrative QA failed. Run Agent Mode again before apply/export.")
        }
        if requireDestructiveConfirmation, hasUnsavedProjectChanges, !destructiveIntent {
            throw AgentModeError.needsConfirmation(
                "Unsaved project changes detected. Retry with destructiveIntent=true to continue."
            )
        }

        let projectURL = try requireCurrentProjectURL()
        let cutPlan = try loadCutPlan(from: runSummary, projectURL: projectURL)
        guard let firstSegment = cutPlan.segments.first,
              let lastSegment = cutPlan.segments.last
        else {
            throw AgentModeError.invalidCutPlan("Cut plan contains no segments.")
        }

        return ValidatedCutPlanExecution(
            runSummary: runSummary,
            segmentCount: cutPlan.segments.count,
            startFrame: firstSegment.startFrame,
            endFrame: lastSegment.endFrame,
            startSeconds: Double(firstSegment.startFrame) / cutPlan.sourceFPS,
            endSeconds: Double(lastSegment.endFrame) / cutPlan.sourceFPS
        )
    }

    private func upsertAgentRunSummaryPointer(
        jobId: String,
        runSummaryPath: String,
        latestAppliedRunID: String? = nil
    ) {
        var analysis = currentProjectDocument.project.agentAnalysis ?? AgentAnalysisMetadata()
        analysis.latestRunID = jobId
        analysis.latestRunSummaryPath = runSummaryPath
        if let latestAppliedRunID {
            analysis.latestAppliedRunID = latestAppliedRunID
        }
        currentProjectDocument.project.agentAnalysis = analysis
    }

    private func makeBlockedPipelineOutput(
        jobID: String,
        durationSeconds: Double,
        sourceFPS: Double
    ) -> AgentPipelineOutput {
        AgentPipelineOutput(
            transcriptSegments: [],
            words: [],
            beatMap: [],
            qaReport: AgentQAReport(
                passed: false,
                score: 0,
                coverage: AgentQACoverage(hook: false, action: false, payoff: false, takeaway: false),
                missingBeats: NarrativeBeatKind.allCases.map(\.rawValue)
            ),
            cutPlan: AgentCutPlanDocument(
                schemaVersion: 1,
                jobId: jobID,
                sourceDurationSeconds: durationSeconds,
                sourceFPS: sourceFPS,
                segments: []
            )
        )
    }

    private func preflightBlockingReasons(
        runtimeBudgetMinutes: Int,
        transcriptionProvider: AgentTranscriptionProvider,
        importedTranscriptPath: String?
    ) async -> [AgentBlockingReason] {
        var reasons: [AgentBlockingReason] = []

        if runtimeBudgetMinutes < 1 || runtimeBudgetMinutes > maxAgentRuntimeBudgetMinutes {
            reasons.append(.invalidRuntimeBudget)
        }

        guard let projectURL = currentProjectURL else {
            reasons.append(.missingProject)
            return reasons
        }

        guard let recordingURL = resolveAgentRecordingURL(in: projectURL) else {
            reasons.append(.missingRecording)
            return reasons
        }

        let durationSeconds: Double
        do {
            durationSeconds = try await recordingDuration(for: recordingURL)
        } catch {
            reasons.append(.sourceDurationInvalid)
            return reasons
        }

        guard durationSeconds > 0 else {
            reasons.append(.sourceDurationInvalid)
            return reasons
        }

        if durationSeconds > maxAgentSourceDurationSeconds {
            reasons.append(.sourceTooLong)
        }

        if let audioReason = try? await detectAudioBlockingReason(
            for: recordingURL,
            durationSeconds: durationSeconds
        ) {
            reasons.append(audioReason)
        }

        switch transcriptionProvider {
        case .none:
            reasons.append(.missingLocalModel)
        case .importedTranscript:
            guard let importedTranscriptPath, !importedTranscriptPath.isEmpty else {
                reasons.append(.missingImportedTranscript)
                return uniqueBlockingReasons(reasons)
            }
            let provider = makeTranscriptionProvider(
                kind: .importedTranscript,
                importedTranscriptPath: importedTranscriptPath
            )
            do {
                let transcript = try provider.transcribe(durationSeconds: durationSeconds)
                if transcript.words.isEmpty {
                    reasons.append(.emptyTranscript)
                }
            } catch {
                reasons.append(.invalidImportedTranscript)
            }
        }

        return uniqueBlockingReasons(reasons)
    }

    private func runBlockingReasons(
        durationSeconds: Double,
        runtimeBudgetMinutes: Int,
        recordingURL: URL,
        transcriptionProvider: AgentTranscriptionProvider,
        importedTranscriptPath: String?
    ) async -> [AgentBlockingReason] {
        var reasons: [AgentBlockingReason] = []

        if runtimeBudgetMinutes < 1 || runtimeBudgetMinutes > maxAgentRuntimeBudgetMinutes {
            reasons.append(.invalidRuntimeBudget)
        }

        if durationSeconds <= 0 {
            reasons.append(.sourceDurationInvalid)
        } else if durationSeconds > maxAgentSourceDurationSeconds {
            reasons.append(.sourceTooLong)
        }

        if let audioReason = try? await detectAudioBlockingReason(
            for: recordingURL,
            durationSeconds: durationSeconds
        ) {
            reasons.append(audioReason)
        }

        switch transcriptionProvider {
        case .none:
            reasons.append(.missingLocalModel)
        case .importedTranscript:
            guard let importedTranscriptPath, !importedTranscriptPath.isEmpty else {
                reasons.append(.missingImportedTranscript)
                return uniqueBlockingReasons(reasons)
            }
            let provider = makeTranscriptionProvider(
                kind: .importedTranscript,
                importedTranscriptPath: importedTranscriptPath
            )
            do {
                let transcript = try provider.transcribe(durationSeconds: durationSeconds)
                if transcript.words.isEmpty {
                    reasons.append(.emptyTranscript)
                }
            } catch {
                reasons.append(.invalidImportedTranscript)
            }
        }

        return uniqueBlockingReasons(reasons)
    }

    private func uniqueBlockingReasons(_ reasons: [AgentBlockingReason]) -> [AgentBlockingReason] {
        var seen = Set<String>()
        return reasons.filter { reason in
            seen.insert(reason.rawValue).inserted
        }
    }

    private func firstNarrativeBlockingReason(in reasons: [AgentBlockingReason]) -> AgentBlockingReason? {
        reasons.first { $0 == .noAudioTrack || $0 == .silentAudio || $0 == .emptyTranscript }
    }

    private func agentRunFatalFailure(id: String, reasons: [AgentBlockingReason]) -> EngineResponse? {
        let fatalReasons = reasons.filter { reason in
            switch reason {
            case .noAudioTrack, .silentAudio, .emptyTranscript:
                false
            default:
                true
            }
        }

        guard let first = fatalReasons.first else {
            return nil
        }

        if first == .missingLocalModel {
            return .failure(
                id: id,
                code: "missing_local_model",
                message: blockingReasonMessage(first)
            )
        }

        return .failure(id: id, code: "invalid_params", message: blockingReasonMessage(first))
    }

    private func blockingReasonMessage(_ reason: AgentBlockingReason) -> String {
        switch reason {
        case .missingProject:
            "Open or save a project package before running Agent Mode."
        case .missingRecording:
            "No project recording is available for Agent Mode."
        case .invalidRuntimeBudget:
            "runtimeBudgetMinutes must be between 1 and \(maxAgentRuntimeBudgetMinutes)."
        case .sourceTooLong:
            "Agent Mode v1 supports recordings up to 10 minutes."
        case .sourceDurationInvalid:
            "Recording duration must be greater than zero."
        case .missingLocalModel:
            "No local transcription engine is configured."
        case .missingImportedTranscript:
            "importedTranscriptPath is required for imported_transcript."
        case .invalidImportedTranscript:
            "Imported transcript is missing or invalid."
        case .noAudioTrack:
            "Recording has no audio track."
        case .silentAudio:
            "Recording audio track appears silent."
        case .emptyTranscript:
            "Transcript contains no timed words."
        case .weakNarrativeStructure:
            "Transcript coverage is missing required narrative beats (hook, action, payoff, takeaway)."
        }
    }

    private func transcriptionProvider(from params: [String: JSONValue]) -> AgentTranscriptionProvider {
        switch params["transcriptionProvider"]?.stringValue {
        case AgentTranscriptionProvider.importedTranscript.rawValue:
            .importedTranscript
        default:
            .none
        }
    }

    private func detectAudioBlockingReason(
        for recordingURL: URL,
        durationSeconds: Double
    ) async throws -> AgentBlockingReason? {
        let asset = AVAsset(url: recordingURL)
        let audioTracks = try await asset.loadTracks(withMediaType: .audio)
        guard let audioTrack = audioTracks.first else {
            return .noAudioTrack
        }

        let scanWindow = min(durationSeconds, audioEnergyScanWindowSeconds)
        let hasEnergy = (try? detectAudioEnergy(
            in: asset,
            track: audioTrack,
            scanWindowSeconds: scanWindow
        )) ?? true
        return hasEnergy ? nil : .silentAudio
    }

    private func detectAudioEnergy(
        in asset: AVAsset,
        track: AVAssetTrack,
        scanWindowSeconds: Double
    ) throws -> Bool {
        let reader = try AVAssetReader(asset: asset)
        let settings: [String: Any] = [
            AVFormatIDKey: kAudioFormatLinearPCM,
            AVLinearPCMBitDepthKey: 32,
            AVLinearPCMIsFloatKey: true,
            AVLinearPCMIsBigEndianKey: false,
            AVLinearPCMIsNonInterleaved: false
        ]
        let output = AVAssetReaderTrackOutput(track: track, outputSettings: settings)
        output.alwaysCopiesSampleData = false
        guard reader.canAdd(output) else {
            throw AgentModeError.runtime("Audio analysis setup failed for Agent Mode.")
        }
        reader.add(output)

        let effectiveWindowSeconds = max(0.1, scanWindowSeconds)
        reader.timeRange = CMTimeRange(
            start: .zero,
            duration: CMTime(seconds: effectiveWindowSeconds, preferredTimescale: 600)
        )
        guard reader.startReading() else {
            throw AgentModeError.runtime("Audio analysis could not start for Agent Mode.")
        }

        var peak: Float = 0
        while let sampleBuffer = output.copyNextSampleBuffer() {
            guard let blockBuffer = CMSampleBufferGetDataBuffer(sampleBuffer) else { continue }
            let length = CMBlockBufferGetDataLength(blockBuffer)
            guard length > 0 else { continue }

            var data = Data(count: length)
            data.withUnsafeMutableBytes { rawBuffer in
                guard let baseAddress = rawBuffer.baseAddress else { return }
                _ = CMBlockBufferCopyDataBytes(
                    blockBuffer,
                    atOffset: 0,
                    dataLength: length,
                    destination: baseAddress
                )
            }

            data.withUnsafeBytes { rawBuffer in
                let floatSamples = rawBuffer.bindMemory(to: Float.self)
                for sample in floatSamples {
                    let absSample = abs(sample)
                    if absSample > peak {
                        peak = absSample
                    }
                }
            }

            if peak >= audioEnergyPeakThreshold {
                return true
            }
        }

        if reader.status == .failed {
            throw AgentModeError.runtime("Audio analysis failed during Agent Mode preflight.")
        }
        return peak >= audioEnergyPeakThreshold
    }

    private func writeAgentArtifacts(
        jobId: String,
        recordingURL: URL,
        runtimeBudgetMinutes: Int,
        output: AgentPipelineOutput,
        projectURL: URL,
        blockingReason: AgentBlockingReason?
    ) throws -> AgentRunSummaryDocument {
        let fileManager = FileManager.default
        let analysisDirectoryURL = projectURL.appendingPathComponent(ProjectFile.analysisDirectory, isDirectory: true)
        try fileManager.createDirectory(at: analysisDirectoryURL, withIntermediateDirectories: true)

        let transcriptFullPath = try writeAgentArtifact(
            TranscriptFullDocument(
                schemaVersion: 1,
                jobId: jobId,
                recordingURL: recordingURL.path,
                durationSeconds: output.cutPlan.sourceDurationSeconds,
                segments: output.transcriptSegments
            ),
            fileName: ProjectFile.transcriptFullV1JSON,
            projectURL: projectURL
        )

        let transcriptWordsPath = try writeAgentArtifact(
            TranscriptWordsDocument(
                schemaVersion: 1,
                jobId: jobId,
                durationSeconds: output.cutPlan.sourceDurationSeconds,
                words: output.words
            ),
            fileName: ProjectFile.transcriptWordsV1JSON,
            projectURL: projectURL
        )

        let beatMapPath = try writeAgentArtifact(
            BeatMapDocument(schemaVersion: 1, jobId: jobId, beats: output.beatMap),
            fileName: ProjectFile.beatMapV1JSON,
            projectURL: projectURL
        )

        let qaReportPath = try writeAgentArtifact(
            QAReportDocument(
                schemaVersion: 1,
                jobId: jobId,
                passed: output.qaReport.passed,
                score: output.qaReport.score,
                coverage: output.qaReport.coverage,
                missingBeats: output.qaReport.missingBeats,
                blockingReason: blockingReason?.rawValue
            ),
            fileName: ProjectFile.qaReportV1JSON,
            projectURL: projectURL
        )

        let cutPlanPath = try writeAgentArtifact(
            output.cutPlan,
            fileName: ProjectFile.cutPlanV1JSON,
            projectURL: projectURL
        )

        let runSummaryPath = artifactPath(fileName: ProjectFile.runSummaryV1JSON)
        let isBlocked = blockingReason != nil || !output.qaReport.passed
        let status: AgentJobStatus = isBlocked ? .blocked : .completed

        let runSummary = AgentRunSummaryDocument(
            schemaVersion: 1,
            jobId: jobId,
            status: status,
            runtimeBudgetMinutes: runtimeBudgetMinutes,
            qaReport: output.qaReport,
            blockingReason: blockingReason?.rawValue,
            artifacts: [
                AgentArtifactReference(kind: .transcriptFullV1, path: transcriptFullPath),
                AgentArtifactReference(kind: .transcriptWordsV1, path: transcriptWordsPath),
                AgentArtifactReference(kind: .beatMapV1, path: beatMapPath),
                AgentArtifactReference(kind: .qaReportV1, path: qaReportPath),
                AgentArtifactReference(kind: .cutPlanV1, path: cutPlanPath),
                AgentArtifactReference(kind: .runSummaryV1, path: runSummaryPath)
            ],
            updatedAt: agentISO8601String(from: Date())
        )

        try writeAgentRunSummary(runSummary, projectURL: projectURL)
        return runSummary
    }

    private func writeAgentRunSummary(_ summary: AgentRunSummaryDocument, projectURL: URL) throws {
        let outputURL = projectURL.appendingPathComponent(artifactPath(fileName: ProjectFile.runSummaryV1JSON))
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let data = try encoder.encode(summary)
        try data.write(to: outputURL, options: [.atomic])
    }

    private func writeAgentArtifact(
        _ payload: some Encodable,
        fileName: String,
        projectURL: URL
    ) throws -> String {
        let relativePath = artifactPath(fileName: fileName)
        let outputURL = projectURL.appendingPathComponent(relativePath)
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let data = try encoder.encode(payload)
        try data.write(to: outputURL, options: [.atomic])
        return relativePath
    }

    private func artifactPath(fileName: String) -> String {
        "\(ProjectFile.analysisDirectory)/\(fileName)"
    }

    private func loadAgentRunSummary(for jobID: String) throws -> AgentRunSummaryDocument {
        let projectURL = try requireCurrentProjectURL()
        let analysis = currentProjectDocument.project.agentAnalysis ?? AgentAnalysisMetadata()

        let runSummaryPath: String? = {
            if analysis.latestRunID == jobID {
                return analysis.latestRunSummaryPath
            }
            return analysis.legacyRuns
                .first(where: { $0.id == jobID })?
                .artifacts
                .first(where: { $0.kind == .runSummaryV1 })?
                .path
        }()

        guard let runSummaryPath else {
            throw AgentModeError.invalidParams("Unknown jobId: \(jobID)")
        }

        let summaryURL = projectURL.appendingPathComponent(runSummaryPath)
        guard FileManager.default.fileExists(atPath: summaryURL.path) else {
            throw AgentModeError.invalidParams("Unknown jobId: \(jobID)")
        }

        let data = try Data(contentsOf: summaryURL)
        let decoder = JSONDecoder()
        let runSummary = try decoder.decode(AgentRunSummaryDocument.self, from: data)
        guard runSummary.jobId == jobID else {
            throw AgentModeError.invalidParams("Unknown jobId: \(jobID)")
        }
        return runSummary
    }

    private func loadCutPlan(from runSummary: AgentRunSummaryDocument, projectURL: URL) throws -> AgentCutPlanDocument {
        guard let cutPlanArtifact = runSummary.artifacts.first(where: { $0.kind == .cutPlanV1 }) else {
            throw AgentModeError.invalidCutPlan("Cut plan artifact not found.")
        }
        let cutPlanURL = projectURL.appendingPathComponent(cutPlanArtifact.path)
        let data = try Data(contentsOf: cutPlanURL)
        let decoder = JSONDecoder()
        let cutPlan = try decoder.decode(AgentCutPlanDocument.self, from: data)

        guard cutPlan.jobId == runSummary.jobId else {
            throw AgentModeError.invalidCutPlan("Cut plan jobId mismatch.")
        }
        guard validate(cutPlan: cutPlan) else {
            throw AgentModeError.invalidCutPlan("Cut plan has invalid frame ranges.")
        }
        return cutPlan
    }

    private func validate(cutPlan: AgentCutPlanDocument) -> Bool {
        guard cutPlan.sourceFPS > 0 else { return false }
        guard !cutPlan.segments.isEmpty else { return false }

        let maxFrame = max(1, Int64((cutPlan.sourceDurationSeconds * cutPlan.sourceFPS).rounded(.up)))
        var previousEnd: Int64 = -1
        for segment in cutPlan.segments {
            guard segment.startFrame >= 0 else { return false }
            guard segment.endFrame > segment.startFrame else { return false }
            guard segment.startFrame >= previousEnd else { return false }
            guard segment.endFrame <= maxFrame else { return false }
            previousEnd = segment.endFrame
        }
        return true
    }

    private func qaReportJSON(from report: AgentQAReport?) -> JSONValue {
        guard let report else { return .null }
        return .object([
            "passed": .bool(report.passed),
            "score": .number(report.score),
            "coverage": .object([
                "hook": .bool(report.coverage.hook),
                "action": .bool(report.coverage.action),
                "payoff": .bool(report.coverage.payoff),
                "takeaway": .bool(report.coverage.takeaway)
            ]),
            "missingBeats": .array(report.missingBeats.map { .string($0) })
        ])
    }

    private func requireCurrentProjectURL() throws -> URL {
        guard let projectURL = currentProjectURL else {
            throw AgentModeError.invalidParams("No active project is open.")
        }
        return projectURL
    }

    private func allowsForceNarrativeOverride() -> Bool {
        ProcessInfo.processInfo.environment["GG_AGENT_ALLOW_FORCE"] == "1"
    }

    private func agentISO8601String(from date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: date)
    }
}
