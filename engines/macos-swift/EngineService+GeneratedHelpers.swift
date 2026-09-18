import EngineProtocol
import Foundation
import Project

extension EngineService {
    func badRequest(_ code: Components.Schemas.EngineBadRequestError.codePayload, _ message: String) -> Components.Schemas.EngineBadRequestError {
        .init(code: code, message: message)
    }

    func actionResult(_ success: Bool, message: String? = nil) -> Components.Schemas.ActionResult {
        .init(success: success, message: message)
    }

    func isoNow() -> String {
        ISO8601DateFormatter().string(from: Date())
    }

    func telemetry() -> Components.Schemas.CaptureTelemetry {
        .init(achievedFps: 30)
    }

    func captureStatus() -> Components.Schemas.CaptureStatusResult {
        .init(
            isRunning: captureEngine.isRunning,
            isRecording: captureEngine.isRecording,
            captureSessionId: captureEngine.captureSessionID,
            recordingDurationSeconds: max(0, captureEngine.recordingDuration),
            recordingURL: captureEngine.recordingURL?.path,
            eventsURL: currentEventsURL?.path,
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
                    id: clip.id,
                    sourceAssetId: .recording,
                    sourceStartSeconds: clip.sourceStartSeconds,
                    sourceEndSeconds: clip.sourceEndSeconds
                ))
            case let .gap(gap):
                ItemPayload(value2: GapPayload(
                    kind: .gap,
                    id: gap.id,
                    durationSeconds: gap.durationSeconds
                ))
            }
        }

        return .init(
            version: Double(currentProjectDocument.project.timeline.version),
            items: items,
            updatedAt: isoNow()
        )
    }

    func backgroundFramingState() -> Components.Schemas.BackgroundFramingSettings {
        let settings = currentProjectDocument.project.backgroundFraming
        return .init(
            version: Double(settings.version),
            enabled: settings.enabled,
            backgroundColor: settings.backgroundColor,
            paddingFraction: settings.paddingFraction,
            cornerRadiusFraction: settings.cornerRadiusFraction,
            shadowStrength: settings.shadowStrength
        )
    }

    func projectBackgroundFraming(
        from payload: Components.Schemas.BackgroundFramingSettings
    ) throws -> BackgroundFramingSettings {
        guard payload.version == Double(BackgroundFramingSettings.currentVersion) else {
            throw BackgroundFramingSettings.ValidationError.unsupportedVersion(payload.version)
        }
        return try BackgroundFramingSettings(
            version: Int(payload.version),
            enabled: payload.enabled,
            backgroundColor: payload.backgroundColor,
            paddingFraction: payload.paddingFraction,
            cornerRadiusFraction: payload.cornerRadiusFraction,
            shadowStrength: payload.shadowStrength
        )
    }

    func projectAutoZoom(
        from payload: Components.Schemas.AutoZoomSettings
    ) -> AutoZoomSettings {
        AutoZoomSettings(
            isEnabled: payload.isEnabled,
            intensity: payload.intensity,
            minimumKeyframeInterval: payload.minimumKeyframeInterval
        ).clamped()
    }

    func autoZoomState() -> Components.Schemas.AutoZoomSettings {
        let autoZoom = currentProjectDocument.project.autoZoom
        return .init(
            isEnabled: autoZoom.isEnabled,
            intensity: autoZoom.intensity,
            minimumKeyframeInterval: autoZoom.minimumKeyframeInterval
        )
    }

    func projectState() -> Components.Schemas.ProjectState {
        .init(
            projectPath: currentProjectURL?.path,
            recordingURL: projectRecordingURL()?.path ?? captureEngine.recordingURL?.path,
            eventsURL: projectEventsURL()?.path ?? currentEventsURL?.path,
            autoZoom: autoZoomState(),
            backgroundFraming: backgroundFramingState(),
            timeline: timelineState(),
            agentAnalysis: agentAnalysisState()
        )
    }

    func agentAnalysisState() -> Components.Schemas.ProjectAgentAnalysisSummary? {
        guard let jobId = latestAgentJobId, let run = agentRuns[jobId] else { return nil }
        return .init(
            latestJobId: jobId,
            latestStatus: Components.Schemas.ProjectAgentAnalysisSummary.latestStatusPayload(rawValue: run.status.rawValue),
            qaPassed: run.qaReport.passed,
            updatedAt: run.updatedAt
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
