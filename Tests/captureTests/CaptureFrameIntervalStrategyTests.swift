@testable import Capture
import CoreMedia
import XCTest

final class CaptureFrameIntervalStrategyTests: XCTestCase {
    func testLowFrameRatesUseExactIntervals() {
        XCTAssertEqual(
            CaptureFrameIntervalStrategy.minimumFrameInterval(for: 24).seconds,
            1.0 / 24.0,
            accuracy: 0.000_001
        )
        XCTAssertEqual(
            CaptureFrameIntervalStrategy.minimumFrameInterval(for: 30).seconds,
            1.0 / 30.0,
            accuracy: 0.000_001
        )
    }

    func testHighFrameRatesUseOversubscribedIntervals() {
        XCTAssertEqual(
            CaptureFrameIntervalStrategy.minimumFrameInterval(for: 60).seconds,
            1.0 / 66.0,
            accuracy: 0.000_01
        )
        XCTAssertEqual(
            CaptureFrameIntervalStrategy.minimumFrameInterval(for: 120).seconds,
            1.0 / 132.0,
            accuracy: 0.000_01
        )
    }
}
