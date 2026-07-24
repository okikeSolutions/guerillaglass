import EngineProtocol
import Foundation
import Project

extension EngineService {
    func badRequest(_ code: Components.Schemas.EngineBadRequestError.codePayload, _ message: String) -> Components.Schemas.EngineBadRequestError {
        .init(code: code, message: .init(value1: message))
    }

    func actionResult(_ success: Bool, message: String? = nil) -> Components.Schemas.ActionResult {
        .init(success: success, message: message)
    }

    func isoNow() -> String {
        ISO8601DateFormatter().string(from: Date())
    }

    func telemetry() -> Components.Schemas.CaptureTelemetry {
        .init(achievedFps: .init(value1: 30))
    }

    func captureStatus() -> Components.Schemas.CaptureStatusResult {
        .init(
            isRunning: captureEngine.isRunning,
            isRecording: captureEngine.isRecording,
            captureSessionId: captureEngine.captureSessionID.map { .init(value1: $0) },
            recordingDurationSeconds: .init(value1: max(0, captureEngine.recordingDuration)),
            recordingURL: (captureEngine.recordingURL?.path).map { .init(value1: $0) },
            eventsURL: (currentEventsURL?.path).map { .init(value1: $0) },
            telemetry: telemetry()
        )
    }

    func timelineState() -> Components.Schemas.ProjectState.timelinePayload {
        typealias TimelinePayload = Components.Schemas.ProjectState.timelinePayload
        typealias ItemPayload = TimelinePayload.itemsPayloadPayload
        typealias ClipPayload = ItemPayload.Value1Payload
        typealias GapPayload = ItemPayload.Value2Payload

        let items = currentProjectDocument.project.timeline.items.map { item in
            switch item {
            case let .clip(clip):
                ItemPayload(value1: ClipPayload(
                    kind: .clip,
                    id: .init(value1: clip.id),
                    sourceAssetId: .recording,
                    sourceStartSeconds: .init(value1: clip.sourceStartSeconds),
                    sourceEndSeconds: .init(value1: clip.sourceEndSeconds)
                ))
            case let .gap(gap):
                ItemPayload(value2: GapPayload(
                    kind: .gap,
                    id: .init(value1: gap.id),
                    durationSeconds: .init(value1: gap.durationSeconds)
                ))
            }
        }

        return .init(
            version: Double(currentProjectDocument.project.timeline.version),
            items: items,
            updatedAt: .init(value1: isoNow())
        )
    }

    func autoZoomState() -> Components.Schemas.ProjectState.autoZoomPayload {
        let autoZoom = currentProjectDocument.project.autoZoom
        return .init(
            isEnabled: autoZoom.isEnabled,
            intensity: .init(value1: autoZoom.intensity),
            minimumKeyframeInterval: .init(value1: autoZoom.minimumKeyframeInterval)
        )
    }

    func projectState() -> Components.Schemas.ProjectState {
        .init(
            projectPath: currentProjectURL.map { .init(value1: $0.path) },
            recordingURL: (projectRecordingURL()?.path ?? captureEngine.recordingURL?.path).map {
                .init(value1: $0)
            },
            eventsURL: (projectEventsURL()?.path ?? currentEventsURL?.path).map { .init(value1: $0) },
            autoZoom: autoZoomState(),
            timeline: timelineState(),
            agentAnalysis: agentAnalysisState()
        )
    }

    func agentAnalysisState() -> Components.Schemas.ProjectAgentAnalysisSummary? {
        guard let jobId = latestAgentJobId, let run = agentRuns[jobId] else { return nil }
        return .init(
            latestJobId: .init(value1: jobId),
            latestStatus: Components.Schemas.ProjectAgentAnalysisSummary.latestStatusPayload(rawValue: run.status.rawValue),
            qaPassed: run.qaReport.passed,
            updatedAt: .init(value1: run.updatedAt)
        )
    }

    func projectRecordingURL() -> URL? {
        guard let currentProjectURL else { return nil }
        return currentProjectURL.appendingPathComponent(currentProjectDocument.recordingFileName)
    }

    func projectEventsURL() -> URL? {
        guard let currentProjectURL, let fileName = currentProjectDocument.eventsFileName else { return nil }
        return currentProjectURL.appendingPathComponent(fileName)
    }

    func unsupported(_ message: String) -> Components.Schemas.EngineBadRequestError {
        badRequest(.invalid_request, message)
    }
}
