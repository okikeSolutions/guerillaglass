import AVFoundation
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
            hasUnsavedProjectChanges = false

            let recordingURL = projectStore.resolveRecordingURL(for: savedProject)
            if FileManager.default.fileExists(atPath: recordingURL.path) {
                captureEngine.loadRecording(from: recordingURL)
                if currentProjectDocument.project.timeline.segments.isEmpty {
                    let recordingDuration = bestEffortRecordingDuration(for: recordingURL)
                    currentProjectDocument.project.timeline = TimelineDocument.singleSegment(
                        recordingDuration: recordingDuration
                    )
                }
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
        if let timeline = parseTimelineDocument(from: params["timeline"]) {
            currentProjectDocument.project.timeline = timeline
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
            hasUnsavedProjectChanges = false
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
            "lastRecordingTelemetry": project.lastRecordingTelemetry.map(captureTelemetryJSON) ?? .null,
            "autoZoom": .object([
                "isEnabled": .bool(autoZoom.isEnabled),
                "intensity": .number(autoZoom.intensity),
                "minimumKeyframeInterval": .number(autoZoom.minimumKeyframeInterval)
            ]),
            "timeline": timelineDocumentJSON(from: project.timeline)
        ]

        if let metadata = project.captureMetadata {
            payload["captureMetadata"] = captureMetadataJSON(from: metadata)
        } else {
            payload["captureMetadata"] = .null
        }

        payload["agentAnalysis"] = agentAnalysisSummaryJSON(from: project.agentAnalysis)

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

    func parseTimelineDocument(from value: JSONValue?) -> TimelineDocument? {
        guard let object = value?.objectValue else { return nil }
        guard case let .array(segmentsValue)? = object["segments"] else {
            return nil
        }
        guard let version = object["version"]?.doubleValue else {
            return nil
        }

        let segments = segmentsValue.compactMap(parseTimelineSegment)
        guard segments.count == segmentsValue.count else {
            return nil
        }

        return TimelineDocument(version: Int(version), segments: segments)
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
            window: descriptor.windowTarget.map {
                CaptureMetadata.Window(
                    id: $0.id,
                    title: $0.title,
                    appName: $0.appName
                )
            },
            contentRect: CaptureRect(rect: descriptor.contentRect),
            pixelScale: Double(descriptor.pixelScale)
        )
    }

    func captureMetadataJSON(from metadata: CaptureMetadata) -> JSONValue {
        .object([
            "window": metadata.window.map {
                .object([
                    "id": .number(Double($0.id)),
                    "title": .string($0.title),
                    "appName": .string($0.appName)
                ])
            } ?? .null,
            "source": .string(metadata.source.rawValue),
            "contentRect": .object([
                "x": .number(metadata.contentRect.originX),
                "y": .number(metadata.contentRect.originY),
                "width": .number(metadata.contentRect.width),
                "height": .number(metadata.contentRect.height)
            ]),
            "pixelScale": .number(metadata.pixelScale)
        ])
    }

    func captureTelemetryJSON(from telemetry: CaptureTelemetrySummary) -> JSONValue {
        .object([
            "sourceDroppedFrames": .number(Double(telemetry.sourceDroppedFrames)),
            "writerDroppedFrames": .number(Double(telemetry.writerDroppedFrames)),
            "writerBackpressureDrops": .number(Double(telemetry.writerBackpressureDrops)),
            "achievedFps": .number(telemetry.achievedFps),
            "cpuPercent": telemetry.cpuPercent.map { .number($0) } ?? .null,
            "memoryBytes": telemetry.memoryBytes.map { .number(Double($0)) } ?? .null,
            "recordingBitrateMbps": telemetry.recordingBitrateMbps.map { .number($0) } ?? .null,
            "captureCallbackMs": .number(telemetry.captureCallbackMs),
            "recordQueueLagMs": .number(telemetry.recordQueueLagMs),
            "writerAppendMs": .number(telemetry.writerAppendMs),
            "previewEncodeMs": telemetry.previewEncodeMs.map { .number($0) } ?? .null
        ])
    }

    func captureTelemetrySummary(from telemetry: CaptureEngine.CaptureTelemetrySnapshot) -> CaptureTelemetrySummary {
        CaptureTelemetrySummary(
            sourceDroppedFrames: telemetry.sourceDroppedFrames,
            writerDroppedFrames: telemetry.writerDroppedFrames,
            writerBackpressureDrops: telemetry.writerBackpressureDrops,
            achievedFps: telemetry.achievedFps,
            cpuPercent: telemetry.cpuPercent,
            memoryBytes: telemetry.memoryBytes,
            recordingBitrateMbps: telemetry.recordingBitrateMbps,
            captureCallbackMs: telemetry.captureCallbackMs,
            recordQueueLagMs: telemetry.recordQueueLagMs,
            writerAppendMs: telemetry.writerAppendMs,
            previewEncodeMs: telemetry.previewEncodeMs
        )
    }

    func timelineDocumentJSON(from document: TimelineDocument) -> JSONValue {
        .object([
            "version": .number(Double(document.version)),
            "segments": .array(document.segments.map(timelineSegmentJSON))
        ])
    }

    func timelineSegmentJSON(from segment: TimelineSegment) -> JSONValue {
        .object([
            "id": .string(segment.id),
            "sourceAssetId": .string(segment.sourceAssetId.rawValue),
            "sourceStartSeconds": .number(segment.sourceStartSeconds),
            "sourceEndSeconds": .number(segment.sourceEndSeconds)
        ])
    }

    func parseTimelineSegment(from value: JSONValue) -> TimelineSegment? {
        guard let object = value.objectValue,
              let id = object["id"]?.stringValue,
              let sourceAssetIdRaw = object["sourceAssetId"]?.stringValue,
              let sourceAssetId = TimelineSegment.SourceAssetID(rawValue: sourceAssetIdRaw),
              let sourceStartSeconds = object["sourceStartSeconds"]?.doubleValue,
              let sourceEndSeconds = object["sourceEndSeconds"]?.doubleValue
        else {
            return nil
        }

        return TimelineSegment(
            id: id,
            sourceAssetId: sourceAssetId,
            sourceStartSeconds: sourceStartSeconds,
            sourceEndSeconds: sourceEndSeconds
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

    private func agentAnalysisSummaryJSON(from metadata: AgentAnalysisMetadata?) -> JSONValue {
        guard let metadata,
              let latestRunID = metadata.latestRunID,
              let runSummary = latestAgentRunSummary()
        else {
            return .object([
                "latestJobId": .null,
                "latestStatus": .null,
                "qaPassed": .null,
                "updatedAt": .null
            ])
        }

        return .object([
            "latestJobId": .string(latestRunID),
            "latestStatus": .string(runSummary.status.rawValue),
            "qaPassed": runSummary.qaReport.map { .bool($0.passed) } ?? .null,
            "updatedAt": .string(runSummary.updatedAt)
        ])
    }

    private func bestEffortRecordingDuration(for recordingURL: URL) -> TimeInterval {
        let semaphore = DispatchSemaphore(value: 0)
        var resolvedDuration: TimeInterval = 0

        Task {
            defer { semaphore.signal() }
            let asset = AVAsset(url: recordingURL)
            if let duration = try? await asset.load(.duration),
               duration.seconds > 0
            {
                resolvedDuration = duration.seconds
            }
        }

        _ = semaphore.wait(timeout: .now() + 2)
        return max(0, resolvedDuration)
    }
}
