import AVFoundation
import CryptoKit
import EngineProtocol
import Foundation
import Project

private let agentPreflightTTLSeconds: TimeInterval = 60
private let agentMaximumSourceDurationSeconds: Double = 10 * 60

extension EngineService {
    func agent_period_agentPreflight(
        _ input: Operations.agent_period_agentPreflight.Input
    ) async throws -> Operations.agent_period_agentPreflight.Output {
        let payload: Components.Schemas.AgentPreflightPayload = switch input.body { case let .json(body): body }
        let runtimeBudgetMinutes = Int(payload.runtimeBudgetMinutes?.value1 ?? 10)
        let provider = payload.transcriptionProvider?.rawValue ?? "none"
        let transcriptPath = payload.importedTranscriptPath?.value1
        var reasons: [String] = []

        let projectURL = currentProjectURL
        let recordingURL = availableAgentRecordingURL()
        let projectContext = recordingURL.flatMap(agentProjectContext)
        if projectURL == nil {
            reasons.append("missing_project")
        }
        if recordingURL == nil {
            reasons.append("missing_recording")
        }
        if !(1 ... 10).contains(runtimeBudgetMinutes) {
            reasons.append("invalid_runtime_budget")
        }
        var transcriptData: Data?
        switch provider {
        case "imported_transcript":
            if transcriptPath?.isEmpty ?? true {
                reasons.append("missing_imported_transcript")
            } else {
                transcriptData = try? readAgentTranscript(path: transcriptPath!)
                if transcriptData == nil {
                    reasons.append("invalid_imported_transcript")
                }
            }
        default:
            reasons.append("missing_local_model")
        }

        var sourceRevision: String?
        if reasons.isEmpty, let recordingURL {
            do {
                let source = try await agentSource(recordingURL: recordingURL)
                guard let projectContext, matchesAgentProjectContext(projectContext) else {
                    reasons.append("source_duration_invalid")
                    return .ok(.init(body: .json(preflightResult(
                        reasons: reasons,
                        provider: provider,
                        token: nil,
                        expiresAt: nil
                    ))))
                }
                sourceRevision = source.revision
                if source.duration > agentMaximumSourceDurationSeconds {
                    reasons.append("source_too_long")
                } else if provider == "imported_transcript",
                          let transcriptData,
                          (try? ImportedTranscriptAgentPlanner.plan(
                              data: transcriptData,
                              sourceDuration: source.duration,
                              sourceFps: source.fps
                          )) == nil
                {
                    reasons.append("invalid_imported_transcript")
                }
            } catch {
                reasons.append("source_duration_invalid")
            }
        }

        var token: String?
        var expiresAt: Date?
        if reasons.isEmpty, let projectURL, let recordingURL, let projectContext,
           matchesAgentProjectContext(projectContext), let sourceRevision, let transcriptData
        {
            let value = "macos-preflight-\(UUID().uuidString)"
            let createdAt = Date()
            let expiry = createdAt.addingTimeInterval(agentPreflightTTLSeconds)
            preflightSessions[value] = EngineAgentPreflightSession(
                token: value,
                runtimeBudgetMinutes: runtimeBudgetMinutes,
                transcriptionProvider: provider,
                importedTranscriptPath: transcriptPath,
                importedTranscriptData: transcriptData,
                projectId: currentProjectDocument.project.id,
                projectPath: projectURL.path,
                recordingURL: recordingURL.path,
                recordingRevision: sourceRevision,
                baseTimeline: currentProjectDocument.project.timeline,
                requiresDestructiveConfirmation: hasUnsavedProjectChanges,
                createdAt: createdAt
            )
            token = value
            expiresAt = expiry
        }
        return .ok(.init(body: .json(preflightResult(
            reasons: reasons,
            provider: provider,
            token: token,
            expiresAt: expiresAt
        ))))
    }

