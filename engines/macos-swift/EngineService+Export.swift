import AVFoundation
import EngineProtocol
import Export
import Foundation
import InputTracking
import Project

extension EngineService {
    func export_period_exportInfo(
        _: Operations.export_period_exportInfo.Input
    ) async throws -> Operations.export_period_exportInfo.Output {
        let presets = Presets.all.map { preset in
            Components.Schemas.ExportPreset(
                id: .init(value1: preset.id),
                name: .init(value1: preset.name),
                width: .init(value1: Double(preset.width)),
                height: .init(value1: Double(preset.height)),
                fps: .init(value1: Double(preset.fps)),
                fileType: preset.fileType == .mov ? .mov : .mp4
            )
        }
        return .ok(.init(body: .json(.init(presets: presets))))
    }

    func export_period_exportRun(
        _ input: Operations.export_period_exportRun.Input
    ) async throws -> Operations.export_period_exportRun.Output {
        let payload: Components.Schemas.ExportRunPayload = switch input.body { case let .json(body): body }
        guard let preset = Presets.all.first(where: { $0.id == payload.presetId.value1 }) else {
            return .badRequest(.init(body: .json(badRequest(.invalid_params, "Unknown export preset."))))
        }
        guard let recordingURL = availableRecordingURL() else {
            return .badRequest(.init(body: .json(badRequest(.invalid_request, "No recording is available to export."))))
        }
        do {
            let backgroundFramingOverride = try payload.backgroundFraming.map(projectBackgroundFraming)
            let resolvedBackgroundFraming = BackgroundFramingSettings.resolve(
                exportOverride: backgroundFramingOverride,
                persisted: currentProjectDocument.project.backgroundFraming
            )
            let resolvedAutoZoom = payload.autoZoom.map(projectAutoZoom)
                ?? currentProjectDocument.project.autoZoom
            let exportedURL = try await exportPipeline.export(
                recordingURL: recordingURL,
                preset: preset,
                trimRange: trimRange(start: payload.trimStartSeconds?.value1, end: payload.trimEndSeconds?.value1),
                outputURL: URL(fileURLWithPath: payload.outputURL.value1),
                cameraEvents: availableCameraEvents(for: resolvedAutoZoom),
                autoZoomSettings: resolvedAutoZoom,
                captureMetadata: currentProjectDocument.project.captureMetadata,
                timeline: exportTimeline(from: payload.timeline),
                backgroundFraming: resolvedBackgroundFraming
            )
            let jobId = "macos-export-\(UUID().uuidString)"
            latestExportJobId = jobId
            latestExportOutputURL = exportedURL
            latestExportBackgroundFraming = resolvedBackgroundFraming
            return .ok(.init(body: .json(.init(
                jobId: .init(value1: jobId),
                status: .succeeded,
                outputURL: .init(value1: exportedURL.path)
            ))))
        } catch is CancellationError {
            throw CancellationError()
        } catch let error as BackgroundFramingSettings.ValidationError {
            return .badRequest(.init(body: .json(badRequest(.invalid_params, error.localizedDescription))))
        } catch let error as ExportPipeline.ExportError {
            let code: Components.Schemas.EngineBadRequestError.codePayload = switch error {
            case .invalidTimeline: .invalid_params
            default: .invalid_request
            }
            return .badRequest(.init(body: .json(badRequest(code, error.localizedDescription))))
        } catch {
            return .badRequest(.init(body: .json(badRequest(.invalid_request, error.localizedDescription))))
        }
    }

