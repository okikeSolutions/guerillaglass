import AppKit
import Automation
import AVFoundation
import Darwin
@testable import Export
import XCTest

// swiftlint:disable type_body_length
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

    func testTimelineCompositionKeepsClipGapProgramDuration() async throws {
        let fileManager = FileManager.default
        let baseURL = try canonicalTemporaryDirectory().appendingPathComponent(UUID().uuidString, isDirectory: true)
        try fileManager.createDirectory(at: baseURL, withIntermediateDirectories: true)
        defer { try? fileManager.removeItem(at: baseURL) }

        let sourceURL = baseURL.appendingPathComponent("source.mov")
        try makeVideoFile(at: sourceURL, durationSeconds: 4)
        let asset = AVAsset(url: sourceURL)
        let timeline = ExportTimelineDocument(items: [
            .clip(ExportTimelineClip(id: "clip-1", sourceStartSeconds: 1, sourceEndSeconds: 2.25)),
            .gap(ExportTimelineGap(id: "gap-1", durationSeconds: 0.5)),
            .clip(ExportTimelineClip(id: "clip-2", sourceStartSeconds: 3, sourceEndSeconds: 4))
        ])

        let result = try await TimelineCompositionBuilder.makeComposition(asset: asset, timeline: timeline)
        let duration = try await result.composition.load(.duration).seconds

        XCTAssertEqual(duration, 2.75, accuracy: 0.02)
        XCTAssertEqual(result.items.count, 3)
    }

    func testTimelineExportAppliesDeliverTrimInProgramTime() async throws {
        let fileManager = FileManager.default
        let baseURL = try canonicalTemporaryDirectory().appendingPathComponent(UUID().uuidString, isDirectory: true)
        try fileManager.createDirectory(at: baseURL, withIntermediateDirectories: true)
        defer { try? fileManager.removeItem(at: baseURL) }

        let sourceURL = baseURL.appendingPathComponent("source.mov")
        try makeVideoFile(at: sourceURL, durationSeconds: 4)
        let outputURL = baseURL.appendingPathComponent("output.mp4")

        do {
            _ = try await ExportPipeline().export(
                recordingURL: sourceURL,
                preset: Presets.h2641080p30,
                trimRange: CMTimeRange(
                    start: CMTime(seconds: 0.5, preferredTimescale: 600),
                    duration: CMTime(seconds: 1, preferredTimescale: 600)
                ),
                outputURL: outputURL,
                timeline: ExportTimelineDocument(items: [
                    .clip(ExportTimelineClip(id: "clip-1", sourceStartSeconds: 1, sourceEndSeconds: 2)),
                    .gap(ExportTimelineGap(id: "gap-1", durationSeconds: 1)),
                    .clip(ExportTimelineClip(id: "clip-2", sourceStartSeconds: 3, sourceEndSeconds: 4))
                ])
            )
        } catch let error as ExportPipeline.ExportError {
            if case .cannotCreateSession = error {
                throw XCTSkip("Preset not supported.")
            }
            throw error
        }

        let exportedAsset = AVAsset(url: outputURL)
        let duration = try await exportedAsset.load(.duration).seconds
        XCTAssertEqual(duration, 1, accuracy: 0.25)
    }

    func testTimelineExportAppliesCameraPlan() async throws {
        let fileManager = FileManager.default
        let baseURL = try canonicalTemporaryDirectory().appendingPathComponent(UUID().uuidString, isDirectory: true)
        try fileManager.createDirectory(at: baseURL, withIntermediateDirectories: true)
        defer { try? fileManager.removeItem(at: baseURL) }

        let sourceURL = baseURL.appendingPathComponent("gradient.mov")
        try makeGradientVideoFile(at: sourceURL, durationSeconds: 1)
        let timelineOnlyURL = baseURL.appendingPathComponent("timeline.mp4")
        let timelineWithCameraURL = baseURL.appendingPathComponent("timeline-camera.mp4")
        let cameraPlan = CameraPlan(
            sourceSize: CGSize(width: 320, height: 180),
            keyframes: [CameraKeyframe(time: 0, center: CGPoint(x: 80, y: 90), zoom: 2)],
            duration: 1
        )
        let timeline = ExportTimelineDocument(items: [
            .clip(ExportTimelineClip(id: "clip-1", sourceStartSeconds: 0, sourceEndSeconds: 1))
        ])

        do {
            _ = try await ExportPipeline().export(
                recordingURL: sourceURL,
                preset: Presets.h2641080p30,
                trimRange: nil,
                outputURL: timelineOnlyURL,
                timeline: timeline
            )
            _ = try await ExportPipeline().export(
                recordingURL: sourceURL,
                preset: Presets.h2641080p30,
                trimRange: nil,
                outputURL: timelineWithCameraURL,
                cameraPlan: cameraPlan,
                timeline: timeline
            )
        } catch let error as ExportPipeline.ExportError {
            if case .cannotCreateSession = error {
                throw XCTSkip("Preset not supported.")
            }
            throw error
        }

        let timelineRed = try sampleColor(in: AVAsset(url: timelineOnlyURL), at: 0.5).redComponent
        let cameraRed = try sampleColor(in: AVAsset(url: timelineWithCameraURL), at: 0.5).redComponent
        XCTAssertGreaterThan(abs(timelineRed - cameraRed), 0.08)
    }

    func testTimelineCompositionRejectsInvalidValues() async throws {
        let fileManager = FileManager.default
        let baseURL = try canonicalTemporaryDirectory().appendingPathComponent(UUID().uuidString, isDirectory: true)
        try fileManager.createDirectory(at: baseURL, withIntermediateDirectories: true)
        defer { try? fileManager.removeItem(at: baseURL) }

        let sourceURL = baseURL.appendingPathComponent("source.mov")
        try makeVideoFile(at: sourceURL, durationSeconds: 1)
        let asset = AVAsset(url: sourceURL)

        try await assertInvalidTimeline(asset: asset, timeline: ExportTimelineDocument(version: 1, items: [
            .clip(ExportTimelineClip(id: "clip-1", sourceStartSeconds: 0, sourceEndSeconds: 1))
        ]))
        try await assertInvalidTimeline(asset: asset, timeline: ExportTimelineDocument(items: [
            .clip(ExportTimelineClip(id: "clip-1", sourceStartSeconds: -Double.infinity, sourceEndSeconds: 1))
        ]))
        try await assertInvalidTimeline(asset: asset, timeline: ExportTimelineDocument(items: [
            .clip(ExportTimelineClip(id: "clip-1", sourceStartSeconds: -1, sourceEndSeconds: 1))
        ]))
        try await assertInvalidTimeline(asset: asset, timeline: ExportTimelineDocument(items: [
            .gap(ExportTimelineGap(id: "gap-1", durationSeconds: .nan))
        ]))
    }

    func testTimelineExportRendersGapsBlack() async throws {
        let fileManager = FileManager.default
        let baseURL = try canonicalTemporaryDirectory().appendingPathComponent(UUID().uuidString, isDirectory: true)
        try fileManager.createDirectory(at: baseURL, withIntermediateDirectories: true)
        defer { try? fileManager.removeItem(at: baseURL) }

        let sourceURL = baseURL.appendingPathComponent("source.mov")
        try makeVideoFile(at: sourceURL, durationSeconds: 2, color: (red: 0, green: 0, blue: 255))
        let outputURL = baseURL.appendingPathComponent("output.mp4")

        do {
            _ = try await ExportPipeline().export(
                recordingURL: sourceURL,
                preset: Presets.h2641080p30,
                trimRange: nil,
                outputURL: outputURL,
                timeline: ExportTimelineDocument(items: [
                    .clip(ExportTimelineClip(id: "clip-1", sourceStartSeconds: 0, sourceEndSeconds: 0.5)),
                    .gap(ExportTimelineGap(id: "gap-1", durationSeconds: 0.5)),
                    .clip(ExportTimelineClip(id: "clip-2", sourceStartSeconds: 0.5, sourceEndSeconds: 1))
                ])
            )
        } catch let error as ExportPipeline.ExportError {
            if case .cannotCreateSession = error {
                throw XCTSkip("Preset not supported.")
            }
            throw error
        }

        let color = try sampleColor(in: AVAsset(url: outputURL), at: 0.75)
        XCTAssertLessThan(color.redComponent, 0.08)
        XCTAssertLessThan(color.greenComponent, 0.08)
        XCTAssertLessThan(color.blueComponent, 0.08)
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

    private func makeVideoFile(
        at url: URL,
        durationSeconds: Double = 1,
        color: (red: UInt8, green: UInt8, blue: UInt8) = (red: 0, green: 0, blue: 0)
    ) throws {
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

        guard let pixelBuffer = makePixelBuffer(width: width, height: height, color: color) else {
            throw TestError.cannotCreatePixelBuffer
        }

        writer.startWriting()
        writer.startSession(atSourceTime: .zero)
        let frameCount = max(2, Int((durationSeconds * 10).rounded(.up)))
        for frameIndex in 0 ... frameCount {
            while !input.isReadyForMoreMediaData {
                Thread.sleep(forTimeInterval: 0.001)
            }
            let seconds = min(durationSeconds, Double(frameIndex) / 10)
            adaptor.append(pixelBuffer, withPresentationTime: CMTime(seconds: seconds, preferredTimescale: 600))
        }
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

    private func makePixelBuffer(
        width: Int,
        height: Int,
        color: (red: UInt8, green: UInt8, blue: UInt8)
    ) -> CVPixelBuffer? {
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
        guard status == kCVReturnSuccess, let pixelBuffer else {
            return nil
        }

        CVPixelBufferLockBaseAddress(pixelBuffer, [])
        defer { CVPixelBufferUnlockBaseAddress(pixelBuffer, []) }
        guard let baseAddress = CVPixelBufferGetBaseAddress(pixelBuffer) else {
            return nil
        }
        let bytes = baseAddress.assumingMemoryBound(to: UInt8.self)
        let bytesPerRow = CVPixelBufferGetBytesPerRow(pixelBuffer)
        for rowIndex in 0 ..< height {
            for columnIndex in 0 ..< width {
                let offset = rowIndex * bytesPerRow + columnIndex * 4
                bytes[offset] = color.blue
                bytes[offset + 1] = color.green
                bytes[offset + 2] = color.red
                bytes[offset + 3] = 255
            }
        }
        return pixelBuffer
    }

    private func makeGradientVideoFile(at url: URL, durationSeconds: Double) throws {
        let writer = try AVAssetWriter(outputURL: url, fileType: .mov)
        let width = 320
        let height = 180
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
        guard let pixelBuffer = makeHorizontalRedGradientPixelBuffer(width: width, height: height) else {
            throw TestError.cannotCreatePixelBuffer
        }

        writer.startWriting()
        writer.startSession(atSourceTime: .zero)
        let frameCount = max(2, Int((durationSeconds * 10).rounded(.up)))
        for frameIndex in 0 ... frameCount {
            while !input.isReadyForMoreMediaData {
                Thread.sleep(forTimeInterval: 0.001)
            }
            let seconds = min(durationSeconds, Double(frameIndex) / 10)
            adaptor.append(pixelBuffer, withPresentationTime: CMTime(seconds: seconds, preferredTimescale: 600))
        }
        input.markAsFinished()

        let group = DispatchGroup()
        group.enter()
        writer.finishWriting { group.leave() }
        group.wait()

        if writer.status != .completed {
            throw TestError.writerFailed(writer.error)
        }
    }

    private func makeHorizontalRedGradientPixelBuffer(width: Int, height: Int) -> CVPixelBuffer? {
        var pixelBuffer: CVPixelBuffer?
        let status = CVPixelBufferCreate(
            kCFAllocatorDefault,
            width,
            height,
            kCVPixelFormatType_32BGRA,
            nil,
            &pixelBuffer
        )
        guard status == kCVReturnSuccess, let pixelBuffer else { return nil }
        CVPixelBufferLockBaseAddress(pixelBuffer, [])
        defer { CVPixelBufferUnlockBaseAddress(pixelBuffer, []) }
        guard let baseAddress = CVPixelBufferGetBaseAddress(pixelBuffer) else { return nil }
        let bytes = baseAddress.assumingMemoryBound(to: UInt8.self)
        let bytesPerRow = CVPixelBufferGetBytesPerRow(pixelBuffer)
        for rowIndex in 0 ..< height {
            for columnIndex in 0 ..< width {
                let offset = rowIndex * bytesPerRow + columnIndex * 4
                let red = UInt8((Double(columnIndex) / Double(width - 1)) * 255)
                bytes[offset] = 0
                bytes[offset + 1] = 0
                bytes[offset + 2] = red
                bytes[offset + 3] = 255
            }
        }
        return pixelBuffer
    }

    private func assertInvalidTimeline(asset: AVAsset, timeline: ExportTimelineDocument) async throws {
        do {
            _ = try await TimelineCompositionBuilder.makeComposition(asset: asset, timeline: timeline)
            XCTFail("Expected invalid timeline error.")
        } catch let error as ExportPipeline.ExportError {
            guard case .invalidTimeline = error else {
                XCTFail("Unexpected export error: \(error)")
                return
            }
        }
    }

    private func sampleColor(in asset: AVAsset, at seconds: Double) throws -> NSColor {
        let generator = AVAssetImageGenerator(asset: asset)
        generator.requestedTimeToleranceBefore = .zero
        generator.requestedTimeToleranceAfter = .zero
        let image = try generator.copyCGImage(
            at: CMTime(seconds: seconds, preferredTimescale: 600),
            actualTime: nil
        )
        let bitmap = NSBitmapImageRep(cgImage: image)
        guard let color = bitmap.colorAt(x: image.width / 2, y: image.height / 2)?.usingColorSpace(.deviceRGB) else {
            throw TestError.cannotSampleColor
        }
        return color
    }
}

// swiftlint:enable type_body_length

private enum TestError: Error {
    case cannotAddInput
    case cannotCreatePixelBuffer
    case cannotSampleColor
    case writerFailed(Error?)
}
