import AVFoundation
@testable import Export
import XCTest

final class ExportPipelineTests: XCTestCase {
    func testExportFailsWithoutVideoTrack() async throws {
        let fileManager = FileManager.default
        let baseURL = fileManager.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try fileManager.createDirectory(at: baseURL, withIntermediateDirectories: true)
        defer { try? fileManager.removeItem(at: baseURL) }

        let audioURL = baseURL.appendingPathComponent("audio.caf")
        try makeAudioFile(at: audioURL)

        let outputURL = baseURL.appendingPathComponent("output.mp4")
        let pipeline = ExportPipeline()

        do {
            _ = try await pipeline.export(
                recordingURL: audioURL,
                preset: Presets.default,
                trimRange: nil,
                outputURL: outputURL
            )
            XCTFail("Expected export to fail without a video track.")
        } catch let error as ExportPipeline.ExportError {
            guard case .missingVideoTrack = error else {
                XCTFail("Unexpected export error: \(error)")
                return
            }
        } catch {
            XCTFail("Unexpected export error: \(error)")
        }
    }

    func testExportCreatesFileForVideoAsset() async throws {
        let fileManager = FileManager.default
        let baseURL = fileManager.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try fileManager.createDirectory(at: baseURL, withIntermediateDirectories: true)
        defer { try? fileManager.removeItem(at: baseURL) }

        let sourceURL = baseURL.appendingPathComponent("source.mov")
        try makeVideoFile(at: sourceURL)

        let preset = Presets.h2641080p30

        let outputURL = baseURL.appendingPathComponent("output.mp4")
        let pipeline = ExportPipeline()
        do {
            _ = try await pipeline.export(
                recordingURL: sourceURL,
                preset: preset,
                trimRange: nil,
                outputURL: outputURL
            )
        } catch let error as ExportPipeline.ExportError {
            if case .cannotCreateSession = error {
                throw XCTSkip("Preset not supported.")
            }
            throw error
        }

        XCTAssertTrue(fileManager.fileExists(atPath: outputURL.path))
    }

    private func makeAudioFile(at url: URL) throws {
        let format = AVAudioFormat(standardFormatWithSampleRate: 44100, channels: 1)!
        let file = try AVAudioFile(forWriting: url, settings: format.settings)
        let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 1024)!
        buffer.frameLength = buffer.frameCapacity
        try file.write(from: buffer)
    }

    private func makeVideoFile(at url: URL) throws {
        let writer = try AVAssetWriter(outputURL: url, fileType: .mov)
        let width = 16
        let height = 16
        let settings: [String: Any] = [
            AVVideoCodecKey: AVVideoCodecType.h264,
            AVVideoWidthKey: width,
            AVVideoHeightKey: height
        ]
        let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
        input.expectsMediaDataInRealTime = false
        guard writer.canAdd(input) else {
            throw TestError.cannotAddInput
        }
        writer.add(input)

        let adaptor = AVAssetWriterInputPixelBufferAdaptor(
            assetWriterInput: input,
            sourcePixelBufferAttributes: [
                kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
                kCVPixelBufferWidthKey as String: width,
                kCVPixelBufferHeightKey as String: height
            ]
        )

        guard let pixelBuffer = makePixelBuffer(width: width, height: height) else {
            throw TestError.cannotCreatePixelBuffer
        }

        writer.startWriting()
        writer.startSession(atSourceTime: .zero)
        guard input.isReadyForMoreMediaData else {
            throw TestError.inputNotReady
        }
        adaptor.append(pixelBuffer, withPresentationTime: .zero)
        input.markAsFinished()

        let group = DispatchGroup()
        group.enter()
        writer.finishWriting {
            group.leave()
        }
        group.wait()

        if writer.status != .completed {
            throw TestError.writerFailed(writer.error)
        }
    }

    private func makePixelBuffer(width: Int, height: Int) -> CVPixelBuffer? {
        let attributes = [
            kCVPixelBufferCGImageCompatibilityKey: true,
            kCVPixelBufferCGBitmapContextCompatibilityKey: true
        ] as CFDictionary
        var pixelBuffer: CVPixelBuffer?
        let status = CVPixelBufferCreate(
            kCFAllocatorDefault,
            width,
            height,
            kCVPixelFormatType_32BGRA,
            attributes,
            &pixelBuffer
        )
        guard status == kCVReturnSuccess else {
            return nil
        }
        return pixelBuffer
    }
}

private enum TestError: Error {
    case cannotAddInput
    case cannotCreatePixelBuffer
    case inputNotReady
    case writerFailed(Error?)
}
