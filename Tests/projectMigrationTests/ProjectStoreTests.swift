@testable import Project
import XCTest

final class ProjectStoreTests: XCTestCase {
    func testSaveAndLoadProject() throws {
        let fileManager = FileManager.default
        let baseURL = fileManager.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
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

    func testSaveRejectsMissingRecording() throws {
        let fileManager = FileManager.default
        let baseURL = fileManager.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try fileManager.createDirectory(at: baseURL, withIntermediateDirectories: true)
        defer { try? fileManager.removeItem(at: baseURL) }

        let recordingURL = baseURL.appendingPathComponent("missing.mov")
        let projectsDirectory = baseURL.appendingPathComponent("Projects", isDirectory: true)
        let store = ProjectStore(projectsDirectoryURL: projectsDirectory)

        XCTAssertThrowsError(try store.saveNewProject(recordingURL: recordingURL))
    }
}
