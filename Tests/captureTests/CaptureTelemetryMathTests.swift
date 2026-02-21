@testable import Capture
import XCTest

final class CaptureTelemetryMathTests: XCTestCase {
    func testEstimateMissedFramesReturnsZeroForNearNominalCadence() {
        let missed = CaptureTelemetryMath.estimateMissedFrames(
            deltaSeconds: 0.034,
            expectedFrameIntervalSeconds: 1.0 / 30.0
        )

        XCTAssertEqual(missed, 0)
    }

    func testEstimateMissedFramesReturnsPositiveForLargeGap() {
        let missed = CaptureTelemetryMath.estimateMissedFrames(
            deltaSeconds: 0.20,
            expectedFrameIntervalSeconds: 1.0 / 30.0
        )

        XCTAssertEqual(missed, 5)
    }

    func testEstimateMissedFramesReturnsZeroForInvalidInputs() {
        XCTAssertEqual(
            CaptureTelemetryMath.estimateMissedFrames(
                deltaSeconds: .nan,
                expectedFrameIntervalSeconds: 1.0 / 30.0
            ),
            0
        )
        XCTAssertEqual(
            CaptureTelemetryMath.estimateMissedFrames(
                deltaSeconds: 1.0,
                expectedFrameIntervalSeconds: 0
            ),
            0
        )
    }

    func testPercentageHandlesValidAndEmptyDenominators() {
        XCTAssertEqual(
            CaptureTelemetryMath.percentage(numerator: 5, denominator: 200),
            2.5,
            accuracy: 0.000_001
        )
        XCTAssertEqual(
            CaptureTelemetryMath.percentage(numerator: 1, denominator: 0),
            0
        )
    }

    func testAchievedFramesPerSecondUsesPTSWindow() {
        XCTAssertEqual(
            CaptureTelemetryMath.achievedFramesPerSecond(
                frameCount: 121,
                firstPTSSeconds: 0,
                lastPTSSeconds: 4
            ),
            30,
            accuracy: 0.000_001
        )

        XCTAssertEqual(
            CaptureTelemetryMath.achievedFramesPerSecond(
                frameCount: 1,
                firstPTSSeconds: 0,
                lastPTSSeconds: 4
            ),
            0
        )
    }
}
