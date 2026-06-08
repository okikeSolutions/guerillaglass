import AVFoundation
import Darwin
@testable import Export
import XCTest

final class ExportPipelineTests: XCTestCase {
    func testExportFailsWithoutVideoTrack() async throws {
        let fileManager = FileManager.default
        let baseURL = try canonicalTemporaryDirectory().appendingPathComponent(UUID().uuidString, isDirectory: true)
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
        let baseURL = try canonicalTemporaryDirectory().appendingPathComponent(UUID().uuidString, isDirectory: true)
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

    func testExportRejectsAncestorSymlinkOutputPath() async throws {
        let fileManager = FileManager.default
        let baseURL = try canonicalTemporaryDirectory().appendingPathComponent(UUID().uuidString, isDirectory: true)
        try fileManager.createDirectory(at: baseURL, withIntermediateDirectories: true)
        defer { try? fileManager.removeItem(at: baseURL) }

        let sourceURL = baseURL.appendingPathComponent("source.mov")
        try makeVideoFile(at: sourceURL)
        let realDirectory = baseURL.appendingPathComponent("real", isDirectory: true)
        try fileManager.createDirectory(at: realDirectory.appendingPathComponent("sub", isDirectory: true), withIntermediateDirectories: true)
        let linkDirectory = baseURL.appendingPathComponent("link", isDirectory: true)
        try fileManager.createSymbolicLink(at: linkDirectory, withDestinationURL: realDirectory)
        let outputURL = linkDirectory.appendingPathComponent("sub/export.mp4")

        do {
            _ = try await ExportPipeline().export(
                recordingURL: sourceURL,
                preset: Presets.h2641080p30,
                trimRange: nil,
                outputURL: outputURL
            )
            XCTFail("Expected export to reject ancestor symlink output path.")
        } catch {
            XCTAssertFalse(fileManager.fileExists(atPath: realDirectory.appendingPathComponent("sub/export.mp4").path))
        }
    }

    func testExportRejectsExistingDirectoryOutputPathWithoutDeletingIt() async throws {
        let fileManager = FileManager.default
        let baseURL = try canonicalTemporaryDirectory().appendingPathComponent(UUID().uuidString, isDirectory: true)
        try fileManager.createDirectory(at: baseURL, withIntermediateDirectories: true)
        defer { try? fileManager.removeItem(at: baseURL) }

        let sourceURL = baseURL.appendingPathComponent("source.mov")
        try makeVideoFile(at: sourceURL)
        let outputURL = baseURL.appendingPathComponent("Reports.mov", isDirectory: true)
        try fileManager.createDirectory(at: outputURL, withIntermediateDirectories: true)
        let markerURL = outputURL.appendingPathComponent("marker.txt")
        try Data("do-not-delete".utf8).write(to: markerURL)

        do {
            _ = try await ExportPipeline().export(
                recordingURL: sourceURL,
                preset: Presets.h2641080p30,
                trimRange: nil,
                outputURL: outputURL
            )
            XCTFail("Expected export to reject existing directory output path.")
        } catch {
            XCTAssertTrue(fileManager.fileExists(atPath: outputURL.path))
            XCTAssertEqual(try String(contentsOf: markerURL), "do-not-delete")
        }
    }

    func testExportRejectsSymlinkOutputPath() async throws {
        let fileManager = FileManager.default
        let baseURL = try canonicalTemporaryDirectory().appendingPathComponent(UUID().uuidString, isDirectory: true)
        try fileManager.createDirectory(at: baseURL, withIntermediateDirectories: true)
        defer { try? fileManager.removeItem(at: baseURL) }

        let sourceURL = baseURL.appendingPathComponent("source.mov")
        try makeVideoFile(at: sourceURL)

        let targetURL = baseURL.appendingPathComponent("target.mp4")
        try Data("do-not-overwrite".utf8).write(to: targetURL)
        let outputURL = baseURL.appendingPathComponent("output.mp4")
        try fileManager.createSymbolicLink(at: outputURL, withDestinationURL: targetURL)

        do {
            _ = try await ExportPipeline().export(
                recordingURL: sourceURL,
                preset: Presets.h2641080p30,
                trimRange: nil,
                outputURL: outputURL
            )
            XCTFail("Expected export to reject symlink output path.")
        } catch {
            XCTAssertEqual(try String(contentsOf: targetURL), "do-not-overwrite")
        }
    }

    private func canonicalTemporaryDirectory() throws -> URL {
        let temporaryPath = FileManager.default.temporaryDirectory.path
        guard let resolved = realpath(temporaryPath, nil) else {
            throw POSIXError(POSIXErrorCode(rawValue: errno) ?? .EIO)
        }
        defer { free(resolved) }
        return URL(fileURLWithPath: String(cString: resolved), isDirectory: true)
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
