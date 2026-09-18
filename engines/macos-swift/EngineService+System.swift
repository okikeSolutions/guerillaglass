import EngineProtocol
import Foundation

extension EngineService {
    func system_period_systemPing(
        _: Operations.system_period_systemPing.Input
    ) async throws -> Operations.system_period_systemPing.Output {
        .ok(.init(body: .json(.init(
            app: "guerillaglass",
            engineVersion: "0.2.0",
            protocolVersion: "2",
            platform: "macos"
        ))))
    }

    func system_period_engineCapabilities(
        _: Operations.system_period_engineCapabilities.Input
    ) async throws -> Operations.system_period_engineCapabilities.Output {
        .ok(.init(body: .json(.init(
            protocolVersion: "2",
            platform: "macos",
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
                runtimeBudgetMinutes: 10
            )
        ))))
    }
}