    // swiftlint:disable:next function_body_length
    func agent_period_agentRun(
        _ input: Operations.agent_period_agentRun.Input
    ) async throws -> Operations.agent_period_agentRun.Output {
        let payload: Components.Schemas.AgentRunPayload = switch input.body { case let .json(body): body }
        let runtimeBudgetMinutes = Int(payload.runtimeBudgetMinutes?.value1 ?? 10)
        let provider = payload.transcriptionProvider?.rawValue ?? "none"
        let transcriptPath = payload.importedTranscriptPath?.value1
        let session: EngineAgentPreflightSession
        do {
            session = try validatePreflightToken(
                payload.preflightToken.value1,
                runtimeBudgetMinutes: runtimeBudgetMinutes,
                transcriptionProvider: provider,
                importedTranscriptPath: transcriptPath
            )
        } catch PreflightTokenValidationError.expired {
            return .badRequest(.init(body: .json(badRequest(
                .preflight_expired,
                "preflightToken is missing, expired, or already consumed. Run agent.preflight again."
            ))))
        } catch {
            return .badRequest(.init(body: .json(badRequest(
                .preflight_mismatch,
                "preflightToken does not match the active project, recording, or run parameters. Run agent.preflight again."
            ))))
        }
        guard payload.force != true || ProcessInfo.processInfo.environment["GG_AGENT_ALLOW_FORCE"] == "1" else {
            return .badRequest(.init(body: .json(badRequest(
                .invalid_params,
                "force is disabled for production runs. Set GG_AGENT_ALLOW_FORCE=1 for local debugging."
            ))))
        }
        guard let projectURL = currentProjectURL,
              let recordingURL = availableAgentRecordingURL()
        else {
            return .badRequest(.init(body: .json(badRequest(.invalid_request, "Agent Mode inputs are no longer available."))))
        }

        do {
            let transcriptData = session.importedTranscriptData
            let source: AgentSource
            do {
                source = try await agentSource(recordingURL: recordingURL)
            } catch {
                return .badRequest(.init(body: .json(badRequest(
                    .preflight_mismatch,
                    "The recording became unavailable after preflight. Run agent.preflight again."
                ))))
            }
            guard source.revision == session.recordingRevision,
                  currentProjectDocument.project.id == session.projectId,
                  currentProjectURL?.path == session.projectPath,
                  availableAgentRecordingURL()?.path == session.recordingURL
            else {
                return .badRequest(.init(body: .json(badRequest(
                    .preflight_mismatch,
                    "The recording changed after preflight. Run agent.preflight again."
                ))))
            }
            let plannedRun = try ImportedTranscriptAgentPlanner.plan(
                data: transcriptData,
                sourceDuration: source.duration,
                sourceFps: source.fps
            )
            let jobId = "macos-agent-\(UUID().uuidString)"
            let now = Date()
            let status: AgentJobStatus = plannedRun.qaReport.passed ? .completed : .blocked
            let summaryCandidate = AgentRunSummaryArtifact(
                jobId: jobId,
                projectId: session.projectId,
                recordingFileName: currentProjectDocument.recordingFileName,
                recordingRevision: source.revision,
                status: status,
                runtimeBudgetMinutes: runtimeBudgetMinutes,
                qaReport: plannedRun.qaReport,
                artifacts: AgentArtifactStore.references,
                cutPlan: plannedRun.cutPlan,
                baseTimeline: session.baseTimeline,
                requiresDestructiveConfirmation: session.requiresDestructiveConfirmation,
                createdAt: now,
                updatedAt: now
            )
            let summary = try agentArtifactStore.write(
                plannedRun: plannedRun,
                summary: summaryCandidate,
                projectURL: projectURL
            )
            agentRuns = [jobId: EngineAgentRunRecord(summary: summary)]
            agentRecoveryFailureJobId = nil
            latestAgentJobId = jobId
            latestAgentUpdatedAt = isoString(now)
            var document = currentProjectDocument
            document.project.agentAnalysis = AgentAnalysisMetadata(
                latestRunID: jobId,
                latestAppliedRunID: document.project.agentAnalysis?.latestAppliedRunID,
                latestRunSummaryPath: "analysis/\(ProjectFile.runSummaryV1JSON)"
            )
            do {
                currentProjectDocument = try projectStore.writeProject(
                    document: document,
                    assets: .init(),
                    to: projectURL
                )
            } catch {
                // The atomic run summary is canonical and remains recoverable even if this
                // denormalized project.json pointer cannot be refreshed.
                currentProjectDocument = document
            }
            return .ok(.init(body: .json(.init(
                jobId: .init(value1: jobId),
                status: plannedRun.qaReport.passed ? .completed : .blocked
            ))))
        } catch AgentArtifactError.projectMismatch {
            return .conflict(.init(body: .json(conflict(
                .project_mismatch,
                "The project or recording changed while Agent Mode was running."
            ))))
        } catch AgentArtifactError.invalidTranscript {
            return .badRequest(.init(body: .json(badRequest(
                .invalid_params,
                "The imported transcript is invalid."
            ))))
        } catch AgentArtifactError.invalidCutPlan,
            AgentArtifactError.invalidRunSummary,
            AgentArtifactError.unsafeArtifactPath
        {
            return .unprocessableContent(.init(body: .json(unprocessable(
                .invalid_cut_plan,
                "Agent Mode could not commit a safe, valid artifact generation."
            ))))
        } catch {
            return .badRequest(.init(body: .json(badRequest(.invalid_request, error.localizedDescription))))
        }
    }

