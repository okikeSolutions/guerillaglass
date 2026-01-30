import Project
@testable import UI
import XCTest

@MainActor
final class ProjectLibraryModelTests: XCTestCase {
    func testRefreshLoadsRecentProjects() throws {
        let fileManager = FileManager.default
        let baseURL = fileManager.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try fileManager.createDirectory(at: baseURL, withIntermediateDirectories: true)
        defer { try? fileManager.removeItem(at: baseURL) }

        let projectURL = baseURL.appendingPathComponent("Project.gglassproj", isDirectory: true)
        try fileManager.createDirectory(at: projectURL, withIntermediateDirectories: true)

        let indexURL = baseURL.appendingPathComponent("library.json")
        let store = ProjectLibraryStore(indexURL: indexURL)
        try store.recordRecentProject(url: projectURL, displayName: "Project")

        let model = ProjectLibraryModel(store: store, limit: 5)
        model.refresh()

        XCTAssertEqual(model.recentProjects.count, 1)
        XCTAssertEqual(model.recentProjects.first?.displayName, "Project")
    }

    func testRecordRecentUpdatesList() throws {
        let fileManager = FileManager.default
        let baseURL = fileManager.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try fileManager.createDirectory(at: baseURL, withIntermediateDirectories: true)
        defer { try? fileManager.removeItem(at: baseURL) }

        let projectURL = baseURL.appendingPathComponent("Project.gglassproj", isDirectory: true)
        try fileManager.createDirectory(at: projectURL, withIntermediateDirectories: true)

        let indexURL = baseURL.appendingPathComponent("library.json")
        let store = ProjectLibraryStore(indexURL: indexURL)
        let model = ProjectLibraryModel(store: store, limit: 5)

        model.recordRecent(url: projectURL)

        XCTAssertEqual(model.recentProjects.count, 1)
        XCTAssertEqual(model.recentProjects.first?.displayName, "Project")
    }

    func testResolveURLReturnsURLForItem() throws {
        let fileManager = FileManager.default
        let baseURL = fileManager.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try fileManager.createDirectory(at: baseURL, withIntermediateDirectories: true)
        defer { try? fileManager.removeItem(at: baseURL) }

        let projectURL = baseURL.appendingPathComponent("Project.gglassproj", isDirectory: true)
        try fileManager.createDirectory(at: projectURL, withIntermediateDirectories: true)

        let indexURL = baseURL.appendingPathComponent("library.json")
        let store = ProjectLibraryStore(indexURL: indexURL)
        let model = ProjectLibraryModel(store: store, limit: 5)

        model.recordRecent(url: projectURL)
        guard let item = model.recentProjects.first else {
            XCTFail("Expected recent project")
            return
        }

        let resolved = model.resolveURL(for: item)
        XCTAssertEqual(normalizedURL(resolved), normalizedURL(projectURL))
    }

    private func normalizedURL(_ url: URL?) -> URL? {
        url?.resolvingSymlinksInPath().standardizedFileURL
    }
}
