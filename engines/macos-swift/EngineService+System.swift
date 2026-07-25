import EngineProtocol
import Foundation

extension EngineService {
    func system_period_systemPing(
        _: Operations.system_period_systemPing.Input
    ) async throws -> Operations.system_period_systemPing.Output {
        .ok(.init(body: .json(.init(
            app: .init(value1: "guerillaglass"),
            engineVersion: .init(value1: "0.2.0"),
            protocolVersion: .init(value1: "2"),
            platform: .init(value1: "macos")
        ))))
    }

    func system_period_engineCapabilities(
        _: Operations.system_period_engineCapabilities.Input
    ) async throws -> Operations.system_period_engineCapabilities.Output {
        .ok(.init(body: .json(.init(
            protocolVersion: .init(value1: "2"),
            platform: .init(value1: "macos"),
            phase: .native,
            capture: .init(display: true, window: true, systemAudio: true, microphone: true),
            recording: .init(inputTracking: true),
            export: .init(presets: true, cutPlan: true, backgroundFraming: true),
            project: .init(openSave: true),
            agent: .init(
                preflight: true,
                run: true,
                status: true,
                apply: true,
                localOnly: true,
                runtimeBudgetMinutes: .init(value1: 10),
                supportedTranscriptionProviders: [.imported_transcript],
                maxSourceDurationSeconds: .init(value1: 600),
                preflightTokenTtlSeconds: .init(value1: 60),
                artifactVersion: .init(value1: 1),
                cutPlanVersion: .init(value1: 1)
            )
        ))))
    }
}
