import EngineProtocol
import Foundation
import Project

extension EngineService {
    func leaseProject(at url: URL) throws -> ProjectLease {
        if let lease = currentProjectLease, lease.url.path == url.path {
            return lease
        }
        return try ProjectLease(url: url)
    }

    func project_period_projectCurrent(
        _: Operations.project_period_projectCurrent.Input
    ) async throws -> Operations.project_period_projectCurrent.Output {
        .ok(.init(body: .json(projectState())))
    }

    func project_period_projectOpen(
        _ input: Operations.project_period_projectOpen.Input
    ) async throws -> Operations.project_period_projectOpen.Output {
        let payload: Components.Schemas.ProjectOpenPayload = switch input.body { case let .json(body): body }
        let projectURL = URL(fileURLWithPath: payload.projectPath, isDirectory: true)
        let lease: ProjectLease
        do {
            lease = try leaseProject(at: projectURL)
        } catch {
            return .badRequest(.init(body: .json(badRequest(.invalid_request, error.localizedDescription))))
        }
        let sessionID = UUID()
        projectSessionID = sessionID
        preflightSessions.removeAll()
        agentRuns.removeAll()
        latestAgentJobId = nil
        latestAgentUpdatedAt = nil
        do {
            let openedURL: URL
            let openedDocument: ProjectDocument
            if FileManager.default.fileExists(atPath: projectURL.appendingPathComponent(ProjectFile.projectJSON).path) {
                let savedProject = try projectStore.loadProject(at: projectURL)
                openedURL = savedProject.url
                openedDocument = savedProject.document
            } else {
                openedURL = projectURL
                openedDocument = try projectStore.writeProject(
                    document: ProjectDocument(),
                    assets: .init(),
                    to: projectURL
                )
            }
            currentProjectLease = lease
            currentProjectURL = openedURL
            currentProjectDocument = openedDocument
            hasUnsavedProjectChanges = false
            await restoreAgentRunIfAvailable()
            guard projectSessionID == sessionID,
                  currentProjectURL == openedURL,
                  currentProjectDocument.project.id == openedDocument.project.id
            else {
                return .badRequest(.init(body: .json(badRequest(
                    .invalid_request, "Another project replaced this open request."
                ))))
            }
            try projectLibraryStore.recordRecentProject(url: openedURL)
            return .ok(.init(body: .json(projectState())))
        } catch {
            return .badRequest(.init(body: .json(badRequest(.invalid_request, error.localizedDescription))))
        }
    }

    func project_period_projectSave(
        _ input: Operations.project_period_projectSave.Input
    ) async throws -> Operations.project_period_projectSave.Output {
        let payload: Components.Schemas.ProjectSavePayload = switch input.body { case let .json(body): body }
        let projectURL = payload.projectPath.map {
            URL(fileURLWithPath: $0, isDirectory: true)
        } ?? currentProjectURL
        guard let projectURL else {
            return .badRequest(.init(body: .json(badRequest(.invalid_request, "projectPath is required before saving."))))
        }

        let lease: ProjectLease
        do {
            lease = try leaseProject(at: projectURL)
        } catch {
            return .badRequest(.init(body: .json(badRequest(.invalid_request, error.localizedDescription))))
        }
        let isSaveAs = currentProjectURL?.standardizedFileURL != projectURL.standardizedFileURL
        var document = currentProjectDocument
        if isSaveAs {
            // Analysis artifacts are project-bound and are not copied by Save As.
            document.project.agentAnalysis = AgentAnalysisMetadata()
        }
        if let autoZoom = payload.autoZoom {
            document.project.autoZoom = projectAutoZoom(from: autoZoom)
        }
        if let backgroundFraming = payload.backgroundFraming {
            do {
                document.project.backgroundFraming = try projectBackgroundFraming(from: backgroundFraming)
            } catch {
                return .badRequest(.init(body: .json(badRequest(.invalid_params, error.localizedDescription))))
            }
        }
        if let timeline = payload.timeline {
            do {
                document.project.timeline = try projectTimeline(from: timeline)
            } catch {
                return .badRequest(.init(body: .json(badRequest(.invalid_params, "Invalid timeline document."))))
            }
        }
        do {
            // An opened project owns its media independently of the live capture
            // session. Resolve all declared assets before switching to Save As.
            let assets: ProjectStore.ProjectAssetURLs
            if let sourceURL = currentProjectURL {
                let source = try projectStore.loadProject(at: sourceURL)
                assets = try .init(
                    recordingURL: projectStore.resolveRecordingAssetForSave(for: source, saving: document),
                    systemAudioURL: projectStore.resolveSystemAudioURL(for: source),
                    micAudioURL: projectStore.resolveMicAudioURL(for: source),
                    eventsURL: projectStore.resolveEventsURL(for: source)
                )
            } else {
                assets = .init(recordingURL: captureEngine.recordingURL, eventsURL: currentEventsURL)
            }
            let quarantinedAnalysis = isSaveAs
                ? try agentArtifactStore.quarantineLatest(projectURL: projectURL)
                : nil
            let savedDocument: ProjectDocument
            do {
                savedDocument = try projectStore.writeProject(
                    document: document,
                    assets: assets,
                    to: projectURL
                )
            } catch {
                if let quarantinedAnalysis {
                    try agentArtifactStore.restoreQuarantined(
                        quarantinedAnalysis,
                        projectURL: projectURL
                    )
                }
                throw error
            }
            if let quarantinedAnalysis {
                agentArtifactStore.discardQuarantined(
                    quarantinedAnalysis,
                    projectURL: projectURL
                )
            }
            currentProjectLease = lease
            currentProjectURL = projectURL
            currentProjectDocument = savedDocument
            if isSaveAs {
                projectSessionID = UUID()
                preflightSessions.removeAll()
                agentRuns.removeAll()
                agentRecoveryFailureJobId = nil
                latestAgentJobId = nil
                latestAgentUpdatedAt = nil
            }
            hasUnsavedProjectChanges = false
            do {
                try projectLibraryStore.recordRecentProject(url: projectURL)
            } catch {
                // The project save is already committed; a recents-index failure must not
                // report the save as failed or trigger destructive rollback semantics.
            }
            return .ok(.init(body: .json(projectState())))
        } catch {
            return .badRequest(.init(body: .json(badRequest(.invalid_request, error.localizedDescription))))
        }
    }

    func project_period_projectRecents(
        _ input: Operations.project_period_projectRecents.Input
    ) async throws -> Operations.project_period_projectRecents.Output {
        let limit = max(0, min(Int(input.query.limit ?? "10") ?? 10, 100))
        let items = projectLibraryStore.recentProjects(limit: limit).compactMap { item -> Components.Schemas.ProjectRecentItem? in
            guard let url = projectLibraryStore.resolveURL(for: item) else { return nil }
            return Components.Schemas.ProjectRecentItem(
                projectPath: url.path,
                displayName: item.displayName,
                lastOpenedAt: ISO8601DateFormatter().string(from: item.lastOpenedAt)
            )
        }
        return .ok(.init(body: .json(.init(items: items))))
    }
}