    func agent_period_agentStatus(
        _ input: Operations.agent_period_agentStatus.Input
    ) async throws -> Operations.agent_period_agentStatus.Output {
        do {
            let run = try await resolvedAgentRun(jobId: input.path.jobId.value1)
            return .ok(.init(body: .json(agentRunSummary(run.summary))))
        } catch AgentRunResolutionError.notFound {
            return .notFound(.init(body: .json(notFound("Unknown Agent Mode job."))))
        } catch AgentRunResolutionError.projectMismatch {
            return .conflict(.init(body: .json(conflict(
                .project_mismatch,
                "Agent Mode job does not match the active project or recording."
            ))))
        } catch {
            return .unprocessableContent(.init(body: .json(unprocessable(
                .invalid_cut_plan,
                "Agent Mode artifacts are missing, unsafe, or invalid."
            ))))
        }
    }

    func agent_period_agentApply(
        _ input: Operations.agent_period_agentApply.Input
    ) async throws -> Operations.agent_period_agentApply.Output {
        let payload: Components.Schemas.AgentApplyPayload = switch input.body { case let .json(body): body }
        let jobId = input.path.jobId.value1
        let run: EngineAgentRunRecord
        do {
            run = try await resolvedAgentRun(jobId: jobId)
        } catch AgentRunResolutionError.notFound {
            return .notFound(.init(body: .json(notFound("Unknown Agent Mode job."))))
        } catch AgentRunResolutionError.projectMismatch {
            return .conflict(.init(body: .json(conflict(
                .project_mismatch,
                "Agent Mode job does not match the active project or recording."
            ))))
        } catch {
            return .unprocessableContent(.init(body: .json(unprocessable(
                .invalid_cut_plan,
                "Agent Mode artifacts are missing, unsafe, or invalid."
            ))))
        }
        guard run.summary.qaReport.passed else {
            return .unprocessableContent(.init(body: .json(unprocessable(.qa_failed, "Narrative QA failed. Apply is blocked."))))
        }
        let timeline: TimelineDocument
        do {
            timeline = try run.summary.cutPlan.timeline()
        } catch {
            return .unprocessableContent(.init(body: .json(unprocessable(.invalid_cut_plan, "Cut plan is missing or invalid."))))
        }
        let timelineChanged = currentProjectDocument.project.timeline != run.summary.baseTimeline
        if run.summary.requiresDestructiveConfirmation || timelineChanged, payload.destructiveIntent != true {
            return .conflict(.init(body: .json(conflict(.needs_confirmation, "The working timeline changed or had unsaved edits. Retry with destructiveIntent=true to apply."))))
        }

        // Apply is explicitly a working-copy mutation. Project persistence remains the save operation.
        currentProjectDocument.project.timeline = timeline
        var metadata = currentProjectDocument.project.agentAnalysis ?? AgentAnalysisMetadata()
        metadata.latestRunID = jobId
        metadata.latestAppliedRunID = jobId
        metadata.latestRunSummaryPath = "analysis/\(ProjectFile.runSummaryV1JSON)"
        currentProjectDocument.project.agentAnalysis = metadata
        hasUnsavedProjectChanges = true
        agentRuns[jobId] = run
        return .ok(.init(body: .json(.init(
            success: true,
            message: .init(value1: "Applied the verified cut plan to the working timeline."),
            jobId: .init(value1: jobId),
            status: .applied,
            appliedSegments: .init(value1: Double(timeline.items.count)),
            projectHasUnsavedChanges: true
        ))))
    }

