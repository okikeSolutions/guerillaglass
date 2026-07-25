import AppKit
import Automation
import AVFoundation
import Darwin
@testable import Export
import InputTracking
import Project
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
        try Data("existing-export".utf8).write(to: outputURL)
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
        XCTAssertNotEqual(try Data(contentsOf: outputURL), Data("existing-export".utf8))
    }

    func testDisabledFramingPreservesBlackLegacyLetterbox() async throws {
        let fileManager = FileManager.default
        let baseURL = try canonicalTemporaryDirectory().appendingPathComponent(UUID().uuidString, isDirectory: true)
        try fileManager.createDirectory(at: baseURL, withIntermediateDirectories: true)
        defer { try? fileManager.removeItem(at: baseURL) }

        let sourceURL = baseURL.appendingPathComponent("square.mov")
        try makeVideoFile(
            at: sourceURL,
            durationSeconds: 0.5,
            color: (red: 0, green: 0, blue: 255)
        )
        let outputURL = baseURL.appendingPathComponent("legacy.mp4")
        _ = try await ExportPipeline().export(
            recordingURL: sourceURL,
            preset: Presets.h2641080p30,
            trimRange: nil,
            outputURL: outputURL,
            backgroundFraming: .defaults
        )

        let letterboxColor = try sampleColor(
            in: AVAsset(url: outputURL),
            at: 0.25,
            normalizedPoint: CGPoint(x: 0.02, y: 0.5)
        )
        XCTAssertLessThan(letterboxColor.redComponent, 0.05)
        XCTAssertLessThan(letterboxColor.greenComponent, 0.05)
        XCTAssertLessThan(letterboxColor.blueComponent, 0.05)
    }

    func testCancelledExportDoesNotInstallDestination() async throws {
        let fileManager = FileManager.default
        let baseURL = try canonicalTemporaryDirectory().appendingPathComponent(UUID().uuidString, isDirectory: true)
        try fileManager.createDirectory(at: baseURL, withIntermediateDirectories: true)
        defer { try? fileManager.removeItem(at: baseURL) }

        let sourceURL = baseURL.appendingPathComponent("source.mov")
        try makeVideoFile(at: sourceURL, durationSeconds: 2)
        let outputURL = baseURL.appendingPathComponent("cancelled.mp4")
        try Data("existing-destination".utf8).write(to: outputURL)
        let exportTask = Task {
            try await ExportPipeline().export(
                recordingURL: sourceURL,
                preset: Presets.h2641080p30,
                trimRange: nil,
                outputURL: outputURL,
                backgroundFraming: BackgroundFramingSettings(
                    version: 1,
                    enabled: true,
                    backgroundColor: "#18181B",
                    paddingFraction: 0.06,
                    cornerRadiusFraction: 0.025,
                    shadowStrength: 0.35
                )
            )
        }
        exportTask.cancel()

        do {
            _ = try await exportTask.value
            XCTFail("Expected export cancellation.")
        } catch is CancellationError {
            // Expected: AVAssetExportSession.export(to:as:) cooperates with task cancellation.
        } catch {
            XCTAssertTrue(error is CancellationError, "Unexpected cancellation error: \(error)")
        }
        XCTAssertEqual(try String(contentsOf: outputURL, encoding: .utf8), "existing-destination")
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
        let cameraColor = try sampleColor(in: AVAsset(url: timelineWithCameraURL), at: 0.5)
        let cameraRed = cameraColor.redComponent
        XCTAssertGreaterThan(abs(timelineRed - cameraRed), 0.08)
        XCTAssertEqual(cameraRed, 0.25, accuracy: 0.1)
        XCTAssertLessThan(cameraColor.greenComponent, 0.08)
        XCTAssertLessThan(cameraColor.blueComponent, 0.08)
    }

    func testVerticalExportReplansCameraFromCaptureEvents() async throws {
        let fileManager = FileManager.default
        let baseURL = try canonicalTemporaryDirectory().appendingPathComponent(UUID().uuidString, isDirectory: true)
        try fileManager.createDirectory(at: baseURL, withIntermediateDirectories: true)
        defer { try? fileManager.removeItem(at: baseURL) }

        let sourceURL = baseURL.appendingPathComponent("gradient.mov")
        try makeGradientVideoFile(at: sourceURL, durationSeconds: 1)
        let leftURL = baseURL.appendingPathComponent("vertical-left.mp4")
        let rightURL = baseURL.appendingPathComponent("vertical-right.mp4")
        let preset = ExportPreset(
            id: "test-vertical",
            name: "Test vertical",
            width: 180,
            height: 320,
            fps: 30,
            codec: .h264,
            fileType: .mp4,
            exportPresetName: AVAssetExportPresetHighestQuality
        )
        let metadata = CaptureMetadata(
            source: .display,
            contentRect: CaptureRect(originX: 0, originY: 0, width: 320, height: 180),
            pixelScale: 1
        )
        let settings = AutoZoomSettings(isEnabled: true, intensity: 1, minimumKeyframeInterval: 1 / 30)
        let framing = try BackgroundFramingSettings(
            version: 1,
            enabled: true,
            backgroundColor: "#204060",
            paddingFraction: 0.06,
            cornerRadiusFraction: 0.025,
            shadowStrength: 0.35
        )

        _ = try await ExportPipeline().export(
            recordingURL: sourceURL,
            preset: preset,
            trimRange: nil,
            outputURL: leftURL,
            cameraEvents: [
                InputEvent(type: .mouseDown, timestamp: 0, position: CGPoint(x: 40, y: 90))
            ],
            autoZoomSettings: settings,
            captureMetadata: metadata,
            backgroundFraming: framing
        )
        _ = try await ExportPipeline().export(
            recordingURL: sourceURL,
            preset: preset,
            trimRange: nil,
            outputURL: rightURL,
            cameraEvents: [
                InputEvent(type: .mouseDown, timestamp: 0, position: CGPoint(x: 280, y: 90))
            ],
            autoZoomSettings: settings,
            captureMetadata: metadata,
            backgroundFraming: framing
        )

        let leftColor = try sampleColor(in: AVAsset(url: leftURL), at: 0.5)
        let rightColor = try sampleColor(in: AVAsset(url: rightURL), at: 0.5)
        XCTAssertGreaterThan(rightColor.redComponent - leftColor.redComponent, 0.5)
        let stageColor = try sampleColor(
            in: AVAsset(url: rightURL),
            at: 0.5,
            normalizedPoint: CGPoint(x: 0.01, y: 0.01)
        )
        assertEncodedColor(stageColor, equalsSRGB8: (red: 32, green: 64, blue: 96))

        let outputTracks = try await AVAsset(url: rightURL).loadTracks(withMediaType: .video)
        let outputTrack = try XCTUnwrap(outputTracks.first)
        let outputSize = try await outputTrack.load(.naturalSize)
        XCTAssertEqual(outputSize.width, 180, accuracy: 1)
        XCTAssertEqual(outputSize.height, 320, accuracy: 1)
    }

    func testBackgroundFramingRendersStageAndRoundedSourceCard() async throws {
        let fileManager = FileManager.default
        let baseURL = try canonicalTemporaryDirectory().appendingPathComponent(UUID().uuidString, isDirectory: true)
        try fileManager.createDirectory(at: baseURL, withIntermediateDirectories: true)
        defer { try? fileManager.removeItem(at: baseURL) }

        let sourceURL = baseURL.appendingPathComponent("source.mov")
        try makeVideoFile(
            at: sourceURL,
            durationSeconds: 0.5,
            color: (red: 0, green: 0, blue: 255)
        )
        let outputURL = baseURL.appendingPathComponent("framed.mp4")
        let settings = try BackgroundFramingSettings(
            version: 1,
            enabled: true,
            backgroundColor: "#204060",
            paddingFraction: 0.06,
            cornerRadiusFraction: 0.10,
            shadowStrength: 0
        )

        do {
            _ = try await ExportPipeline().export(
                recordingURL: sourceURL,
                preset: Presets.h2641080p30,
                trimRange: nil,
                outputURL: outputURL,
                backgroundFraming: settings
            )
        } catch let error as ExportPipeline.ExportError {
            if case .cannotCreateSession = error {
                throw XCTSkip("Preset not supported.")
            }
            throw error
        }

        let exportedAsset = AVAsset(url: outputURL)
        let stageColor = try sampleColor(
            in: exportedAsset,
            at: 0.25,
            normalizedPoint: CGPoint(x: 0.02, y: 0.02)
        )
        assertEncodedColor(stageColor, equalsSRGB8: (red: 32, green: 64, blue: 96))

        let videoTracks = try await exportedAsset.loadTracks(withMediaType: .video)
        let videoTrack = try XCTUnwrap(videoTracks.first)
        let formatDescriptions = try await videoTrack.load(.formatDescriptions)
        let formatDescription = try XCTUnwrap(formatDescriptions.first)
        let extensions = try XCTUnwrap(
            CMFormatDescriptionGetExtensions(formatDescription)
        ) as NSDictionary
        XCTAssertEqual(
            extensions[kCMFormatDescriptionExtension_ColorPrimaries] as? String,
            kCVImageBufferColorPrimaries_ITU_R_709_2 as String
        )

        let cardCenter = try sampleColor(in: exportedAsset, at: 0.25)
        XCTAssertLessThan(cardCenter.redComponent, 0.20)
        XCTAssertGreaterThan(cardCenter.blueComponent, 0.85)
        XCTAssertGreaterThan(cardCenter.blueComponent, cardCenter.greenComponent * 2.5)

        let roundedCorner = try sampleColor(
            in: exportedAsset,
            at: 0.25,
            normalizedPoint: CGPoint(x: 0.07, y: 0.07)
        )
        XCTAssertEqual(roundedCorner.redComponent, stageColor.redComponent, accuracy: 0.08)
        XCTAssertEqual(roundedCorner.greenComponent, stageColor.greenComponent, accuracy: 0.08)
        XCTAssertEqual(roundedCorner.blueComponent, stageColor.blueComponent, accuracy: 0.08)
    }

    func testBackgroundFramingShadowFallsBelowCard() async throws {
        let fileManager = FileManager.default
        let baseURL = try canonicalTemporaryDirectory().appendingPathComponent(UUID().uuidString, isDirectory: true)
        try fileManager.createDirectory(at: baseURL, withIntermediateDirectories: true)
        defer { try? fileManager.removeItem(at: baseURL) }

        let sourceURL = baseURL.appendingPathComponent("square.mov")
        try makeVideoFile(at: sourceURL, durationSeconds: 0.5, color: (red: 0, green: 0, blue: 255))
        let outputURL = baseURL.appendingPathComponent("shadow.mp4")
        let settings = try BackgroundFramingSettings(
            version: 1,
            enabled: true,
            backgroundColor: "#808080",
            paddingFraction: 0.10,
            cornerRadiusFraction: 0.025,
            shadowStrength: 1
        )
        _ = try await ExportPipeline().export(
            recordingURL: sourceURL,
            preset: Presets.h2641080p30,
            trimRange: nil,
            outputURL: outputURL,
            backgroundFraming: settings
        )

        let asset = AVAsset(url: outputURL)
        let belowCard = try sampleColor(
            in: asset,
            at: 0.25,
            normalizedPoint: CGPoint(x: 0.5, y: 0.925)
        )
        let aboveCard = try sampleColor(
            in: asset,
            at: 0.25,
            normalizedPoint: CGPoint(x: 0.5, y: 0.075)
        )
        XCTAssertLessThan(luminance(belowCard), luminance(aboveCard) - 0.01)
    }

    func testEnabledTimelineGapRendersOnlyConfiguredStage() async throws {
        let fileManager = FileManager.default
        let baseURL = try canonicalTemporaryDirectory().appendingPathComponent(UUID().uuidString, isDirectory: true)
        try fileManager.createDirectory(at: baseURL, withIntermediateDirectories: true)
        defer { try? fileManager.removeItem(at: baseURL) }

        let sourceURL = baseURL.appendingPathComponent("source.mov")
        try makeVideoFile(at: sourceURL, durationSeconds: 2, color: (red: 0, green: 0, blue: 255))
        let outputURL = baseURL.appendingPathComponent("framed-gap.mp4")
        let settings = try BackgroundFramingSettings(
            version: 1,
            enabled: true,
            backgroundColor: "#204060",
            paddingFraction: 0.06,
            cornerRadiusFraction: 0.025,
            shadowStrength: 1
        )

        do {
            _ = try await ExportPipeline().export(
                recordingURL: sourceURL,
                preset: Presets.h2641080p30,
                trimRange: nil,
                outputURL: outputURL,
                timeline: ExportTimelineDocument(items: [
                    .clip(ExportTimelineClip(id: "clip-1", sourceStartSeconds: 0, sourceEndSeconds: 0.5)),
                    .gap(ExportTimelineGap(id: "gap-1", durationSeconds: 0.5)),
                    .clip(ExportTimelineClip(id: "clip-2", sourceStartSeconds: 0.5, sourceEndSeconds: 1)),
                ]),
                backgroundFraming: settings
            )
        } catch let error as ExportPipeline.ExportError {
            if case .cannotCreateSession = error {
                throw XCTSkip("Preset not supported.")
            }
            throw error
        }

        let gapColor = try sampleColor(in: AVAsset(url: outputURL), at: 0.75)
        assertEncodedColor(gapColor, equalsSRGB8: (red: 32, green: 64, blue: 96))
    }

    func testFramedTimelineTrimBeginningInsideGapKeepsCardHidden() async throws {
        let fileManager = FileManager.default
        let baseURL = try canonicalTemporaryDirectory().appendingPathComponent(UUID().uuidString, isDirectory: true)
        try fileManager.createDirectory(at: baseURL, withIntermediateDirectories: true)
        defer { try? fileManager.removeItem(at: baseURL) }

        let sourceURL = baseURL.appendingPathComponent("source.mov")
        try makeVideoFile(at: sourceURL, durationSeconds: 2, color: (red: 0, green: 0, blue: 255))
        let outputURL = baseURL.appendingPathComponent("trimmed-gap.mp4")
        let settings = try BackgroundFramingSettings(
            version: 1,
            enabled: true,
            backgroundColor: "#204060",
            paddingFraction: 0.06,
            cornerRadiusFraction: 0.025,
            shadowStrength: 1
        )

        _ = try await ExportPipeline().export(
            recordingURL: sourceURL,
            preset: Presets.h2641080p30,
            trimRange: CMTimeRange(
                start: CMTime(seconds: 0.6, preferredTimescale: 600),
                duration: CMTime(seconds: 0.2, preferredTimescale: 600)
            ),
            outputURL: outputURL,
            timeline: ExportTimelineDocument(items: [
                .clip(ExportTimelineClip(id: "clip-1", sourceStartSeconds: 0, sourceEndSeconds: 0.5)),
                .gap(ExportTimelineGap(id: "gap-1", durationSeconds: 0.5)),
                .clip(ExportTimelineClip(id: "clip-2", sourceStartSeconds: 0.5, sourceEndSeconds: 1)),
            ]),
            backgroundFraming: settings
        )

        let gapColor = try sampleColor(in: AVAsset(url: outputURL), at: 0.1)
        assertEncodedColor(gapColor, equalsSRGB8: (red: 32, green: 64, blue: 96))
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

    private func assertEncodedColor(
        _ color: NSColor,
        equalsSRGB8 expected: (red: CGFloat, green: CGFloat, blue: CGFloat),
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        // Hardware encoders round-trip sRGB Core Animation content through Y'CbCr differently.
        // Keep this raster assertion strict enough to catch a wrong stage while the pure color test
        // verifies exact sRGB component parsing independently of codec conversion.
        let codecTolerance: CGFloat = 0.16
        XCTAssertEqual(color.redComponent, expected.red / 255, accuracy: codecTolerance, file: file, line: line)
        XCTAssertEqual(color.greenComponent, expected.green / 255, accuracy: codecTolerance, file: file, line: line)
        XCTAssertEqual(color.blueComponent, expected.blue / 255, accuracy: codecTolerance, file: file, line: line)
    }

    private func luminance(_ color: NSColor) -> CGFloat {
        0.2126 * color.redComponent + 0.7152 * color.greenComponent + 0.0722 * color.blueComponent
    }

    private func sampleColor(
        in asset: AVAsset,
        at seconds: Double,
        normalizedPoint: CGPoint = CGPoint(x: 0.5, y: 0.5)
    ) throws -> NSColor {
        let generator = AVAssetImageGenerator(asset: asset)
        generator.requestedTimeToleranceBefore = .zero
        generator.requestedTimeToleranceAfter = .zero
        let image = try generator.copyCGImage(
            at: CMTime(seconds: seconds, preferredTimescale: 600),
            actualTime: nil
        )
        let bitmap = NSBitmapImageRep(cgImage: image)
        let xCoordinate = min(
            image.width - 1,
            max(0, Int(CGFloat(image.width) * normalizedPoint.x))
        )
        let yCoordinate = min(
            image.height - 1,
            max(0, Int(CGFloat(image.height) * normalizedPoint.y))
        )
        guard let color = bitmap.colorAt(x: xCoordinate, y: yCoordinate)?.usingColorSpace(.sRGB) else {
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
