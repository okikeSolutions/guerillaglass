import Foundation
import Project

@MainActor
public final class ProjectLibraryModel: ObservableObject {
    @Published public private(set) var recentProjects: [ProjectLibraryItem] = []

    private let store: ProjectLibraryStore
    private let limit: Int

    public init(store: ProjectLibraryStore = ProjectLibraryStore(), limit: Int = 10) {
        self.store = store
        self.limit = limit
    }

    public func refresh() {
        recentProjects = store.recentProjects(limit: limit)
    }

    public func recordRecent(url: URL) {
        try? store.recordRecentProject(url: url)
        refresh()
    }

    public func resolveURL(for item: ProjectLibraryItem) -> URL? {
        store.resolveURL(for: item)
    }
}
