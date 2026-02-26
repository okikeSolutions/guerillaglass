import Foundation

struct ValidatedCutPlanExecution {
    let runSummary: AgentRunSummaryDocument
    let segmentCount: Int
    let startFrame: Int64
    let endFrame: Int64
    let startSeconds: Double
    let endSeconds: Double
}

let agentPreflightTokenTTLSeconds: TimeInterval = 60

struct AgentPreflightSession {
    let token: String
    let createdAt: Date
    let runtimeBudgetMinutes: Int
    let transcriptionProvider: AgentTranscriptionProvider
    let importedTranscriptPath: String?
    let projectPath: String?
    let recordingPath: String?
}

enum AgentModeError: Error, LocalizedError {
    case invalidParams(String)
    case needsConfirmation(String)
    case qaFailed(String)
    case missingLocalModel(String)
    case invalidImportedTranscript(String)
    case invalidCutPlan(String)
    case runtime(String)

    var code: String {
        switch self {
        case .invalidParams, .invalidImportedTranscript:
            "invalid_params"
        case .needsConfirmation:
            "needs_confirmation"
        case .qaFailed:
            "qa_failed"
        case .missingLocalModel:
            "missing_local_model"
        case .invalidCutPlan:
            "invalid_cut_plan"
        case .runtime:
            "runtime_error"
        }
    }

    var message: String {
        switch self {
        case let .invalidParams(message),
             let .needsConfirmation(message),
             let .qaFailed(message),
             let .missingLocalModel(message),
             let .invalidImportedTranscript(message),
             let .invalidCutPlan(message),
             let .runtime(message):
            message
        }
    }

    var errorDescription: String? {
        message
    }
}
