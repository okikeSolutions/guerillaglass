@testable import Capture
import CoreMedia
import XCTest

final class CaptureTelemetryStoreTests: XCTestCase {
    func testRecordSourceStatusDropIncrementsSourceDropCounter() {
        let store = CaptureTelemetryStore()

        store.recordSourceStatusDrop()
        let snapshot = store.snapshot()

        XCTAssertEqual(snapshot.sourceDroppedFrames, 1)
    }

    func testRecordCompleteFrameTracksTimingDropsAndAchievedFPS() {
        let store = CaptureTelemetryStore()

        store.recordCompleteFrame(
            presentationTimestamp: CMTime(seconds: 0, preferredTimescale: 600),
            captureFrameRate: 30
        )
        store.recordCompleteFrame(
            presentationTimestamp: CMTime(seconds: 0.2, preferredTimescale: 600),
            captureFrameRate: 30
        )
        let snapshot = store.snapshot()

        XCTAssertEqual(snapshot.sourceDroppedFrames, 5)
        XCTAssertEqual(snapshot.achievedFps, 5, accuracy: 0.000_001)
    }

    func testRecordWriterSampleTracksBackpressureAndFailedDropsOnly() {
        let store = CaptureTelemetryStore()

        store.recordWriterAppendSample(outcome: .droppedBackpressure, appendDurationMs: 1.2)
        store.recordWriterAppendSample(outcome: .failed, appendDurationMs: 2.4)
        store.recordWriterAppendSample(outcome: .droppedWriterState, appendDurationMs: 0.4)
        store.recordWriterAppendSample(outcome: .appended, appendDurationMs: 1.6)
        let snapshot = store.snapshot()

        XCTAssertEqual(snapshot.writerDroppedFrames, 2)
        XCTAssertEqual(snapshot.writerBackpressureDrops, 1)
        XCTAssertGreaterThan(snapshot.writerAppendMs, 0)
    }

    func testTimingMetricsUseSmoothing() {
        let store = CaptureTelemetryStore()

        store.recordCaptureCallbackDuration(4)
        XCTAssertEqual(store.snapshot().captureCallbackMs, 4, accuracy: 0.000_001)

        store.recordCaptureCallbackDuration(8)
        XCTAssertEqual(store.snapshot().captureCallbackMs, 4.8, accuracy: 0.000_001)
    }

    func testResetClearsAllTelemetryState() {
        let store = CaptureTelemetryStore()

        store.recordSourceStatusDrop()
        store.recordCaptureCallbackDuration(2.5)
        store.recordRecordQueueLag(1.5)
        store.recordWriterAppendSample(outcome: .failed, appendDurationMs: 3.5)
        store.reset()
        let snapshot = store.snapshot()

        XCTAssertEqual(snapshot.sourceDroppedFrames, 0)
        XCTAssertEqual(snapshot.writerDroppedFrames, 0)
        XCTAssertEqual(snapshot.writerBackpressureDrops, 0)
        XCTAssertEqual(snapshot.achievedFps, 0, accuracy: 0.000_001)
        XCTAssertEqual(snapshot.captureCallbackMs, 0, accuracy: 0.000_001)
        XCTAssertEqual(snapshot.recordQueueLagMs, 0, accuracy: 0.000_001)
        XCTAssertEqual(snapshot.writerAppendMs, 0, accuracy: 0.000_001)
    }
}
