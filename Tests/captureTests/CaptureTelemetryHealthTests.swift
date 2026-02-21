@testable import Capture
import XCTest

final class CaptureTelemetryHealthTests: XCTestCase {
    func testEvaluateReturnsCriticalWhenEngineErrorPresent() {
        let result = CaptureTelemetryHealthEvaluator.evaluate(
            makeInput(lastError: "runtime error")
        )

        XCTAssertEqual(result.state, .critical)
        XCTAssertEqual(result.reason, .engineError)
    }

    func testEvaluateReturnsCriticalForHighDroppedFrameRate() {
        let result = CaptureTelemetryHealthEvaluator.evaluate(
            makeInput(
                totalFrames: 120,
                droppedFramePercent: 6,
                sourceDroppedFramePercent: 6
            )
        )

        XCTAssertEqual(result.state, .critical)
        XCTAssertEqual(result.reason, .highDroppedFrameRate)
    }

    func testEvaluateReturnsWarningForElevatedDroppedFrameRate() {
        let result = CaptureTelemetryHealthEvaluator.evaluate(
            makeInput(
                totalFrames: 120,
                droppedFramePercent: 1.2,
                sourceDroppedFramePercent: 1.2
            )
        )

        XCTAssertEqual(result.state, .warning)
        XCTAssertEqual(result.reason, .elevatedDroppedFrameRate)
    }

    func testEvaluateReturnsWarningForLowMicLevelWhileRecording() {
        let result = CaptureTelemetryHealthEvaluator.evaluate(
            makeInput(
                totalFrames: 120,
                audioLevelDbfs: -50
            )
        )

        XCTAssertEqual(result.state, .warning)
        XCTAssertEqual(result.reason, .lowMicrophoneLevel)
    }

    func testEvaluateReturnsGoodWithoutAlerts() {
        let result = CaptureTelemetryHealthEvaluator.evaluate(
            makeInput(
                totalFrames: 120,
                audioLevelDbfs: -18
            )
        )

        XCTAssertEqual(result.state, .good)
        XCTAssertNil(result.reason)
    }

    func testEvaluateIgnoresDroppedFrameWarningWhenNotRecording() {
        let result = CaptureTelemetryHealthEvaluator.evaluate(
            makeInput(
                totalFrames: 240,
                droppedFramePercent: 6,
                sourceDroppedFramePercent: 6,
                isRecording: false
            )
        )

        XCTAssertEqual(result.state, .good)
        XCTAssertNil(result.reason)
    }

    func testEvaluateIgnoresDroppedFrameWarningBeforeSampleWindow() {
        let result = CaptureTelemetryHealthEvaluator.evaluate(
            makeInput(
                totalFrames: 45,
                droppedFramePercent: 6,
                sourceDroppedFramePercent: 6
            )
        )

        XCTAssertEqual(result.state, .good)
        XCTAssertNil(result.reason)
    }

    func testEvaluateReturnsWarningForWriterDroppedFrameRate() {
        let result = CaptureTelemetryHealthEvaluator.evaluate(
            makeInput(
                totalFrames: 120,
                droppedFramePercent: 0.5,
                writerDroppedFramePercent: 1.5
            )
        )

        XCTAssertEqual(result.state, .warning)
        XCTAssertEqual(result.reason, .elevatedDroppedFrameRate)
    }

    private func makeInput(
        totalFrames: Int = 0,
        droppedFramePercent: Double = 0,
        sourceDroppedFramePercent: Double = 0,
        writerDroppedFramePercent: Double = 0,
        audioLevelDbfs: Double? = -12,
        lastError: String? = nil,
        isRecording: Bool = true
    ) -> CaptureTelemetryHealthInput {
        CaptureTelemetryHealthInput(
            totalFrames: totalFrames,
            droppedFramePercent: droppedFramePercent,
            sourceDroppedFramePercent: sourceDroppedFramePercent,
            writerDroppedFramePercent: writerDroppedFramePercent,
            audioLevelDbfs: audioLevelDbfs,
            lastError: lastError,
            isRecording: isRecording
        )
    }
}