    enum AgentRunResolutionError: Error {
        case notFound
        case projectMismatch
        case invalidArtifacts
    }

    func resolvedAgentRun(jobId: String) async throws -> EngineAgentRunRecord {
        guard let projectURL = currentProjectURL else {
            throw AgentRunResolutionError.projectMismatch
        }
        let summary: AgentRunSummaryArtifact
        do {
            guard let loaded = try agentArtifactStore.loadLatest(
                projectURL: projectURL,
                projectId: currentProjectDocument.project.id
            ) else { throw AgentRunResolutionError.notFound }
            summary = loaded
        } catch let error as AgentRunResolutionError {
            throw error
        } catch {
            throw AgentRunResolutionError.invalidArtifacts
        }
        guard summary.jobId == jobId else { throw AgentRunResolutionError.notFound }
        let projectId = currentProjectDocument.project.id
        let recordingFileName = currentProjectDocument.recordingFileName
        guard let recordingURL = availableAgentRecordingURL(),
              summary.recordingFileName == recordingFileName,
              let source = try? await agentSource(recordingURL: recordingURL),
              source.revision == summary.recordingRevision,
              currentProjectURL?.path == projectURL.path,
              currentProjectDocument.project.id == projectId,
              currentProjectDocument.recordingFileName == recordingFileName,
              availableAgentRecordingURL()?.path == recordingURL.path
        else { throw AgentRunResolutionError.projectMismatch }
        let run = EngineAgentRunRecord(summary: summary)
        agentRuns = [jobId: run]
        latestAgentJobId = jobId
        latestAgentUpdatedAt = isoString(summary.updatedAt)
        return run
    }

    func restoreAgentRunIfAvailable() async {
        agentRuns.removeAll()
        agentRecoveryFailureJobId = nil
        latestAgentJobId = nil
        latestAgentUpdatedAt = nil
        guard let projectURL = currentProjectURL else { return }
        do {
            guard let summary = try agentArtifactStore.loadLatest(
                projectURL: projectURL,
                projectId: currentProjectDocument.project.id
            ) else { return }
            guard let recordingURL = availableAgentRecordingURL() else {
                throw AgentRunResolutionError.projectMismatch
            }
            let source = try await agentSource(recordingURL: recordingURL)
            guard source.revision == summary.recordingRevision else {
                throw AgentRunResolutionError.projectMismatch
            }
            agentRuns[summary.jobId] = EngineAgentRunRecord(summary: summary)
            latestAgentJobId = summary.jobId
            latestAgentUpdatedAt = isoString(summary.updatedAt)
        } catch {
            agentRecoveryFailureJobId = currentProjectDocument.project.agentAnalysis?.latestRunID
            latestAgentUpdatedAt = isoNow()
        }
    }

    struct AgentProjectContext {
        let projectId: UUID
        let projectPath: String
        let recordingPath: String
    }

