import AVFoundation
@testable import Capture
import XCTest

final class CaptureRecordingTests: XCTestCase {
    func testStartRecordingThrowsWhenCaptureIsNotRunning() async {
        let engine = CaptureEngine()

        do {
            try await engine.startRecording()
            XCTFail("Expected startRecording to throw when capture is not running.")
        } catch let error as CaptureError {
            guard case .captureNotRunning = error else {
                XCTFail("Unexpected capture error: \(error)")
                return
            }
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }

    func testStartAndStopRecordingWithVideoSamplesProducesRecordingURL() async throws {
        let engine = CaptureEngine()
        await MainActor.run {
            engine.setRunning(true)
        }

        let startTask = Task {
            try await engine.startRecording()
        }
        let primingStarted = await waitForCondition {
            engine.activeRecordingOutputURL() != nil
        }
        XCTAssertTrue(primingStarted)
        try engine.appendVideoSample(makeVideoSampleBuffer(presentationTime: .zero))
        try engine.appendVideoSample(makeVideoSampleBuffer(presentationTime: CMTime(value: 1, timescale: 30)))
        try engine.appendVideoSample(makeVideoSampleBuffer(presentationTime: CMTime(value: 2, timescale: 30)))
        try await startTask.value
        let isRecording = await waitForCondition {
            await MainActor.run { engine.isRecording }
        }
        XCTAssertTrue(isRecording)

        let fourth = try makeVideoSampleBuffer(presentationTime: CMTime(value: 3, timescale: 30))
        engine.appendVideoSample(fourth)
        try await Task.sleep(nanoseconds: 200_000_000)

        await engine.stopRecording()
        let stopped = await waitForCondition {
            await MainActor.run { !engine.isRecording }
        }
        XCTAssertTrue(stopped)

        let outputURL = await MainActor.run { engine.recordingURL }
        XCTAssertNotNil(outputURL)
        if let outputURL {
            XCTAssertTrue(FileManager.default.fileExists(atPath: outputURL.path))
            try? FileManager.default.removeItem(at: outputURL)
        }
    }

    func testAppendVideoSampleUpdatesTimingTelemetry() async throws {
        let engine = CaptureEngine()
        await MainActor.run {
            engine.setRunning(true)
        }

        let startTask = Task {
            try await engine.startRecording()
        }
        let primingStarted = await waitForCondition {
            engine.activeRecordingOutputURL() != nil
        }
        XCTAssertTrue(primingStarted)
        try engine.appendVideoSample(makeVideoSampleBuffer(presentationTime: .zero))
        try engine.appendVideoSample(makeVideoSampleBuffer(presentationTime: CMTime(value: 1, timescale: 30)))
        try engine.appendVideoSample(makeVideoSampleBuffer(presentationTime: CMTime(value: 2, timescale: 30)))
        try await startTask.value
        let sampleBuffer = try makeVideoSampleBuffer(presentationTime: CMTime(value: 3, timescale: 30))
        engine.appendVideoSample(sampleBuffer)

        let hasWriterTiming = await waitForCondition {
            let telemetry = engine.telemetrySnapshot()
            return telemetry.recordQueueLagMs >= 0 && telemetry.writerAppendMs > 0
        }
        XCTAssertTrue(hasWriterTiming)
    }

    func testStartRecordingFailsWhenPrimingDoesNotStabilizeInTime() async {
        let engine = CaptureEngine()
        await MainActor.run {
            engine.setRunning(true)
        }

        do {
            try await engine.startRecording()
            XCTFail("Expected priming to fail when no stable samples arrive.")
        } catch let error as CaptureError {
            guard case let .captureStartUnstable(frameRate) = error else {
                XCTFail("Unexpected capture error: \(error)")
                return
            }
            XCTAssertEqual(frameRate, CaptureFrameRatePolicy.defaultValue)
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }

    func testLoadAndClearRecordingUpdatesState() async {
        let engine = CaptureEngine()
        let recordingURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("guerillaglass-recording-\(UUID().uuidString).mov")

        engine.loadRecording(from: recordingURL)
        let loaded = await waitForCondition {
            await MainActor.run { engine.recordingURL == recordingURL }
        }
        XCTAssertTrue(loaded)

        engine.clearRecording()
        let cleared = await waitForCondition {
            await MainActor.run {
                engine.recordingURL == nil && engine.recordingDuration == 0
            }
        }
        XCTAssertTrue(cleared)
    }
}

private extension CaptureRecordingTests {
    func waitForCondition(
        timeoutNanoseconds: UInt64 = 1_500_000_000,
        pollNanoseconds: UInt64 = 20_000_000,
        condition: @escaping () async -> Bool
    ) async -> Bool {
        let deadline = DispatchTime.now().uptimeNanoseconds + timeoutNanoseconds
        while DispatchTime.now().uptimeNanoseconds < deadline {
            if await condition() {
                return true
            }
            try? await Task.sleep(nanoseconds: pollNanoseconds)
        }
        return await condition()
    }

    func makeVideoSampleBuffer(presentationTime: CMTime) throws -> CMSampleBuffer {
        let width = 16
        let height = 16
        var pixelBuffer: CVPixelBuffer?
        let attributes: CFDictionary = [
            kCVPixelBufferCGImageCompatibilityKey: true,
            kCVPixelBufferCGBitmapContextCompatibilityKey: true
        ] as CFDictionary
        let pixelBufferStatus = CVPixelBufferCreate(
            kCFAllocatorDefault,
            width,
            height,
            kCVPixelFormatType_32BGRA,
            attributes,
            &pixelBuffer
        )
        guard pixelBufferStatus == kCVReturnSuccess, let pixelBuffer else {
            throw CaptureRecordingTestError.cannotCreatePixelBuffer
        }

        var formatDescription: CMVideoFormatDescription?
        let formatStatus = CMVideoFormatDescriptionCreateForImageBuffer(
            allocator: kCFAllocatorDefault,
            imageBuffer: pixelBuffer,
            formatDescriptionOut: &formatDescription
        )
        guard formatStatus == noErr, let formatDescription else {
            throw CaptureRecordingTestError.cannotCreateFormatDescription
        }

        var timing = CMSampleTimingInfo(
            duration: CMTime(value: 1, timescale: 30),
            presentationTimeStamp: presentationTime,
            decodeTimeStamp: .invalid
        )
        var sampleBuffer: CMSampleBuffer?
        let sampleStatus = CMSampleBufferCreateReadyWithImageBuffer(
            allocator: kCFAllocatorDefault,
            imageBuffer: pixelBuffer,
            formatDescription: formatDescription,
            sampleTiming: &timing,
            sampleBufferOut: &sampleBuffer
        )
        guard sampleStatus == noErr, let sampleBuffer else {
            throw CaptureRecordingTestError.cannotCreateSampleBuffer
        }
        return sampleBuffer
    }
}

private enum CaptureRecordingTestError: Error {
    case cannotCreatePixelBuffer
    case cannotCreateFormatDescription
    case cannotCreateSampleBuffer
}