    func export_period_exportRunCutPlan(
        _ input: Operations.export_period_exportRunCutPlan.Input
    ) async throws -> Operations.export_period_exportRunCutPlan.Output {
        let payload: Components.Schemas.ExportRunCutPlanPayload = switch input.body { case let .json(body): body }
        guard let preset = Presets.all.first(where: { $0.id == payload.presetId.value1 }) else {
            return .badRequest(.init(body: .json(badRequest(.invalid_params, "Unknown export preset."))))
        }
        guard let recordingURL = availableRecordingURL(),
              let projectContext = agentProjectContext(recordingURL: recordingURL)
        else {
            return .badRequest(.init(body: .json(badRequest(.invalid_request, "No recording is available to export."))))
        }
        let run: EngineAgentRunRecord
        do {
            run = try await resolvedAgentRun(jobId: payload.jobId.value1)
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
        guard matchesAgentProjectContext(projectContext) else {
            return .conflict(.init(body: .json(conflict(
                .project_mismatch,
                "The active project changed while resolving the Agent Mode run."
            ))))
        }
        guard run.summary.qaReport.passed else {
            return .unprocessableContent(.init(body: .json(unprocessable(
                .qa_failed,
                "Narrative QA failed. Cut-plan export is blocked."
            ))))
        }
        do {
            let snapshotURL = try await makeAgentRecordingSnapshot(
                recordingURL: recordingURL,
                expectedRevision: run.summary.recordingRevision
            )
            defer { try? FileManager.default.removeItem(at: snapshotURL.deletingLastPathComponent()) }
            guard matchesAgentProjectContext(projectContext) else {
                return .conflict(.init(body: .json(conflict(
                    .project_mismatch,
                    "The active project changed while snapshotting the recording."
                ))))
            }
            let autoZoom = currentProjectDocument.project.autoZoom
            let captureMetadata = currentProjectDocument.project.captureMetadata
            let backgroundFraming = currentProjectDocument.project.backgroundFraming
            let cameraEvents = try availableCameraEvents(for: autoZoom)
            let timeline = try run.summary.cutPlan.timeline()
            let exportedURL = try await exportPipeline.export(
                recordingURL: snapshotURL,
                preset: preset,
                trimRange: nil,
                outputURL: URL(fileURLWithPath: payload.outputURL.value1),
                cameraEvents: cameraEvents,
                autoZoomSettings: autoZoom,
                captureMetadata: captureMetadata,
                timeline: exportTimeline(from: timeline),
                backgroundFraming: backgroundFraming
            )
            guard matchesAgentProjectContext(projectContext) else {
                return .conflict(.init(body: .json(conflict(
                    .project_mismatch,
                    "The active project changed while exporting the cut plan."
                ))))
            }
            let jobId = "macos-export-cut-plan-\(UUID().uuidString)"
            latestExportJobId = jobId
            latestExportOutputURL = exportedURL
            latestExportBackgroundFraming = currentProjectDocument.project.backgroundFraming
            return .ok(.init(body: .json(.init(
                jobId: .init(value1: jobId),
                status: .succeeded,
                outputURL: .init(value1: exportedURL.path),
                appliedSegments: .init(value1: Double(timeline.items.count))
            ))))
        } catch is CancellationError {
            throw CancellationError()
        } catch AgentArtifactError.invalidCutPlan {
            return .unprocessableContent(.init(body: .json(unprocessable(.invalid_cut_plan, "Cut plan is missing or invalid."))))
        } catch AgentArtifactError.projectMismatch {
            return .conflict(.init(body: .json(conflict(
                .project_mismatch,
                "The recording changed before a stable export snapshot could be created."
            ))))
        } catch {
            return .badRequest(.init(body: .json(badRequest(.invalid_request, error.localizedDescription))))
        }
    }

    func export_period_exportGet(
        _ input: Operations.export_period_exportGet.Input
    ) async throws -> Operations.export_period_exportGet.Output {
        let knownJob = input.path.jobId.value1 == latestExportJobId
        return .ok(.init(body: .json(.init(
            jobId: .init(value1: input.path.jobId.value1),
            status: knownJob ? .succeeded : .failed,
            outputURL: knownJob ? latestExportOutputURL.map { .init(value1: $0.path) } : nil
        ))))
    }

    private func availableRecordingURL() -> URL? {
        if let projectURL = projectRecordingURL(), FileManager.default.fileExists(atPath: projectURL.path) {
            return projectURL
        }
        return captureEngine.recordingURL
    }

    private func availableCameraEvents(for autoZoom: AutoZoomSettings) throws -> [InputEvent] {
        guard autoZoom.requiresInputEvents else { return [] }
        guard let eventsURL = projectEventsURL() ?? currentEventsURL,
              FileManager.default.fileExists(atPath: eventsURL.path)
        else { return [] }
        return try InputEventLog.load(from: eventsURL).events
    }

    private func trimRange(start: Double?, end: Double?) -> CMTimeRange? {
        guard let start, let end, end > start else { return nil }
        return CMTimeRange(
            start: CMTime(seconds: start, preferredTimescale: 600),
            duration: CMTime(seconds: end - start, preferredTimescale: 600)
        )
    }

    private func exportTimeline(from timeline: TimelineDocument) -> ExportTimelineDocument? {
        guard !timeline.items.isEmpty else { return nil }
        return ExportTimelineDocument(
            version: timeline.version,
            items: timeline.items.map { item in
                switch item {
                case let .clip(clip):
                    .clip(ExportTimelineClip(
                        id: clip.id,
                        sourceStartSeconds: clip.sourceStartSeconds,
                        sourceEndSeconds: clip.sourceEndSeconds
                    ))
                case let .gap(gap):
                    .gap(ExportTimelineGap(id: gap.id, durationSeconds: gap.durationSeconds))
                }
            }
        )
    }

    private func exportTimeline(
        from timeline: Components.Schemas.ExportRunPayload.timelinePayload?
    ) throws -> ExportTimelineDocument? {
        guard let timeline else { return nil }
        guard Int(timeline.version) == 2 else {
            throw ExportPipeline.ExportError.invalidTimeline("Unsupported timeline version: \(timeline.version)")
        }
        guard !timeline.items.isEmpty else { return nil }

        let items = timeline.items.compactMap { item -> ExportTimelineItem? in
            if let clip = item.value1 {
                return .clip(ExportTimelineClip(
                    id: clip.id.value1,
                    sourceStartSeconds: clip.sourceStartSeconds.value1,
                    sourceEndSeconds: clip.sourceEndSeconds.value1
                ))
            }
            if let gap = item.value2 {
                return .gap(ExportTimelineGap(
                    id: gap.id.value1,
                    durationSeconds: gap.durationSeconds.value1
                ))
            }
            return nil
        }

        guard !items.isEmpty else { return nil }
        return ExportTimelineDocument(version: Int(timeline.version), items: items)
    }
}
