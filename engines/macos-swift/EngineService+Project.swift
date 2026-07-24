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
        if let projectPath = payload.projectPath?.value1 {
            currentProjectURL = URL(fileURLWithPath: projectPath, isDirectory: true)
        }
        if let autoZoom = payload.autoZoom {
            currentProjectDocument.project.autoZoom = AutoZoomSettings(
                isEnabled: autoZoom.isEnabled,
                intensity: autoZoom.intensity.value1,
                minimumKeyframeInterval: autoZoom.minimumKeyframeInterval.value1
            ).clamped()
        }
        if let backgroundFraming = payload.backgroundFraming {
            do {
                currentProjectDocument.project.backgroundFraming = try projectBackgroundFraming(
                    from: backgroundFraming
                )
            } catch {
                return .badRequest(.init(body: .json(badRequest(.invalid_params, error.localizedDescription))))
            }
        }
        guard let currentProjectURL else {
            return .badRequest(.init(body: .json(badRequest(.invalid_request, "projectPath is required before saving."))))
        }
        do {
            currentProjectDocument = try projectStore.writeProject(
                document: currentProjectDocument,
                assets: .init(
                    recordingURL: captureEngine.recordingURL,
                    eventsURL: currentEventsURL
                ),
                to: currentProjectURL
            )
            try projectLibraryStore.recordRecentProject(url: currentProjectURL)
            hasUnsavedProjectChanges = false
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