    struct AgentSource {
        let duration: Double
        let fps: AgentFrameRate
        let revision: String
    }

    func agentProjectContext(recordingURL: URL) -> AgentProjectContext? {
        guard let projectPath = currentProjectURL?.path else { return nil }
        return AgentProjectContext(
            projectId: currentProjectDocument.project.id,
            projectPath: projectPath,
            recordingPath: recordingURL.path
        )
    }

    func matchesAgentProjectContext(_ context: AgentProjectContext) -> Bool {
        currentProjectDocument.project.id == context.projectId &&
            currentProjectURL?.path == context.projectPath &&
            availableAgentRecordingURL()?.path == context.recordingPath
    }

    func agentSource(recordingURL: URL) async throws -> AgentSource {
        let asset = AVAsset(url: recordingURL)
        let durationTime = try await asset.load(.duration)
        let duration = durationTime.seconds
        guard duration.isFinite, duration > 0 else { throw AgentArtifactError.invalidCutPlan }
        let tracks = try await asset.loadTracks(withMediaType: .video)
        guard let track = tracks.first else { throw AgentArtifactError.invalidCutPlan }
        let minimumFrameDuration = try await track.load(.minFrameDuration)
        let fps: AgentFrameRate
        if minimumFrameDuration.isValid,
           minimumFrameDuration.value > 0,
           minimumFrameDuration.timescale > 0
        {
            fps = AgentFrameRate(
                numerator: Int(minimumFrameDuration.timescale),
                denominator: Int(minimumFrameDuration.value)
            )
        } else {
            let nominalFrameRate = try await track.load(.nominalFrameRate)
            fps = rationalFrameRate(from: Double(nominalFrameRate))
        }
        let attributes = try FileManager.default.attributesOfItem(atPath: recordingURL.path)
        let fileSize = (attributes[.size] as? NSNumber)?.uint64Value ?? 0
        let descriptor = [
            String(fileSize),
            String(durationTime.value),
            String(durationTime.timescale),
            String(fps.numerator),
            String(fps.denominator),
        ].joined(separator: ":")
        let revision = try recordingRevision(
            recordingURL: recordingURL,
            fileSize: fileSize,
            descriptor: descriptor
        )
        return AgentSource(duration: duration, fps: fps, revision: revision)
    }

    private func rationalFrameRate(from nominal: Double) -> AgentFrameRate {
        let ntscRates: [(value: Double, numerator: Int)] = [
            (23.976, 24000),
            (29.97, 30000),
            (59.94, 60000),
            (119.88, 120_000),
        ]
        if let match = ntscRates.first(where: { abs($0.value - nominal) < 0.02 }) {
            return AgentFrameRate(numerator: match.numerator, denominator: 1001)
        }
        let denominator = 1000
        let numerator = max(1, Int((nominal * Double(denominator)).rounded()))
        let divisor = greatestCommonDivisor(numerator, denominator)
        return AgentFrameRate(numerator: numerator / divisor, denominator: denominator / divisor)
    }

    private func greatestCommonDivisor(_ left: Int, _ right: Int) -> Int {
        var firstValue = abs(left)
        var secondValue = abs(right)
        while secondValue != 0 {
            (firstValue, secondValue) = (secondValue, firstValue % secondValue)
        }
        return max(1, firstValue)
    }

