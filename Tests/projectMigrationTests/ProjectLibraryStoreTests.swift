@testable import Project
import XCTest

final class ProjectLibraryStoreTests: XCTestCase {
    func testRecentProjectsSortedByLastOpenedDate() throws {
        let fileManager = FileManager.default
        let baseURL = fileManager.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try fileManager.createDirectory(at: baseURL, withIntermediateDirectories: true)
        defer { try? fileManager.removeItem(at: baseURL) }

        let firstProject = baseURL.appendingPathComponent("First.gglassproj", isDirectory: true)
        let secondProject = baseURL.appendingPathComponent("Second.gglassproj", isDirectory: true)
        try fileManager.createDirectory(at: firstProject, withIntermediateDirectories: true)
        try fileManager.createDirectory(at: secondProject, withIntermediateDirectories: true)

        let indexURL = baseURL.appendingPathComponent("library.json")
        let store = ProjectLibraryStore(indexURL: indexURL)

        let olderDate = Date(timeIntervalSince1970: 1)
        let newerDate = Date(timeIntervalSince1970: 2)

        try store.recordRecentProject(url: firstProject, displayName: "First", lastOpenedAt: olderDate)
        try store.recordRecentProject(url: secondProject, displayName: "Second", lastOpenedAt: newerDate)

        let recent = store.recentProjects(limit: 2)
        XCTAssertEqual(recent.count, 2)
        XCTAssertEqual(recent[0].displayName, "Second")
        XCTAssertEqual(recent[1].displayName, "First")
    }

    func testRemoveRecentProjectByURL() throws {
        let fileManager = FileManager.default
        let baseURL = fileManager.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try fileManager.createDirectory(at: baseURL, withIntermediateDirectories: true)
        defer { try? fileManager.removeItem(at: baseURL) }

        let firstProject = baseURL.appendingPathComponent("First.gglassproj", isDirectory: true)
        let secondProject = baseURL.appendingPathComponent("Second.gglassproj", isDirectory: true)
        try fileManager.createDirectory(at: firstProject, withIntermediateDirectories: true)
        try fileManager.createDirectory(at: secondProject, withIntermediateDirectories: true)

        let indexURL = baseURL.appendingPathComponent("library.json")
        let store = ProjectLibraryStore(indexURL: indexURL)

        try store.recordRecentProject(url: firstProject, displayName: "First")
        try store.recordRecentProject(url: secondProject, displayName: "Second")

        store.removeRecentProject(url: firstProject)

        let recent = store.recentProjects(limit: 10)
        XCTAssertEqual(recent.count, 1)
        XCTAssertEqual(recent.first?.displayName, "Second")
    }

    func testRefreshBookmarkUpdatesEntry() throws {
        let fileManager = FileManager.default
        let baseURL = fileManager.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try fileManager.createDirectory(at: baseURL, withIntermediateDirectories: true)
        defer { try? fileManager.removeItem(at: baseURL) }

        let projectURL = baseURL.appendingPathComponent("Project.gglassproj", isDirectory: true)
        try fileManager.createDirectory(at: projectURL, withIntermediateDirectories: true)

        let indexURL = baseURL.appendingPathComponent("library.json")
        let store = ProjectLibraryStore(indexURL: indexURL)

        try store.recordRecentProject(url: projectURL, displayName: "Project")
        let refreshed = store.refreshBookmark(for: projectURL)

        XCTAssertTrue(refreshed)
        let recent = store.recentProjects(limit: 1)
        XCTAssertEqual(recent.count, 1)
        XCTAssertFalse(recent[0].bookmarkData.isEmpty)
    }
}
