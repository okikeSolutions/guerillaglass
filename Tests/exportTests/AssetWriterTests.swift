import AVFoundation
@testable import Export
import XCTest

final class AssetWriterTests: XCTestCase {
    func testAppendVideoSynchronouslyConfiguresInputAndAppendsFrame() throws {
        let outputURL = makeOutputURL(fileName: "video-append.mov")
        defer { try? FileManager.default.removeItem(at: outputURL.deletingLastPathComponent()) }

        let writer = try AssetWriter(outputURL: outputURL)
        let sampleBuffer = try makeVideoSampleBuffer(
            width: 16,
            height: 16,
            presentationTime: .zero
        )

        let outcome = writer.appendVideoSynchronously(sampleBuffer)

        assertVideoOutcome(outcome, expected: .appended)
        XCTAssertNotNil(writer.videoInput)
        XCTAssertNotNil(writer.videoBaseTime)
    }

    func testAppendVideoSynchronouslyDropsWhenFinishing() throws {
        let outputURL = makeOutputURL(fileName: "video-dropped.mov")
        defer { try? FileManager.default.removeItem(at: outputURL.deletingLastPathComponent()) }

        let writer = try AssetWriter(outputURL: outputURL)
        writer.isFinishing = true
        let sampleBuffer = try makeVideoSampleBuffer(
            width: 16,
            height: 16,
            presentationTime: .zero
        )

        let outcome = writer.appendVideoSynchronously(sampleBuffer)
        assertVideoOutcome(outcome, expected: .droppedWriterState)
    }

    func testAppendAudioSynchronouslyRequiresVideoBaseTime() throws {
        let outputURL = makeOutputURL(fileName: "audio-no-video-base.mov")
        defer { try? FileManager.default.removeItem(at: outputURL.deletingLastPathComponent()) }

        let writer = try AssetWriter(outputURL: outputURL)
        let buffer = makeAudioPCMBuffer()
        let time = AVAudioTime(sampleTime: 0, atRate: buffer.format.sampleRate)

        writer.appendAudioSynchronously(buffer: buffer, time: time)

        XCTAssertNil(writer.audioInput)
    }

    func testAppendAudioSynchronouslyConfiguresInputAfterVideoBaseTime() throws {
        let outputURL = makeOutputURL(fileName: "audio-with-video-base.mov")
        defer { try? FileManager.default.removeItem(at: outputURL.deletingLastPathComponent()) }

        let writer = try AssetWriter(outputURL: outputURL)
        writer.videoBaseTime = .zero
        let buffer = makeAudioPCMBuffer()
        let time = AVAudioTime(sampleTime: 0, atRate: buffer.format.sampleRate)

        writer.appendAudioSynchronously(buffer: buffer, time: time)

        XCTAssertNotNil(writer.audioInput)
    }

    func testFinishSynchronouslyCompletesSuccessfullyAfterVideoAppend() throws {
        let outputURL = makeOutputURL(fileName: "finish.mov")
        defer { try? FileManager.default.removeItem(at: outputURL.deletingLastPathComponent()) }

        let writer = try AssetWriter(outputURL: outputURL)
        let sampleBuffer = try makeVideoSampleBuffer(
            width: 16,
            height: 16,
            presentationTime: .zero
        )
        let outcome = writer.appendVideoSynchronously(sampleBuffer)
        assertVideoOutcome(outcome, expected: .appended)

        let completion = expectation(description: "finish writing")
        var finishedURL: URL?
        var finishError: Error?
        writer.finishSynchronously { result in
            switch result {
            case let .success(url):
                finishedURL = url
            case let .failure(error):
                finishError = error
            }
            completion.fulfill()
        }

        waitForExpectations(timeout: 5)
        XCTAssertNil(finishError)
        XCTAssertEqual(finishedURL, outputURL)
        XCTAssertTrue(FileManager.default.fileExists(atPath: outputURL.path))
    }
}

private extension AssetWriterTests {
    func makeOutputURL(fileName: String) -> URL {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory.appendingPathComponent(fileName)
    }

    func makeVideoSampleBuffer(
        width: Int,
        height: Int,
        presentationTime: CMTime
    ) throws -> CMSampleBuffer {
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
            throw AssetWriterTestError.cannotCreatePixelBuffer
        }

        var formatDescription: CMVideoFormatDescription?
        let formatStatus = CMVideoFormatDescriptionCreateForImageBuffer(
            allocator: kCFAllocatorDefault,
            imageBuffer: pixelBuffer,
            formatDescriptionOut: &formatDescription
        )
        guard formatStatus == noErr, let formatDescription else {
            throw AssetWriterTestError.cannotCreateFormatDescription
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
            throw AssetWriterTestError.cannotCreateSampleBuffer
        }
        return sampleBuffer
    }

    func makeAudioPCMBuffer() -> AVAudioPCMBuffer {
        let format = AVAudioFormat(standardFormatWithSampleRate: 44100, channels: 1)!
        let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 1024)!
        buffer.frameLength = buffer.frameCapacity
        if let samples = buffer.floatChannelData?.pointee {
            for index in 0 ..< Int(buffer.frameLength) {
                samples[index] = 0.1
            }
        }
        return buffer
    }

    func assertVideoOutcome(
        _ actual: AssetWriter.VideoAppendOutcome,
        expected: AssetWriter.VideoAppendOutcome
    ) {
        switch (actual, expected) {
        case (.appended, .appended),
             (.droppedBackpressure, .droppedBackpressure),
             (.droppedWriterState, .droppedWriterState),
             (.failed, .failed):
            return
        default:
            XCTFail("Expected \(expected) but got \(actual)")
        }
    }
}

private enum AssetWriterTestError: Error {
    case cannotCreatePixelBuffer
    case cannotCreateFormatDescription
    case cannotCreateSampleBuffer
}