    private func recordingRevision(
        recordingURL: URL,
        fileSize: UInt64,
        descriptor: String
    ) throws -> String {
        var pathMetadata = stat()
        guard recordingURL.path.withCString({ Darwin.lstat($0, &pathMetadata) }) == 0,
              pathMetadata.st_mode & S_IFMT == S_IFREG,
              UInt64(pathMetadata.st_size) == fileSize
        else { throw AgentArtifactError.projectMismatch }
        let descriptorHandle = recordingURL.path.withCString { Darwin.open($0, O_RDONLY | O_NOFOLLOW) }
        guard descriptorHandle >= 0 else { throw AgentArtifactError.projectMismatch }
        let handle = FileHandle(fileDescriptor: descriptorHandle, closeOnDealloc: true)
        var openedMetadata = stat()
        guard Darwin.fstat(descriptorHandle, &openedMetadata) == 0,
              openedMetadata.st_dev == pathMetadata.st_dev,
              openedMetadata.st_ino == pathMetadata.st_ino,
              openedMetadata.st_size == pathMetadata.st_size
        else { throw AgentArtifactError.projectMismatch }

        var hasher = SHA256()
        hasher.update(data: Data(descriptor.utf8))
        while let chunk = try handle.read(upToCount: 4 * 1024 * 1024), !chunk.isEmpty {
            hasher.update(data: chunk)
        }
        var completedMetadata = stat()
        guard Darwin.fstat(descriptorHandle, &completedMetadata) == 0,
              completedMetadata.st_size == openedMetadata.st_size,
              completedMetadata.st_mtimespec.tv_sec == openedMetadata.st_mtimespec.tv_sec,
              completedMetadata.st_mtimespec.tv_nsec == openedMetadata.st_mtimespec.tv_nsec
        else { throw AgentArtifactError.projectMismatch }
        return hasher.finalize().map { String(format: "%02x", $0) }.joined()
    }

    private func preflightResult(
        reasons: [String],
        provider: String,
        token: String?,
        expiresAt: Date?
    ) -> Components.Schemas.AgentPreflightResult {
        if reasons.isEmpty, let token, let expiresAt {
            return .init(value1: .init(
                ready: true,
                blockingReasons: .init(value1: .init(), value2: .init()),
                canApplyDestructive: hasUnsavedProjectChanges,
                transcriptionProvider: .init(rawValue: provider) ?? .none,
                preflightToken: .init(value1: token),
                preflightTokenExpiresAt: .init(value1: isoString(expiresAt))
            ))
        }
        return .init(value2: .init(
            ready: false,
            blockingReasons: reasons.compactMap {
                Components.Schemas.AgentPreflightBlockedResult.blockingReasonsPayloadPayload(
                    rawValue: $0
                )
            },
            canApplyDestructive: hasUnsavedProjectChanges,
            transcriptionProvider: .init(rawValue: provider) ?? .none
        ))
    }

    private enum PreflightTokenValidationError: Error {
        case expired
        case mismatch
    }

    private func validatePreflightToken(
        _ token: String,
        runtimeBudgetMinutes: Int,
        transcriptionProvider: String,
        importedTranscriptPath: String?
    ) throws -> EngineAgentPreflightSession {
        guard let session = preflightSessions.removeValue(forKey: token),
              Date().timeIntervalSince(session.createdAt) <= agentPreflightTTLSeconds
        else { throw PreflightTokenValidationError.expired }
        guard session.runtimeBudgetMinutes == runtimeBudgetMinutes,
              session.transcriptionProvider == transcriptionProvider,
              session.importedTranscriptPath == importedTranscriptPath,
              session.projectId == currentProjectDocument.project.id,
              session.projectPath == currentProjectURL?.path,
              session.recordingURL == availableAgentRecordingURL()?.path
        else { throw PreflightTokenValidationError.mismatch }
        return session
    }

    private func readAgentTranscript(path: String) throws -> Data {
        let maximumBytes: Int64 = 10 * 1024 * 1024
        let descriptor = try openAgentReadOnlyFile(path: path)
        let handle = FileHandle(fileDescriptor: descriptor, closeOnDealloc: true)
        var openedMetadata = stat()
        guard Darwin.fstat(descriptor, &openedMetadata) == 0,
              openedMetadata.st_mode & S_IFMT == S_IFREG,
              openedMetadata.st_size >= 0,
              openedMetadata.st_size <= maximumBytes
        else { throw AgentArtifactError.invalidTranscript }
        let expectedSize = Int(openedMetadata.st_size)
        let data = try handle.read(upToCount: expectedSize + 1) ?? Data()
        var completedMetadata = stat()
        guard data.count == expectedSize,
              Darwin.fstat(descriptor, &completedMetadata) == 0,
              completedMetadata.st_size == openedMetadata.st_size,
              completedMetadata.st_mtimespec.tv_sec == openedMetadata.st_mtimespec.tv_sec,
              completedMetadata.st_mtimespec.tv_nsec == openedMetadata.st_mtimespec.tv_nsec
        else { throw AgentArtifactError.invalidTranscript }
        return data
    }

