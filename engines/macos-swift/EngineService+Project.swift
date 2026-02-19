import Capture
import EngineProtocol
import Foundation
import Project

extension EngineService {
    func projectStateResponse(id: String) -> EngineResponse {
        .success(id: id, result: projectStateJSON())
    }

    func projectOpenResponse(id: String, params: [String: JSONValue]) -> EngineResponse {
        guard let projectPath = params["projectPath"]?.stringValue else {
            return .failure(id: id, code: "invalid_params", message: "projectPath is required")
        }

        do {
            let savedProject = try projectStore.loadProject(at: URL(fileURLWithPath: projectPath, isDirectory: true))
            currentProjectURL = savedProject.url
            currentProjectDocument = savedProject.document

            let recordingURL = projectStore.resolveRecordingURL(for: savedProject)
            if FileManager.default.fileExists(atPath: recordingURL.path) {
                captureEngine.loadRecording(from: recordingURL)
            } else {
                captureEngine.clearRecording()
            }

            if let eventsURL = projectStore.resolveEventsURL(for: savedProject) {
                if FileManager.default.fileExists(atPath: eventsURL.path) {
                    currentEventsURL = eventsURL
                } else {
                    currentEventsURL = nil
                }
            } else {
                currentEventsURL = nil
            }

            recordRecentProjectIfPossible(url: savedProject.url)

            return .success(id: id, result: projectStateJSON())
        } catch {
            return .failure(id: id, code: "runtime_error", message: error.localizedDescription)
        }
    }

    func projectSaveResponse(id: String, params: [String: JSONValue]) -> EngineResponse {
        if let autoZoom = parseAutoZoomSettings(from: params["autoZoom"]) {
            currentProjectDocument.project.autoZoom = autoZoom
        }
        if let descriptor = captureEngine.captureDescriptor {
            currentProjectDocument.project.captureMetadata = makeCaptureMetadata(from: descriptor)
        }

        let destinationURL: URL
        if let projectPath = params["projectPath"]?.stringValue {
            destinationURL = URL(fileURLWithPath: projectPath, isDirectory: true)
        } else if let currentProjectURL {
            destinationURL = currentProjectURL
        } else {
            return .failure(id: id, code: "invalid_params", message: "projectPath is required for first save")
        }

        guard let recordingURL = captureEngine.recordingURL else {
            return .failure(id: id, code: "invalid_params", message: "No recording available to save")
        }

        do {
            let recordingSource = sourceURLForWrite(
                sourceURL: recordingURL,
                destinationDirectory: destinationURL,
                expectedFileName: currentProjectDocument.recordingFileName
            )
            let eventsSource = sourceURLForWrite(
                sourceURL: currentEventsURL,
                destinationDirectory: destinationURL,
                expectedFileName: currentProjectDocument.eventsFileName ?? ProjectFile.eventsJSON
            )

            let writtenDocument = try projectStore.writeProject(
                document: currentProjectDocument,
                assets: ProjectStore.ProjectAssetURLs(
                    recordingURL: recordingSource,
                    eventsURL: eventsSource
                ),
                to: destinationURL
            )

            currentProjectURL = destinationURL
            currentProjectDocument = writtenDocument
            if let eventsSource {
                currentEventsURL = destinationURL.appendingPathComponent(eventsSource.lastPathComponent)
            }
            recordRecentProjectIfPossible(url: destinationURL)

            return .success(id: id, result: projectStateJSON())
        } catch {
            return .failure(id: id, code: "runtime_error", message: error.localizedDescription)
        }
    }

    func projectRecentsResponse(id: String, params: [String: JSONValue]) -> EngineResponse {
        let requestedLimit = Int(params["limit"]?.doubleValue ?? 10)
        let limit = max(1, min(requestedLimit, 100))
        let items = projectLibraryStore.recentProjects(limit: limit).compactMap { item -> JSONValue? in
            guard let resolvedURL = projectLibraryStore.resolveURL(for: item) else {
                return nil
            }
            return .object([
                "projectPath": .string(resolvedURL.path),
                "displayName": .string(item.displayName),
                "lastOpenedAt": .string(iso8601String(from: item.lastOpenedAt))
            ])
        }
        return .success(id: id, result: .object(["items": .array(items)]))
    }

    func projectStateJSON() -> JSONValue {
        let project = currentProjectDocument.project
        let autoZoom = project.autoZoom
        var payload: [String: JSONValue] = [
            "projectPath": currentProjectURL.map { .string($0.path) } ?? .null,
            "recordingURL": captureEngine.recordingURL.map { .string($0.path) } ?? .null,
            "eventsURL": currentEventsURL.map { .string($0.path) } ?? .null,
            "autoZoom": .object([
                "isEnabled": .bool(autoZoom.isEnabled),
                "intensity": .number(autoZoom.intensity),
                "minimumKeyframeInterval": .number(autoZoom.minimumKeyframeInterval)
            ])
        ]

        if let metadata = project.captureMetadata {
            payload["captureMetadata"] = .object([
                "source": .string(metadata.source.rawValue),
                "contentRect": .object([
                    "x": .number(metadata.contentRect.originX),
                    "y": .number(metadata.contentRect.originY),
                    "width": .number(metadata.contentRect.width),
                    "height": .number(metadata.contentRect.height)
                ]),
                "pixelScale": .number(metadata.pixelScale)
            ])
        } else {
            payload["captureMetadata"] = .null
        }

        return .object(payload)
    }

    func parseAutoZoomSettings(from value: JSONValue?) -> AutoZoomSettings? {
        guard let object = value?.objectValue else { return nil }
        guard let isEnabled = object["isEnabled"]?.boolValue,
              let intensity = object["intensity"]?.doubleValue,
              let minimumKeyframeInterval = object["minimumKeyframeInterval"]?.doubleValue
        else {
            return nil
        }

        return AutoZoomSettings(
            isEnabled: isEnabled,
            intensity: intensity,
            minimumKeyframeInterval: minimumKeyframeInterval
        ).clamped()
    }

    func sourceURLForWrite(sourceURL: URL?, destinationDirectory: URL, expectedFileName: String) -> URL? {
        guard let sourceURL else { return nil }
        let destinationURL = destinationDirectory.appendingPathComponent(expectedFileName)
        if sourceURL.standardizedFileURL == destinationURL.standardizedFileURL {
            return nil
        }
        return sourceURL
    }

    func makeCaptureMetadata(from descriptor: CaptureDescriptor) -> CaptureMetadata {
        let source: CaptureMetadata.Source = descriptor.source == .window ? .window : .display
        return CaptureMetadata(
            source: source,
            contentRect: CaptureRect(rect: descriptor.contentRect),
            pixelScale: Double(descriptor.pixelScale)
        )
    }

    private func recordRecentProjectIfPossible(url: URL) {
        do {
            try projectLibraryStore.recordRecentProject(url: url)
        } catch {
            // Recents index writes are best-effort and should not block project operations.
        }
    }

    private func iso8601String(from date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: date)
    }
}
