import CoreGraphics
import InputTracking
import Project
@testable import UI
import XCTest

final class AutoZoomPlanSupportTests: XCTestCase {
    func testMapEventsToCaptureSpaceUsesContentRectAndPixelScale() {
        let metadata = CaptureMetadata(
            source: .window,
            contentRect: CaptureRect(originX: 100, originY: 200, width: 400, height: 300),
            pixelScale: 2
        )
        let sourceSize = CGSize(width: 800, height: 600)
        let events = [
            makeEvent(xValue: 100, yValue: 500, time: 0),
            makeEvent(xValue: 300, yValue: 350, time: 0.5),
            makeEvent(xValue: 500, yValue: 200, time: 1.0)
        ]

        let mapped = AutoZoomPlanSupport.mapEventsToCaptureSpace(
            events,
            metadata: metadata,
            sourceSize: sourceSize
        )

        XCTAssertEqual(mapped.count, events.count)
        assertPoint(mapped[0].position.cgPoint, equals: CGPoint(x: 0, y: 0))
        assertPoint(mapped[1].position.cgPoint, equals: CGPoint(x: 400, y: 300))
        assertPoint(mapped[2].position.cgPoint, equals: CGPoint(x: 800, y: 600))
    }

    func testCacheKeyIsStableAcrossSmallDurationAndSizeDifferences() {
        let settings = AutoZoomSettings(isEnabled: true, intensity: 0.5, minimumKeyframeInterval: 1.0 / 30.0)
        let events = [makeEvent(xValue: 10, yValue: 20, time: 0)]

        let keyA = AutoZoomPlanSupport.makeCacheKey(
            events: events,
            settings: settings,
            duration: 5.0004,
            sourceSize: CGSize(width: 1920.004, height: 1080.004)
        )
        let keyB = AutoZoomPlanSupport.makeCacheKey(
            events: events,
            settings: settings,
            duration: 5.00049,
            sourceSize: CGSize(width: 1920.0049, height: 1080.0049)
        )

        XCTAssertEqual(keyA, keyB)
    }

    func testCacheKeyChangesWhenEventsOrSettingsChange() {
        let settings = AutoZoomSettings(isEnabled: true, intensity: 0.5, minimumKeyframeInterval: 1.0 / 30.0)
        let sourceSize = CGSize(width: 1920, height: 1080)

        let keyA = AutoZoomPlanSupport.makeCacheKey(
            events: [makeEvent(xValue: 10, yValue: 20, time: 0)],
            settings: settings,
            duration: 5.0,
            sourceSize: sourceSize
        )
        let keyB = AutoZoomPlanSupport.makeCacheKey(
            events: [makeEvent(xValue: 12, yValue: 20, time: 0)],
            settings: settings,
            duration: 5.0,
            sourceSize: sourceSize
        )
        let keyC = AutoZoomPlanSupport.makeCacheKey(
            events: [makeEvent(xValue: 10, yValue: 20, time: 0)],
            settings: AutoZoomSettings(isEnabled: true, intensity: 0.6, minimumKeyframeInterval: 1.0 / 30.0),
            duration: 5.0,
            sourceSize: sourceSize
        )

        XCTAssertNotEqual(keyA, keyB)
        XCTAssertNotEqual(keyA, keyC)
    }

    private func makeEvent(xValue: Double, yValue: Double, time: TimeInterval) -> InputEvent {
        InputEvent(type: .cursorMoved, timestamp: time, position: CGPoint(x: xValue, y: yValue))
    }

    private func assertPoint(_ actual: CGPoint, equals expected: CGPoint, accuracy: CGFloat = 0.001) {
        XCTAssertEqual(actual.x, expected.x, accuracy: accuracy)
        XCTAssertEqual(actual.y, expected.y, accuracy: accuracy)
    }
}
