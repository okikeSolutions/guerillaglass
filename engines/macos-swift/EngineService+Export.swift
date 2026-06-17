import AVFoundation
import EngineProtocol
import Export
import Foundation

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
            let exportedURL = try await exportPipeline.export(
                recordingURL: recordingURL,
                preset: preset,
                trimRange: trimRange(start: payload.trimStartSeconds?.value1, end: payload.trimEndSeconds?.value1),
                outputURL: URL(fileURLWithPath: payload.outputURL.value1),
                timeline: exportTimeline(from: payload.timeline)
            )
            let jobId = "macos-export-\(UUID().uuidString)"
            latestExportJobId = jobId
            latestExportOutputURL = exportedURL
            return .ok(.init(body: .json(.init(
                jobId: .init(value1: jobId),
                status: .succeeded,
                outputURL: .init(value1: exportedURL.path)
            ))))
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
        guard let recordingURL = availableRecordingURL() else {
            return .badRequest(.init(body: .json(badRequest(.invalid_request, "No recording is available to export."))))
        }
        do {
            let exportedURL = try await exportPipeline.export(
                recordingURL: recordingURL,
                preset: preset,
                trimRange: nil,
                outputURL: URL(fileURLWithPath: payload.outputURL.value1)
            )
            let jobId = "macos-export-cut-plan-\(UUID().uuidString)"
            latestExportJobId = jobId
            latestExportOutputURL = exportedURL
            return .ok(.init(body: .json(.init(
                jobId: .init(value1: jobId),
                status: .succeeded,
                outputURL: .init(value1: exportedURL.path),
                appliedSegments: .init(value1: Double(currentProjectDocument.project.timeline.items.count))
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

    private func trimRange(start: Double?, end: Double?) -> CMTimeRange? {
        guard let start, let end, end > start else { return nil }
        return CMTimeRange(
            start: CMTime(seconds: start, preferredTimescale: 600),
            duration: CMTime(seconds: end - start, preferredTimescale: 600)
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
