@testable import Project
import XCTest

final class ProjectStoreTests: XCTestCase {
    func testSaveAndLoadProject() throws {
        let fileManager = FileManager.default
        let baseURL = canonicalTemporaryDirectory().appendingPathComponent(UUID().uuidString, isDirectory: true)
        try fileManager.createDirectory(at: baseURL, withIntermediateDirectories: true)
        defer { try? fileManager.removeItem(at: baseURL) }

        let recordingURL = baseURL.appendingPathComponent("source.mov")
        try Data("recording".utf8).write(to: recordingURL, options: [.atomic])

        let projectsDirectory = baseURL.appendingPathComponent("Projects", isDirectory: true)
        let store = ProjectStore(projectsDirectoryURL: projectsDirectory)
        let saved = try store.saveNewProject(recordingURL: recordingURL)

        XCTAssertTrue(fileManager.fileExists(atPath: saved.url.path))
        XCTAssertTrue(fileManager.fileExists(atPath: store.resolveRecordingURL(for: saved).path))

        let loaded = try store.loadProject(at: saved.url)
        XCTAssertEqual(saved.url, loaded.url)
        XCTAssertEqual(saved.document, loaded.document)
    }

    func testBackgroundFramingSaveOpenRoundTrip() throws {
        let fileManager = FileManager.default
        let baseURL = canonicalTemporaryDirectory().appendingPathComponent(UUID().uuidString, isDirectory: true)
        try fileManager.createDirectory(at: baseURL, withIntermediateDirectories: true)
        defer { try? fileManager.removeItem(at: baseURL) }

        let recordingURL = baseURL.appendingPathComponent("source.mov")
        try Data("recording".utf8).write(to: recordingURL, options: [.atomic])
        let store = ProjectStore(projectsDirectoryURL: baseURL.appendingPathComponent("Projects", isDirectory: true))
        let saved = try store.saveNewProject(recordingURL: recordingURL)
        var document = saved.document
        document.project.backgroundFraming = try BackgroundFramingSettings(
            version: 1,
            enabled: true,
            backgroundColor: "#a1b2c3",
            paddingFraction: 0.12,
            cornerRadiusFraction: 0.05,
            shadowStrength: 0.7
        )

        _ = try store.writeProject(document: document, assets: .init(), to: saved.url)
        let loaded = try store.loadProject(at: saved.url)

        XCTAssertEqual(loaded.document.project.backgroundFraming, document.project.backgroundFraming)
        XCTAssertEqual(loaded.document.project.backgroundFraming.backgroundColor, "#A1B2C3")
    }

    func testSaveRejectsMissingRecording() throws {
        let fileManager = FileManager.default
        let baseURL = canonicalTemporaryDirectory().appendingPathComponent(UUID().uuidString, isDirectory: true)
        try fileManager.createDirectory(at: baseURL, withIntermediateDirectories: true)
        defer { try? fileManager.removeItem(at: baseURL) }

        let recordingURL = baseURL.appendingPathComponent("missing.mov")
        let projectsDirectory = baseURL.appendingPathComponent("Projects", isDirectory: true)
        let store = ProjectStore(projectsDirectoryURL: projectsDirectory)

        XCTAssertThrowsError(try store.saveNewProject(recordingURL: recordingURL))
    }

    func testWriteProjectRejectsPathTraversalAssetFileNames() throws {
        let fileManager = FileManager.default
        let baseURL = canonicalTemporaryDirectory().appendingPathComponent(UUID().uuidString, isDirectory: true)
        try fileManager.createDirectory(at: baseURL, withIntermediateDirectories: true)
        defer { try? fileManager.removeItem(at: baseURL) }

        let recordingURL = baseURL.appendingPathComponent("source.mov")
        try Data("recording".utf8).write(to: recordingURL, options: [.atomic])

        let store = ProjectStore(projectsDirectoryURL: baseURL.appendingPathComponent("Projects", isDirectory: true))
        var document = ProjectDocument()
        document.recordingFileName = "../escape.mov"

        XCTAssertThrowsError(
            try store.writeProject(
                document: document,
                assets: .init(recordingURL: recordingURL),
                to: baseURL.appendingPathComponent("Projects/Unsafe.gglassproj", isDirectory: true)
            )
        )
    }

    func testLoadProjectRejectsPathTraversalAssetFileNames() throws {
        let fileManager = FileManager.default
        let baseURL = canonicalTemporaryDirectory().appendingPathComponent(UUID().uuidString, isDirectory: true)
        try fileManager.createDirectory(at: baseURL, withIntermediateDirectories: true)
        defer { try? fileManager.removeItem(at: baseURL) }

        let projectURL = baseURL.appendingPathComponent("Unsafe.gglassproj", isDirectory: true)
        try fileManager.createDirectory(at: projectURL, withIntermediateDirectories: true)

        var document = ProjectDocument()
        document.recordingFileName = "../escape.mov"
        let encoded = try ProjectStore.makeDefaultEncoder().encode(document)
        try encoded.write(to: projectURL.appendingPathComponent(ProjectFile.projectJSON), options: [.atomic])

        let store = ProjectStore(projectsDirectoryURL: baseURL.appendingPathComponent("Projects", isDirectory: true))
        XCTAssertThrowsError(try store.loadProject(at: projectURL))
    }
}

private func canonicalTemporaryDirectory() -> URL {
    let temporaryPath = FileManager.default.temporaryDirectory.path
    guard let resolved = realpath(temporaryPath, nil) else {
        return FileManager.default.temporaryDirectory
    }
    defer { free(resolved) }
    return URL(fileURLWithPath: String(cString: resolved), isDirectory: true)
}
