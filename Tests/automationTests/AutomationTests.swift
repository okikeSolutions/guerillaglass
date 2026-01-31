@testable import Automation
import CoreGraphics
import InputTracking
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

    func testAttentionModelDwellAndClickIntensity() {
        let constraints = ZoomConstraints(
            dwellDuration: 0.1,
            dwellSpeedThreshold: 10,
            velocitySmoothingAlpha: 1,
            motionIntensity: 0.2,
            dwellIntensity: 0.7,
            clickIntensity: 1.0
        )

        let events: [InputEvent] = [
            InputEvent(type: .cursorMoved, timestamp: 0.2, position: CGPoint(x: 100, y: 100)),
            InputEvent(type: .cursorMoved, timestamp: 0.0, position: CGPoint(x: 100, y: 100)),
            InputEvent(type: .mouseDown, timestamp: 0.25, position: CGPoint(x: 100, y: 100))
        ]

        let samples = AttentionModel().samples(from: events, constraints: constraints)

        XCTAssertEqual(samples.map(\.time), samples.map(\.time).sorted())

        guard let dwellSample = samples.first(where: { $0.time == 0.2 }) else {
            XCTFail("Missing dwell sample at 0.2s")
            return
        }
        XCTAssertEqual(dwellSample.isDwell, true)
        XCTAssertEqual(dwellSample.intensity, constraints.dwellIntensity, accuracy: 0.0001)

        guard let clickSample = samples.first(where: { $0.isClick }) else {
            XCTFail("Missing click sample")
            return
        }
        XCTAssertEqual(clickSample.intensity, constraints.clickIntensity, accuracy: 0.0001)
    }

    func testPlannerClampsZoomAndDuration() {
        let planner = VirtualCameraPlanner()
        let constraints = ZoomConstraints(
            maxZoom: 3.0,
            minVisibleAreaFraction: 0.5,
            baseZoom: 1.0
        )
        let sourceSize = CGSize(width: 1920, height: 1080)
        let events = [
            InputEvent(type: .mouseDown, timestamp: 1.0, position: CGPoint(x: 1800, y: 900))
        ]

        let plan = planner.plan(
            events: events,
            sourceSize: sourceSize,
            duration: 2.0,
            constraints: constraints
        )

        XCTAssertEqual(plan.duration, 2.0, accuracy: 0.0001)
        guard let firstKeyframe = plan.keyframes.first, let lastKeyframe = plan.keyframes.last else {
            XCTFail("Expected keyframes in plan")
            return
        }
        XCTAssertEqual(firstKeyframe.time, 0.0, accuracy: 0.0001)
        XCTAssertEqual(lastKeyframe.time, 2.0, accuracy: 0.0001)

        let allowedMaxZoom = constraints.clampedZoom(constraints.maxZoom)
        for keyframe in plan.keyframes {
            XCTAssertLessThanOrEqual(keyframe.zoom, allowedMaxZoom + 0.0001)
            let clampedCenter = constraints.clampedCenter(
                keyframe.center,
                in: sourceSize,
                zoom: keyframe.zoom
            )
            XCTAssertEqual(keyframe.center.x, clampedCenter.x, accuracy: 0.0001)
            XCTAssertEqual(keyframe.center.y, clampedCenter.y, accuracy: 0.0001)
        }
    }
}
