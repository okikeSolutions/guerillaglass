import EngineProtocol
import Foundation
import Project

extension EngineService {
    func project_period_projectCurrent(
        _: Operations.project_period_projectCurrent.Input
    ) async throws -> Operations.project_period_projectCurrent.Output {
        .ok(.init(body: .json(projectState())))
    }

    func project_period_projectOpen(
        _ input: Operations.project_period_projectOpen.Input
    ) async throws -> Operations.project_period_projectOpen.Output {
        let payload: Components.Schemas.ProjectOpenPayload = switch input.body { case let .json(body): body }
        let projectURL = URL(fileURLWithPath: payload.projectPath.value1, isDirectory: true)
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
            currentProjectURL = openedURL
            currentProjectDocument = openedDocument
            await restoreAgentRunIfAvailable()
            try projectLibraryStore.recordRecentProject(url: openedURL)
            hasUnsavedProjectChanges = false
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
            URL(fileURLWithPath: $0.value1, isDirectory: true)
        } ?? currentProjectURL
        guard let projectURL else {
            return .badRequest(.init(body: .json(badRequest(.invalid_request, "projectPath is required before saving."))))
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
            guard Int(timeline.version) == 2 else {
                return .badRequest(.init(body: .json(badRequest(.invalid_params, "Unsupported timeline version."))))
            }
            document.project.timeline = TimelineDocument(
                items: timeline.items.compactMap { item in
                    if let clip = item.value1 {
                        return .clip(TimelineClip(
                            id: clip.id.value1,
                            sourceStartSeconds: clip.sourceStartSeconds.value1,
                            sourceEndSeconds: clip.sourceEndSeconds.value1
                        ))
                    }
                    if let gap = item.value2 {
                        return .gap(TimelineGap(
                            id: gap.id.value1,
                            durationSeconds: gap.durationSeconds.value1
                        ))
                    }
                    return nil
                }
            )
        }
        do {
            if isSaveAs {
                try agentArtifactStore.removeLatest(projectURL: projectURL)
            }
            let savedDocument = try projectStore.writeProject(
                document: document,
                assets: .init(
                    recordingURL: captureEngine.recordingURL,
                    eventsURL: currentEventsURL
                ),
                to: projectURL
            )
            currentProjectURL = projectURL
            currentProjectDocument = savedDocument
            if isSaveAs {
                agentRuns.removeAll()
                agentRecoveryFailureJobId = nil
                latestAgentJobId = nil
                latestAgentUpdatedAt = nil
            }
            hasUnsavedProjectChanges = false
            try projectLibraryStore.recordRecentProject(url: projectURL)
            return .ok(.init(body: .json(projectState())))
        } catch {
            return .badRequest(.init(body: .json(badRequest(.invalid_request, error.localizedDescription))))
        }
    }

    func project_period_projectRecents(
        _ input: Operations.project_period_projectRecents.Input
    ) async throws -> Operations.project_period_projectRecents.Output {
        let limit = max(0, min(Int(input.query.limit?.value1 ?? "10") ?? 10, 100))
        let items = projectLibraryStore.recentProjects(limit: limit).compactMap { item -> Components.Schemas.ProjectRecentItem? in
            guard let url = projectLibraryStore.resolveURL(for: item) else { return nil }
            return Components.Schemas.ProjectRecentItem(
                projectPath: .init(value1: url.path),
                displayName: .init(value1: item.displayName),
                lastOpenedAt: .init(value1: ISO8601DateFormatter().string(from: item.lastOpenedAt))
            )
        }
        return .ok(.init(body: .json(.init(items: items))))
    }
}
