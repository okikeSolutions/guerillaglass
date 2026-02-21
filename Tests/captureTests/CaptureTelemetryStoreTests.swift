@testable import Capture
import CoreMedia
import XCTest

final class CaptureTelemetryStoreTests: XCTestCase {
    func testRecordSourceStatusDropIncrementsDroppedCounters() {
        let store = CaptureTelemetryStore()

        store.recordSourceStatusDrop()
        let snapshot = store.snapshot()

        XCTAssertEqual(snapshot.totalFrames, 1)
        XCTAssertEqual(snapshot.droppedFrames, 1)
        XCTAssertEqual(snapshot.sourceDroppedFrames, 1)
        XCTAssertEqual(snapshot.droppedFramePercent, 100, accuracy: 0.000_001)
        XCTAssertEqual(snapshot.sourceDroppedFramePercent, 100, accuracy: 0.000_001)
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

        XCTAssertEqual(snapshot.totalFrames, 7)
        XCTAssertEqual(snapshot.droppedFrames, 5)
        XCTAssertEqual(snapshot.sourceDroppedFrames, 5)
        XCTAssertEqual(snapshot.sourceDroppedFramePercent, 71.428_571, accuracy: 0.000_01)
        XCTAssertEqual(snapshot.achievedFps, 5, accuracy: 0.000_001)
    }

    func testRecordWriterOutcomeTracksBackpressureAndFailedDropsOnly() {
        let store = CaptureTelemetryStore()

        store.recordWriterAppendOutcome(.droppedBackpressure)
        store.recordWriterAppendOutcome(.failed)
        store.recordWriterAppendOutcome(.droppedWriterState)
        store.recordWriterAppendOutcome(.appended)
        let snapshot = store.snapshot()

        XCTAssertEqual(snapshot.writerDroppedFrames, 2)
        XCTAssertEqual(snapshot.writerBackpressureDrops, 1)
        XCTAssertEqual(snapshot.droppedFrames, 2)
        XCTAssertEqual(snapshot.writerDroppedFramePercent, 0, accuracy: 0.000_001)
    }

    func testRecordAudioLevelUsesSmoothingForSubsequentSamples() {
        let store = CaptureTelemetryStore()

        store.recordAudioLevel(-20)
        XCTAssertEqual(store.snapshot().audioLevelDbfs ?? 0, -20, accuracy: 0.000_001)

        store.recordAudioLevel(-10)
        XCTAssertEqual(store.snapshot().audioLevelDbfs ?? 0, -18.2, accuracy: 0.000_001)
    }

    func testResetClearsAllTelemetryState() {
        let store = CaptureTelemetryStore()

        store.recordSourceStatusDrop()
        store.recordWriterAppendOutcome(.failed)
        store.recordAudioLevel(-14)
        store.reset()
        let snapshot = store.snapshot()

        XCTAssertEqual(snapshot.totalFrames, 0)
        XCTAssertEqual(snapshot.droppedFrames, 0)
        XCTAssertEqual(snapshot.sourceDroppedFrames, 0)
        XCTAssertEqual(snapshot.writerDroppedFrames, 0)
        XCTAssertEqual(snapshot.writerBackpressureDrops, 0)
        XCTAssertEqual(snapshot.achievedFps, 0, accuracy: 0.000_001)
        XCTAssertNil(snapshot.audioLevelDbfs)
    }
}
