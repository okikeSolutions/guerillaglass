import Foundation

public struct ProjectLibraryItem: Codable, Identifiable, Equatable {
    public let id: UUID
    public var bookmarkData: Data
    public var displayName: String
    public var lastOpenedAt: Date

    public init(
        id: UUID = UUID(),
        bookmarkData: Data,
        displayName: String,
        lastOpenedAt: Date = Date()
    ) {
        self.id = id
        self.bookmarkData = bookmarkData
        self.displayName = displayName
        self.lastOpenedAt = lastOpenedAt
    }
}

public struct ProjectLibraryIndex: Codable, Equatable {
    public var items: [ProjectLibraryItem]

    public init(items: [ProjectLibraryItem] = []) {
        self.items = items
    }
}

public final class ProjectLibraryStore {
    public enum StoreError: Error {
        case invalidProjectURL
    }

    private let fileManager: FileManager
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder
    private let indexURL: URL?

    public init(
        fileManager: FileManager = .default,
        encoder: JSONEncoder = ProjectStore.makeDefaultEncoder(),
        decoder: JSONDecoder = ProjectStore.makeDefaultDecoder(),
        indexURL: URL? = nil
    ) {
        self.fileManager = fileManager
        self.encoder = encoder
        self.decoder = decoder
        self.indexURL = indexURL
    }

    public func recentProjects(limit: Int) -> [ProjectLibraryItem] {
        let index = loadIndex()
        let sorted = index.items.sorted { $0.lastOpenedAt > $1.lastOpenedAt }
        return Array(sorted.prefix(max(0, limit)))
    }

    public func recordRecentProject(
        url: URL,
        displayName: String? = nil,
        lastOpenedAt: Date = Date()
    ) throws {
        guard fileManager.fileExists(atPath: url.path) else {
            throw StoreError.invalidProjectURL
        }

        let bookmarkData = try url.bookmarkData(
            options: [.withSecurityScope],
            includingResourceValuesForKeys: nil,
            relativeTo: nil
        )
        let name = displayName ?? url.deletingPathExtension().lastPathComponent
        var index = loadIndex()

        if let existingIndex = index.items.firstIndex(
            where: { matches(resolveURL(for: $0, updateIfStale: false), url) }
        ) {
            index.items[existingIndex].bookmarkData = bookmarkData
            index.items[existingIndex].displayName = name
            index.items[existingIndex].lastOpenedAt = lastOpenedAt
        } else {
            index.items.append(
                ProjectLibraryItem(
                    bookmarkData: bookmarkData,
                    displayName: name
                )
            )
            index.items[index.items.count - 1].lastOpenedAt = lastOpenedAt
        }

        try saveIndex(index)
    }

    public func removeRecentProject(id: UUID) {
        var index = loadIndex()
        index.items.removeAll { $0.id == id }
        try? saveIndex(index)
    }

    public func removeRecentProject(url: URL) {
        var index = loadIndex()
        index.items.removeAll { matches(resolveURL(for: $0, updateIfStale: false), url) }
        try? saveIndex(index)
    }

    public func refreshBookmark(for url: URL) -> Bool {
        var index = loadIndex()
        guard let existingIndex = index.items.firstIndex(
            where: { matches(resolveURL(for: $0, updateIfStale: false), url) }
        ) else {
            return false
        }

        guard let refreshed = try? url.bookmarkData(
            options: [.withSecurityScope],
            includingResourceValuesForKeys: nil,
            relativeTo: nil
        ) else {
            return false
        }

        index.items[existingIndex].bookmarkData = refreshed
        try? saveIndex(index)
        return true
    }

    public func resolveURL(for item: ProjectLibraryItem) -> URL? {
        resolveURL(for: item, updateIfStale: true)
    }

    private func resolveURL(for item: ProjectLibraryItem, updateIfStale: Bool) -> URL? {
        var isStale = false
        guard let url = try? URL(
            resolvingBookmarkData: item.bookmarkData,
            options: [.withSecurityScope],
            bookmarkDataIsStale: &isStale
        ) else {
            return nil
        }

        if updateIfStale, isStale {
            if let refreshed = try? url.bookmarkData(
                options: [.withSecurityScope],
                includingResourceValuesForKeys: nil,
                relativeTo: nil
            ) {
                updateBookmarkData(refreshed, for: item)
            }
        }

        return url
    }

    private func updateBookmarkData(_ data: Data, for item: ProjectLibraryItem) {
        var index = loadIndex()
        guard let existingIndex = index.items.firstIndex(where: { $0.id == item.id }) else {
            return
        }
        index.items[existingIndex].bookmarkData = data
        try? saveIndex(index)
    }

    private func loadIndex() -> ProjectLibraryIndex {
        let url = indexURL ?? defaultIndexURL()
        guard fileManager.fileExists(atPath: url.path) else {
            return ProjectLibraryIndex()
        }

        guard let data = try? Data(contentsOf: url) else {
            return ProjectLibraryIndex()
        }

        return (try? decoder.decode(ProjectLibraryIndex.self, from: data)) ?? ProjectLibraryIndex()
    }

    private func saveIndex(_ index: ProjectLibraryIndex) throws {
        let url = indexURL ?? defaultIndexURL()
        try fileManager.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        let data = try encoder.encode(index)
        try data.write(to: url, options: [.atomic])
    }

    private func defaultIndexURL() -> URL {
        let base = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        return base
            .appendingPathComponent("guerillaglass", isDirectory: true)
            .appendingPathComponent("Library", isDirectory: true)
            .appendingPathComponent("library.json")
    }

    private func matches(_ resolvedURL: URL?, _ targetURL: URL) -> Bool {
        guard let resolvedURL else {
            return false
        }
        return normalizedURL(resolvedURL) == normalizedURL(targetURL)
    }

    private func normalizedURL(_ url: URL) -> URL {
        url.resolvingSymlinksInPath().standardizedFileURL
    }
}
