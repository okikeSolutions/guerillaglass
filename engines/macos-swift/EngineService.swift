import Capture
import EngineProtocol
import Export
import Foundation
import InputTracking
import Project

struct EngineAgentPreflightSession {
    let token: String
    let runtimeBudgetMinutes: Int
    let transcriptionProvider: String
    let importedTranscriptPath: String?
    let projectPath: String?
    let recordingURL: String?
    let createdAt: Date
}

struct EngineAgentRunRecord {
    let jobId: String
    let status: Components.Schemas.AgentRunSummary.statusPayload
    let runtimeBudgetMinutes: Int
    let qaReport: Components.Schemas.AgentQAReport
    let blockingReason: Components.Schemas.AgentRunSummary.blockingReasonPayload?
    let updatedAt: String
}

@MainActor
final class EngineService: APIProtocol {
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
    var hasUnsavedProjectChanges = false
    var latestAgentJobId: String?
    var latestAgentUpdatedAt: String?
    var agentRuns: [String: EngineAgentRunRecord] = [:]
    var preflightSessions: [String: EngineAgentPreflightSession] = [:]
    var latestExportJobId: String?
    var latestExportOutputURL: URL?
}
