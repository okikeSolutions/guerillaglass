@testable import Automation
import XCTest

final class AutomationTests: XCTestCase {
    func testPlannerInitialization() {
        let planner = VirtualCameraPlanner()
        let model = AttentionModel()
        let constraints = ZoomConstraints()

        XCTAssertNotNil(planner)
        XCTAssertNotNil(model)
        XCTAssertNotNil(constraints)
    }
}
