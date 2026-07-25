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
    let importedTranscriptData: Data
    let projectId: UUID
    let projectPath: String
    let recordingURL: String
    let recordingRevision: String
    let baseTimeline: TimelineDocument
    let requiresDestructiveConfirmation: Bool
    let createdAt: Date
}

struct EngineAgentRunRecord {
    var summary: AgentRunSummaryArtifact
}

@MainActor
final class EngineService: APIProtocol {
    let captureEngine = CaptureEngine()
    let exportPipeline = ExportPipeline()
    let projectStore = ProjectStore()
    let projectLibraryStore = ProjectLibraryStore()
    let agentArtifactStore = AgentArtifactStore()
    let inputPermissionManager = InputPermissionManager()
    let inputSession = InputEventSession()

    var trackInputEventsWhileRecording = false
    var currentProjectURL: URL?
    var currentProjectDocument = ProjectDocument()
    var currentEventsURL: URL?
    var hasUnsavedProjectChanges = false
    var latestAgentJobId: String?
    var latestAgentUpdatedAt: String?
    var agentRecoveryFailureJobId: String?
    var agentRuns: [String: EngineAgentRunRecord] = [:]
    var preflightSessions: [String: EngineAgentPreflightSession] = [:]
    var latestExportJobId: String?
    var latestExportOutputURL: URL?
    var latestExportBackgroundFraming: BackgroundFramingSettings?
}
