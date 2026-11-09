import AVFoundation
import Darwin
import EngineProtocol
import Foundation
@testable import guerillaglass_engine
import Project
import XCTest

final class EngineProjectSaveTests: XCTestCase {
    @MainActor
    func testReopenedProjectSaveAsCopiesEveryAssetAndSurvivesSourceRemoval() async throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let sourceMovie = directory.appendingPathComponent("capture.mov")
        try await makeMovie(at: sourceMovie)
        let sourceURL = directory.appendingPathComponent("Original.gglassproj", isDirectory: true)
        let targetURL = directory.appendingPathComponent("Copy.gglassproj", isDirectory: true)
        let store = ProjectStore()
        let assets = try makeAssets(movie: sourceMovie, directory: directory)
        _ = try store.writeProject(document: ProjectDocument(), assets: assets, to: sourceURL)
        let source = try store.loadProject(at: sourceURL)
        let expected = try assetData(for: source, store: store)
        let service = EngineService(projectLibraryStore: ProjectLibraryStore(indexURL: directory.appendingPathComponent("recents.json")))
        guard case .ok = try await service.project_period_projectOpen(.init(body: .json(.init(projectPath: sourceURL.path)))) else {
            return XCTFail("Fixture project must open")
        }
        XCTAssertNil(service.captureEngine.recordingURL, "Regression requires a reopened project, not a live capture")
        guard case .ok = try await service.project_period_projectSave(.init(body: .json(.init(projectPath: targetURL.path)))) else {
            return XCTFail("Save As must copy reopened media")
        }
        let saved = try store.loadProject(at: targetURL)
        XCTAssertEqual(try assetData(for: saved, store: store), expected)
        // Remove only this test's isolated source. No production fixtures are changed.
        try FileManager.default.removeItem(at: sourceURL)
        try FileManager.default.removeItem(at: sourceMovie)
        guard case .ok = try await service.project_period_projectOpen(.init(body: .json(.init(projectPath: targetURL.path)))) else {
            return XCTFail("Independent copy must reopen")
        }
        let previewURL = try XCTUnwrap(service.projectRecordingURL())
        let video = AVAsset(url: previewURL)
        let tracks = try await video.loadTracks(withMediaType: .video)
        XCTAssertFalse(tracks.isEmpty)
        let image = AVAssetImageGenerator(asset: video)
        let frame = try image.copyCGImage(at: .zero, actualTime: nil)
        XCTAssertGreaterThan(frame.width, 0, "Copied source remains previewable")
        let output = directory.appendingPathComponent("copy-export.mp4")
        let result = try await service.export_period_exportRun(.init(body: .json(.init(outputURL: output.path, presetId: "h264-1080p-30"))))
        guard case let .ok(response) = result, case let .json(export) = response.body else {
            return XCTFail("Export must survive removal of the original package: \(result)")
        }
        XCTAssertEqual(export.status, .succeeded)
        XCTAssertTrue(FileManager.default.fileExists(atPath: output.path))
    }

    @MainActor
    func testSavingReopenedProjectInPlaceRetainsAllAssets() async throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let movie = directory.appendingPathComponent("capture.mov")
        try Data("recording fixture".utf8).write(to: movie)
        let projectURL = directory.appendingPathComponent("InPlace.gglassproj", isDirectory: true)
        let store = ProjectStore()
        _ = try store.writeProject(document: ProjectDocument(), assets: makeAssets(movie: movie, directory: directory), to: projectURL)
        let before = try assetData(for: store.loadProject(at: projectURL), store: store)
        let service = EngineService(projectLibraryStore: ProjectLibraryStore(indexURL: directory.appendingPathComponent("recents.json")))
        guard case .ok = try await service.project_period_projectOpen(.init(body: .json(.init(projectPath: projectURL.path)))) else { return XCTFail("Open failed") }
        guard case .ok = try await service.project_period_projectSave(.init(body: .json(.init()))) else { return XCTFail("In-place save failed") }
        XCTAssertEqual(try assetData(for: store.loadProject(at: projectURL), store: store), before)
    }

    @MainActor
    func testMissingDeclaredAudioFailsSaveAsWithoutReplacingCurrentProject() async throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let movie = directory.appendingPathComponent("capture.mov")
        try Data("recording fixture".utf8).write(to: movie)
        let source = directory.appendingPathComponent("Source.gglassproj", isDirectory: true)
        let target = directory.appendingPathComponent("Target.gglassproj", isDirectory: true)
        let store = ProjectStore()
        _ = try store.writeProject(document: ProjectDocument(), assets: makeAssets(movie: movie, directory: directory), to: source)
        let loaded = try store.loadProject(at: source)
        try FileManager.default.removeItem(at: XCTUnwrap(store.resolveMicAudioURL(for: loaded)))
        let service = EngineService(projectLibraryStore: ProjectLibraryStore(indexURL: directory.appendingPathComponent("recents.json")))
        guard case .ok = try await service.project_period_projectOpen(.init(body: .json(.init(projectPath: source.path)))) else { return XCTFail("Open failed") }
        let result = try await service.project_period_projectSave(.init(body: .json(.init(projectPath: target.path))))
        guard case .badRequest = result else { return XCTFail("Missing declared audio must not report a successful save") }
        XCTAssertEqual(service.currentProjectURL, source)
        XCTAssertFalse(FileManager.default.fileExists(atPath: target.appendingPathComponent(ProjectFile.projectJSON).path))
        XCTAssertTrue(FileManager.default.fileExists(atPath: store.resolveRecordingURL(for: loaded).path))
    }

    @MainActor
    func testSuccessfulNewRecordingRetiresOpenedProjectAndItsBoundState() async throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let (service, source) = try await openedFixture(in: directory)
        let projectID = service.currentProjectDocument.project.id
        let sessionID = service.projectSessionID
        service.currentEventsURL = source.appendingPathComponent("old-events.json")
        service.latestAgentJobId = "old-agent"
        service.latestAgentUpdatedAt = "old-timestamp"
        service.agentRecoveryFailureJobId = "old-recovery"
        service.latestExportJobId = "old-export"
        service.latestExportOutputURL = source.appendingPathComponent("old-export.mp4")
        // This production transition is invoked only after native start succeeds.
        // Calling it directly avoids capture permissions in lifecycle regression tests.
        service.beginProjectForRecording(wasAlreadyRecording: false)
        XCTAssertNil(service.currentProjectURL)
        XCTAssertNil(service.currentProjectLease)
        XCTAssertNotEqual(service.currentProjectDocument.project.id, projectID)
        XCTAssertNotEqual(service.projectSessionID, sessionID)
        XCTAssertNil(service.projectRecordingURL())
        XCTAssertNil(service.currentEventsURL)
        XCTAssertNil(service.latestAgentJobId)
        XCTAssertNil(service.latestAgentUpdatedAt)
        XCTAssertNil(service.agentRecoveryFailureJobId)
        XCTAssertNil(service.latestExportJobId)
        XCTAssertNil(service.latestExportOutputURL)
        XCTAssertTrue(service.hasUnsavedProjectChanges)
        XCTAssertTrue(service.currentProjectDocument.project.timeline.items.isEmpty)
        XCTAssertNoThrow(try ProjectLease(url: source), "The old package is released for another owner")
        XCTAssertTrue(FileManager.default.fileExists(atPath: source.appendingPathComponent("recording.mov").path))
    }

    @MainActor
    func testFailedNativeRecordingStartPreservesOpenedProject() async throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let (service, source) = try await openedFixture(in: directory)
        let document = service.currentProjectDocument
        let sessionID = service.projectSessionID
        service.currentEventsURL = source.appendingPathComponent("old-events.json")
        service.latestAgentJobId = "old-agent"
        // No capture is running, so the real native start fails before permissions.
        let result = try await service.recording_period_recordingStart(.init(body: .json(.init())))
        guard case .badRequest = result else { return XCTFail("Start without capture must fail") }
        XCTAssertEqual(service.currentProjectURL, source)
        XCTAssertEqual(service.currentProjectDocument, document)
        XCTAssertEqual(service.projectSessionID, sessionID)
        XCTAssertEqual(service.currentEventsURL, source.appendingPathComponent("old-events.json"))
        XCTAssertEqual(service.latestAgentJobId, "old-agent")
        XCTAssertThrowsError(try ProjectLease(url: source), "Failed start must retain ownership")
    }

    @MainActor
    func testDuplicateRecordingStartDoesNotRetireCurrentProjectSession() async throws {
        let directory = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let (service, source) = try await openedFixture(in: directory)
        let document = service.currentProjectDocument
        let sessionID = service.projectSessionID
        service.latestAgentJobId = "current-agent"
        service.beginProjectForRecording(wasAlreadyRecording: true)
        XCTAssertEqual(service.currentProjectURL, source)
        XCTAssertEqual(service.currentProjectDocument, document)
        XCTAssertEqual(service.projectSessionID, sessionID)
        XCTAssertEqual(service.latestAgentJobId, "current-agent")
        XCTAssertFalse(service.hasUnsavedProjectChanges)
        XCTAssertThrowsError(try ProjectLease(url: source), "Duplicate start must retain ownership")
    }

    @MainActor
    private func openedFixture(in directory: URL) async throws -> (EngineService, URL) {
        let movie = directory.appendingPathComponent("old-capture.mov")
        try Data("old recording fixture".utf8).write(to: movie)
        let project = directory.appendingPathComponent("Opened.gglassproj", isDirectory: true)
        _ = try ProjectStore().writeProject(document: ProjectDocument(), assets: .init(recordingURL: movie), to: project)
        let service = EngineService(projectLibraryStore: ProjectLibraryStore(indexURL: directory.appendingPathComponent("recents.json")))
        guard case .ok = try await service.project_period_projectOpen(.init(body: .json(.init(projectPath: project.path)))) else {
            throw CocoaError(.fileReadUnknown)
        }
        return (service, project)
    }

    private func temporaryDirectory() throws -> URL {
        let temporaryPath = FileManager.default.temporaryDirectory.path
        guard let resolved = realpath(temporaryPath, nil) else {
            throw POSIXError(POSIXErrorCode(rawValue: errno) ?? .EIO)
        }
        defer { free(resolved) }
        let directory = URL(fileURLWithPath: String(cString: resolved), isDirectory: true)
            .appendingPathComponent("gg-save-tests-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory
    }

    private func makeAssets(movie: URL, directory: URL) throws -> ProjectStore.ProjectAssetURLs {
        let system = directory.appendingPathComponent("system.m4a")
        let mic = directory.appendingPathComponent("mic.m4a")
        let events = directory.appendingPathComponent("events.json")
        try Data("system audio sidecar fixture".utf8).write(to: system)
        try Data("microphone sidecar fixture".utf8).write(to: mic)
        try Data(#"{"schemaVersion":1,"events":[]}"#.utf8).write(to: events)
        return .init(recordingURL: movie, systemAudioURL: system, micAudioURL: mic, eventsURL: events)
    }

    private func assetData(for project: ProjectStore.SavedProject, store: ProjectStore) throws -> [Data] {
        let urls = try [store.resolveRecordingURL(for: project), XCTUnwrap(store.resolveSystemAudioURL(for: project)), XCTUnwrap(store.resolveMicAudioURL(for: project)), XCTUnwrap(store.resolveEventsURL(for: project))]
        return try urls.map { try Data(contentsOf: $0) }
    }

    private func makeMovie(at url: URL) async throws {
        let writer = try AVAssetWriter(outputURL: url, fileType: .mov)
        let input = AVAssetWriterInput(mediaType: .video, outputSettings: [AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: 16, AVVideoHeightKey: 16])
        writer.add(input)
        let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
        var optionalBuffer: CVPixelBuffer?
        XCTAssertEqual(CVPixelBufferCreate(kCFAllocatorDefault, 16, 16, kCVPixelFormatType_32BGRA, nil, &optionalBuffer), kCVReturnSuccess)
        let buffer = try XCTUnwrap(optionalBuffer)
        CVPixelBufferLockBaseAddress(buffer, [])
        try memset(XCTUnwrap(CVPixelBufferGetBaseAddress(buffer)), 0, CVPixelBufferGetDataSize(buffer))
        CVPixelBufferUnlockBaseAddress(buffer, [])
        XCTAssertTrue(writer.startWriting())
        writer.startSession(atSourceTime: .zero)
        for index in 0 ... 3 {
            let deadline = Date().addingTimeInterval(5)
            while !input.isReadyForMoreMediaData {
                guard Date() < deadline else { throw CocoaError(.fileWriteUnknown) }
                await Task.yield()
            }
            XCTAssertTrue(adaptor.append(buffer, withPresentationTime: CMTime(value: Int64(index), timescale: 10)))
        }
        input.markAsFinished()
        await withCheckedContinuation { continuation in writer.finishWriting { continuation.resume() } }
        XCTAssertEqual(writer.status, .completed)
    }
}
