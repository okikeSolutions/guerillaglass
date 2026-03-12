@testable import Capture
import CoreGraphics
import XCTest

final class CaptureSourceCapabilityTests: XCTestCase {
    func testSupportedFrameRatesExpose120OnlyForHighRefreshSources() {
        XCTAssertEqual(CaptureSourceCapability.supportedFrameRates(refreshHz: nil), [24, 30, 60])
        XCTAssertEqual(CaptureSourceCapability.supportedFrameRates(refreshHz: 60), [24, 30, 60])
        XCTAssertEqual(CaptureSourceCapability.supportedFrameRates(refreshHz: 118), [24, 30, 60, 120])
        XCTAssertEqual(CaptureSourceCapability.supportedFrameRates(refreshHz: 120), [24, 30, 60, 120])
        XCTAssertEqual(
            CaptureSourceCapability.supportedFrameRates(
                refreshHz: 120,
                width: 1512,
                height: 949,
                pixelScale: 2
            ),
            [24, 30, 60]
        )
    }

    func testValidateRejectsUnsupportedHighFrameRateRequest() {
        XCTAssertThrowsError(try CaptureSourceCapability.validate(frameRate: 120, refreshHz: 60)) { error in
            guard case let CaptureError.unsupportedCaptureFrameRate(requested, supported, refreshHz) = error else {
                XCTFail("Unexpected error: \(error)")
                return
            }
            XCTAssertEqual(requested, 120)
            XCTAssertEqual(supported, [24, 30, 60])
            XCTAssertEqual(refreshHz ?? 0, 60, accuracy: 0.000_001)
        }
    }

    func testBestDisplayCandidatePicksLargestOverlapThenHighestRefresh() {
        let rect = CGRect(x: 100, y: 100, width: 400, height: 400)
        let primary = CaptureSourceCapability.DisplayCandidate(
            displayID: 1,
            frame: CGRect(x: 0, y: 0, width: 600, height: 600),
            refreshHz: 60,
            pixelScale: 2
        )
        let secondary = CaptureSourceCapability.DisplayCandidate(
            displayID: 2,
            frame: CGRect(x: 250, y: 250, width: 600, height: 600),
            refreshHz: 120,
            pixelScale: 2
        )

        let preferred = CaptureSourceCapability.bestDisplayCandidate(for: rect, candidates: [secondary, primary])

        XCTAssertEqual(preferred?.displayID, 1)
    }

    func testBestDisplayCandidateUsesRefreshRateAsTieBreaker() {
        let rect = CGRect(x: 0, y: 0, width: 200, height: 200)
        let lowerRefresh = CaptureSourceCapability.DisplayCandidate(
            displayID: 3,
            frame: CGRect(x: 0, y: 0, width: 200, height: 200),
            refreshHz: 60,
            pixelScale: 2
        )
        let higherRefresh = CaptureSourceCapability.DisplayCandidate(
            displayID: 4,
            frame: CGRect(x: 0, y: 0, width: 200, height: 200),
            refreshHz: 120,
            pixelScale: 2
        )

        let preferred = CaptureSourceCapability.bestDisplayCandidate(for: rect, candidates: [lowerRefresh, higherRefresh])

        XCTAssertEqual(preferred?.displayID, 4)
    }

    func testEffectiveNativePixelCountUsesPixelScaleSquared() {
        let effectivePixelCount = CaptureSourceCapability.effectiveNativePixelCount(
            width: 1512,
            height: 949,
            pixelScale: 2
        )

        XCTAssertEqual(effectivePixelCount, 5_739_552, accuracy: 0.5)
    }
}
