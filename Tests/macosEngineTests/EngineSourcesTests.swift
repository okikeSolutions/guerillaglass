import CoreGraphics
import EngineProtocol
@testable import guerillaglass_engine
import XCTest

final class EngineSourcesTests: XCTestCase {
    @MainActor
    func testDeniedScreenPermissionReturnsForbiddenInsteadOfEmptySources() async throws {
        guard !CGPreflightScreenCaptureAccess() else {
            throw XCTSkip("The test runner already has Screen Recording permission; validate authorized sources in packaged acceptance.")
        }
        let response = try await EngineService().sources_period_sourcesList(.init())
        guard case let .forbidden(result) = response else {
            XCTFail("Denied permission must remain visible, not masquerade as an empty source list.")
            return
        }
        XCTAssertEqual(try result.body.json.code.value1, .permission_denied)
    }
}