    private func openAgentReadOnlyFile(path: String) throws -> Int32 {
        guard path.hasPrefix("/") else { throw AgentArtifactError.invalidTranscript }
        let components = path.split(separator: "/").map(String.init)
        guard let fileName = components.last else { throw AgentArtifactError.invalidTranscript }
        var directoryFD = Darwin.open("/", O_RDONLY | O_DIRECTORY)
        guard directoryFD >= 0 else { throw AgentArtifactError.invalidTranscript }
        for component in components.dropLast() {
            let nextFD = component.withCString {
                Darwin.openat(directoryFD, $0, O_RDONLY | O_DIRECTORY | O_NOFOLLOW)
            }
            Darwin.close(directoryFD)
            guard nextFD >= 0 else { throw AgentArtifactError.invalidTranscript }
            directoryFD = nextFD
        }
        let descriptor = fileName.withCString {
            Darwin.openat(directoryFD, $0, O_RDONLY | O_NOFOLLOW)
        }
        Darwin.close(directoryFD)
        guard descriptor >= 0 else { throw AgentArtifactError.invalidTranscript }
        return descriptor
    }

    func makeAgentRecordingSnapshot(
        recordingURL: URL,
        expectedRevision: String
    ) async throws -> URL {
        let sourceFD = try openAgentReadOnlyFile(path: recordingURL.path)
        defer { Darwin.close(sourceFD) }
        var metadata = stat()
        guard Darwin.fstat(sourceFD, &metadata) == 0,
              metadata.st_mode & S_IFMT == S_IFREG
        else { throw AgentArtifactError.projectMismatch }

        let directoryURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("guerillaglass-agent-source-\(UUID().uuidString)", isDirectory: true)
        guard directoryURL.path.withCString({ Darwin.mkdir($0, 0o700) }) == 0 else {
            throw AgentArtifactError.projectMismatch
        }
        let snapshotURL = directoryURL.appendingPathComponent("recording.mov")
        let destinationFD = snapshotURL.path.withCString {
            Darwin.open($0, O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW, 0o600)
        }
        guard destinationFD >= 0 else {
            try? FileManager.default.removeItem(at: directoryURL)
            throw AgentArtifactError.projectMismatch
        }
        var destinationIsOpen = true
        do {
            var buffer = [UInt8](repeating: 0, count: 4 * 1024 * 1024)
            while true {
                let count = buffer.withUnsafeMutableBytes {
                    Darwin.read(sourceFD, $0.baseAddress, $0.count)
                }
                guard count >= 0 else { throw AgentArtifactError.projectMismatch }
                if count == 0 {
                    break
                }
                var offset = 0
                while offset < count {
                    let written = buffer.withUnsafeBytes {
                        Darwin.write(destinationFD, $0.baseAddress?.advanced(by: offset), count - offset)
                    }
                    guard written > 0 else { throw AgentArtifactError.projectMismatch }
                    offset += written
                }
            }
            guard Darwin.fsync(destinationFD) == 0 else {
                throw AgentArtifactError.projectMismatch
            }
            Darwin.close(destinationFD)
            destinationIsOpen = false
            let snapshotSource = try await agentSource(recordingURL: snapshotURL)
            guard snapshotSource.revision == expectedRevision else {
                throw AgentArtifactError.projectMismatch
            }
            return snapshotURL
        } catch {
            if destinationIsOpen {
                Darwin.close(destinationFD)
            }
            try? FileManager.default.removeItem(at: directoryURL)
            throw error
        }
    }

