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

        try await engine.startRecording()
        let isRecording = await waitForCondition {
            await MainActor.run { engine.isRecording }
        }
        XCTAssertTrue(isRecording)

        let first = try makeVideoSampleBuffer(presentationTime: .zero)
        let second = try makeVideoSampleBuffer(presentationTime: CMTime(value: 1, timescale: 30))
        engine.appendVideoSample(first)
        engine.appendVideoSample(second)
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

    func testHandleAudioBufferUpdatesTelemetryAudioLevel() async {
        let engine = CaptureEngine()
        let buffer = makeAudioPCMBuffer()
        let time = AVAudioTime(sampleTime: 0, atRate: buffer.format.sampleRate)

        engine.handleAudioBuffer(buffer, time: time)

        let hasLevel = await waitForCondition {
            engine.telemetrySnapshot().audioLevelDbfs != nil
        }
        XCTAssertTrue(hasLevel)
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

    func makeAudioPCMBuffer() -> AVAudioPCMBuffer {
        let format = AVAudioFormat(standardFormatWithSampleRate: 44100, channels: 1)!
        let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 1024)!
        buffer.frameLength = buffer.frameCapacity
        if let samples = buffer.floatChannelData?.pointee {
            for index in 0 ..< Int(buffer.frameLength) {
                samples[index] = 0.25
            }
        }
        return buffer
    }
}

private enum CaptureRecordingTestError: Error {
    case cannotCreatePixelBuffer
    case cannotCreateFormatDescription
    case cannotCreateSampleBuffer
}
