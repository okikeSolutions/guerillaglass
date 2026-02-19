@testable import Capture
import XCTest

final class CaptureTelemetryHealthTests: XCTestCase {
    func testEvaluateReturnsCriticalWhenEngineErrorPresent() {
        let result = CaptureTelemetryHealthEvaluator.evaluate(
            droppedFramePercent: 0,
            audioLevelDbfs: -12,
            lastError: "runtime error",
            isRecording: true
        )

        XCTAssertEqual(result.state, .critical)
        XCTAssertEqual(result.reason, .engineError)
    }

    func testEvaluateReturnsCriticalForHighDroppedFrameRate() {
        let result = CaptureTelemetryHealthEvaluator.evaluate(
            droppedFramePercent: 6,
            audioLevelDbfs: -12,
            lastError: nil,
            isRecording: true
        )

        XCTAssertEqual(result.state, .critical)
        XCTAssertEqual(result.reason, .highDroppedFrameRate)
    }

    func testEvaluateReturnsWarningForElevatedDroppedFrameRate() {
        let result = CaptureTelemetryHealthEvaluator.evaluate(
            droppedFramePercent: 1.2,
            audioLevelDbfs: -12,
            lastError: nil,
            isRecording: true
        )

        XCTAssertEqual(result.state, .warning)
        XCTAssertEqual(result.reason, .elevatedDroppedFrameRate)
    }

    func testEvaluateReturnsWarningForLowMicLevelWhileRecording() {
        let result = CaptureTelemetryHealthEvaluator.evaluate(
            droppedFramePercent: 0,
            audioLevelDbfs: -50,
            lastError: nil,
            isRecording: true
        )

        XCTAssertEqual(result.state, .warning)
        XCTAssertEqual(result.reason, .lowMicrophoneLevel)
    }

    func testEvaluateReturnsGoodWithoutAlerts() {
        let result = CaptureTelemetryHealthEvaluator.evaluate(
            droppedFramePercent: 0,
            audioLevelDbfs: -18,
            lastError: nil,
            isRecording: true
        )

        XCTAssertEqual(result.state, .good)
        XCTAssertNil(result.reason)
    }
}
