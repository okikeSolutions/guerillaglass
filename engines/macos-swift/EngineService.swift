import Capture
import EngineProtocol
import Export
import Foundation
import InputTracking
import Project

final class EngineService {
    let captureEngine = CaptureEngine()
    let exportPipeline = ExportPipeline()
    let projectStore = ProjectStore()
    let projectLibraryStore = ProjectLibraryStore()
    let inputPermissionManager = InputPermissionManager()
    let inputSession = InputEventSession()

    var trackInputEventsWhileRecording = false
    var currentProjectURL: URL?
    var currentProjectDocument = ProjectDocument()
    var currentEventsURL: URL?

    func handleLine(_ line: String) async -> EngineResponse {
        do {
            let request = try EngineLineCodec.decodeRequest(from: line)
            return await handle(request)
        } catch {
            return .failure(id: "unknown", code: "invalid_request", message: error.localizedDescription)
        }
    }

    private typealias MethodHandler = (_ id: String, _ params: [String: JSONValue]) async -> EngineResponse

    private func handle(_ request: EngineRequest) async -> EngineResponse {
        let handlers: [String: MethodHandler] = [
            "system.ping": { id, _ in self.pingResponse(id: id) },
            "engine.capabilities": { id, _ in self.capabilitiesResponse(id: id) },
            "permissions.get": { id, _ in self.permissionsGet(id: id) },
            "permissions.requestScreenRecording": { id, _ in await self.permissionsRequestScreenRecording(id: id) },
            "permissions.requestMicrophone": { id, _ in await self.permissionsRequestMicrophone(id: id) },
            "permissions.requestInputMonitoring": { id, _ in self.permissionsRequestInputMonitoring(id: id) },
            "permissions.openInputMonitoringSettings": { id, _ in self.permissionsOpenInputMonitoringSettings(id: id) },
            "sources.list": { id, _ in await self.sourcesListResponse(id: id) },
            "capture.startDisplay": { id, params in await self.startDisplayResponse(id: id, params: params) },
            "capture.startCurrentWindow": { id, params in
                await self.startCurrentWindowResponse(id: id, params: params)
            },
            "capture.startWindow": { id, params in await self.startWindowResponse(id: id, params: params) },
            "capture.stop": { id, _ in await self.stopCaptureResponse(id: id) },
            "recording.start": { id, params in await self.startRecordingResponse(id: id, params: params) },
            "recording.stop": { id, _ in await self.stopRecordingResponse(id: id) },
            "capture.status": { id, _ in self.captureStatusResponse(id: id) },
            "export.info": { id, _ in self.exportInfoResponse(id: id) },
            "export.run": { id, params in await self.exportRunResponse(id: id, params: params) },
            "project.current": { id, _ in self.projectStateResponse(id: id) },
            "project.open": { id, params in self.projectOpenResponse(id: id, params: params) },
            "project.save": { id, params in self.projectSaveResponse(id: id, params: params) },
            "project.recents": { id, params in self.projectRecentsResponse(id: id, params: params) }
        ]

        guard let handler = handlers[request.method] else {
            return .failure(
                id: request.id,
                code: "unsupported_method",
                message: "Unsupported method: \(request.method)"
            )
        }

        return await handler(request.id, request.params)
    }
}
