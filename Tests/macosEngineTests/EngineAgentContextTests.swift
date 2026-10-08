import EngineProtocol
import Foundation
@testable import guerillaglass_engine
import XCTest

final class EngineAgentContextTests: XCTestCase {
    @MainActor
    func testProjectReopenInvalidatesSamePathAgentContext() async throws {
        let projectURL = URL(fileURLWithPath: "/private\(FileManager.default.temporaryDirectory.path)", isDirectory: true)
            .appendingPathComponent("gg-agent-context-\(UUID().uuidString).gglassproj", isDirectory: true)
        defer { try? FileManager.default.removeItem(at: projectURL) }
        try FileManager.default.createDirectory(at: projectURL, withIntermediateDirectories: true)
        let recordingURL = projectURL.appendingPathComponent("recording.mov")
        try Data([0]).write(to: recordingURL)
        let service = EngineService()
        let input = Operations.project_period_projectOpen.Input(
            body: .json(.init(projectPath: projectURL.path))
        )
        let opened = try await service.project_period_projectOpen(input)
        guard case .ok = opened else {
            return XCTFail("The fixture project must open before capturing its context: \(opened)")
        }
        let context = try XCTUnwrap(service.agentProjectContext(recordingURL: recordingURL))
        XCTAssertTrue(service.matchesAgentProjectContext(context))
        guard case .ok = try await service.project_period_projectOpen(input) else {
            return XCTFail("The same project must reopen successfully.")
        }
        XCTAssertEqual(service.currentProjectURL, projectURL)
        XCTAssertEqual(service.currentProjectDocument.project.id, context.projectId)
        XCTAssertFalse(service.matchesAgentProjectContext(context), "Reopening must retire pending work even when paths and project UUID match.")
        let reopened = try XCTUnwrap(service.agentProjectContext(recordingURL: recordingURL))
        XCTAssertTrue(service.matchesAgentProjectContext(reopened))
    }
}
