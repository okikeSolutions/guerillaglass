import AVFoundation
@testable import Export
import XCTest

final class TrimRangeCalculatorTests: XCTestCase {
    func testClampedDefaultsEndToDurationWhenZero() {
        let result = TrimRangeCalculator.clamped(start: 2, end: 0, duration: 10)
        XCTAssertEqual(result, TrimRangeValues(start: 2, end: 10))
    }

    func testClampedMovesEndForwardWhenBeforeStart() {
        let result = TrimRangeCalculator.clamped(start: 8, end: 4, duration: 10)
        XCTAssertEqual(result, TrimRangeValues(start: 8, end: 8))
    }

    func testTimeRangeReturnsNilWhenEndBeforeStart() {
        let range = TrimRangeCalculator.timeRange(start: 6, end: 2, duration: 10)
        XCTAssertNil(range)
    }

    func testTimeRangeUsesDurationWhenEndExceeds() {
        let range = TrimRangeCalculator.timeRange(start: 1.5, end: 99, duration: 10)
        XCTAssertNotNil(range)
        XCTAssertEqual(range?.start.seconds ?? 0, 1.5, accuracy: 0.001)
        XCTAssertEqual(range?.duration.seconds ?? 0, 8.5, accuracy: 0.001)
    }

    func testTimeRangeNilWhenDurationIsZero() {
        let range = TrimRangeCalculator.timeRange(start: 0, end: 0, duration: 0)
        XCTAssertNil(range)
    }
}