    private func availableAgentRecordingURL() -> URL? {
        if let projectURL = projectRecordingURL(), FileManager.default.fileExists(atPath: projectURL.path) {
            return projectURL
        }
        return captureEngine.recordingURL
    }

    private func isoString(_ date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: date)
    }

    private func agentRunSummary(_ summary: AgentRunSummaryArtifact) -> Components.Schemas.AgentRunSummary {
        .init(
            jobId: .init(value1: summary.jobId),
            status: .init(rawValue: summary.status.rawValue) ?? .failed,
            runtimeBudgetMinutes: .init(value1: Double(summary.runtimeBudgetMinutes)),
            qaReport: agentQAReport(summary.qaReport),
            blockingReason: summary.qaReport.passed ? nil : .weak_narrative_structure,
            artifacts: summary.artifacts.compactMap(agentArtifactReference),
            cutPlan: summary.qaReport.passed ? agentCutPlan(summary.cutPlan) : nil,
            updatedAt: .init(value1: isoString(summary.updatedAt))
        )
    }

    private func agentQAReport(_ report: AgentQAReport) -> Components.Schemas.AgentQAReport {
        .init(
            passed: report.passed,
            score: .init(value1: report.score),
            coverage: .init(
                hook: report.coverage.hook,
                action: report.coverage.action,
                payoff: report.coverage.payoff,
                takeaway: report.coverage.takeaway
            ),
            missingBeats: report.missingBeats.compactMap {
                Components.Schemas.AgentQAReport.missingBeatsPayloadPayload(rawValue: $0)
            }
        )
    }

    private func agentArtifactReference(
        _ reference: AgentArtifactReference
    ) -> Components.Schemas.AgentArtifactReference? {
        let kind = reference.kind.rawValue
        let path = reference.path
        switch reference.kind {
        case .transcriptFullV1:
            return .init(value1: .init(
                kind: .init(rawValue: kind)!, path: .init(rawValue: path)!,
                sha256: reference.sha256.map { .init(value1: $0) }
            ))
        case .transcriptWordsV1:
            return .init(value2: .init(
                kind: .init(rawValue: kind)!, path: .init(rawValue: path)!,
                sha256: reference.sha256.map { .init(value1: $0) }
            ))
        case .beatMapV1:
            return .init(value3: .init(
                kind: .init(rawValue: kind)!, path: .init(rawValue: path)!,
                sha256: reference.sha256.map { .init(value1: $0) }
            ))
        case .qaReportV1:
            return .init(value4: .init(
                kind: .init(rawValue: kind)!, path: .init(rawValue: path)!,
                sha256: reference.sha256.map { .init(value1: $0) }
            ))
        case .cutPlanV1:
            return .init(value5: .init(
                kind: .init(rawValue: kind)!, path: .init(rawValue: path)!,
                sha256: reference.sha256.map { .init(value1: $0) }
            ))
        case .runSummaryV1:
            return .init(value6: .init(
                kind: .init(rawValue: kind)!, path: .init(rawValue: path)!
            ))
        }
    }

    private func agentCutPlan(_ cutPlan: AgentCutPlanArtifact) -> Components.Schemas.AgentCutPlanSummary {
        .init(
            version: 1,
            sourceFps: .init(
                numerator: .init(value1: Double(cutPlan.sourceFps.numerator)),
                denominator: .init(value1: Double(cutPlan.sourceFps.denominator))
            ),
            sourceFrameCount: .init(value1: Double(cutPlan.sourceFrameCount)),
            segments: cutPlan.segments.map { segment in
                .init(
                    id: .init(value1: segment.id),
                    beat: .init(rawValue: segment.beat.rawValue) ?? .hook,
                    startFrame: .init(value1: Double(segment.startFrame)),
                    endFrame: .init(value1: Double(segment.endFrame))
                )
            }
        )
    }
}
