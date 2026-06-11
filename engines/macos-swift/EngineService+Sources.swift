import EngineProtocol
import Foundation

extension EngineService {
    func sources_period_sourcesList(
        _: Operations.sources_period_sourcesList.Input
    ) async throws -> Operations.sources_period_sourcesList.Output {
        .ok(.init(body: .json(.init(displays: [], windows: []))))
    }
}
