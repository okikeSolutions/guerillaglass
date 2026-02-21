@testable import Capture
import XCTest

final class CaptureFrameRatePolicyTests: XCTestCase {
    func testSupportedValuesIncludeExpectedFrameRates() {
        XCTAssertEqual(CaptureFrameRatePolicy.supportedValues, [24, 30, 60])
        XCTAssertEqual(CaptureFrameRatePolicy.defaultValue, 30)
    }

    func testIsSupportedRecognizesAllowedAndDisallowedFrameRates() {
        XCTAssertTrue(CaptureFrameRatePolicy.isSupported(24))
        XCTAssertTrue(CaptureFrameRatePolicy.isSupported(30))
        XCTAssertTrue(CaptureFrameRatePolicy.isSupported(60))
        XCTAssertFalse(CaptureFrameRatePolicy.isSupported(15))
        XCTAssertFalse(CaptureFrameRatePolicy.isSupported(120))
    }

    func testSanitizeFallsBackToDefaultForUnsupportedFrameRates() {
        XCTAssertEqual(CaptureFrameRatePolicy.sanitize(24), 24)
        XCTAssertEqual(CaptureFrameRatePolicy.sanitize(60), 60)
        XCTAssertEqual(CaptureFrameRatePolicy.sanitize(12), CaptureFrameRatePolicy.defaultValue)
    }
}
