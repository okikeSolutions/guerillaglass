import Foundation

/// Public class exposed by the macOS engine module.
public final class ProjectStore {
    public enum StoreError: Error {
        case invalidRecordingURL
        case projectJSONMissing
        case invalidProjectDirectory
        case invalidAssetFileName(String)
    }

    public struct SavedProject: Equatable {
        public let url: URL
        public let document: ProjectDocument
    }

    public struct ProjectAssetURLs: Equatable {
        public var recordingURL: URL?
        public var systemAudioURL: URL?
        public var micAudioURL: URL?
        public var eventsURL: URL?

        public init(
            recordingURL: URL? = nil,
            systemAudioURL: URL? = nil,
            micAudioURL: URL? = nil,
            eventsURL: URL? = nil
        ) {
            self.recordingURL = recordingURL
            self.systemAudioURL = systemAudioURL
            self.micAudioURL = micAudioURL
            self.eventsURL = eventsURL
        }
    }

    private let fileManager: FileManager
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder
    private let projectsDirectoryURL: URL?

    public init(
        fileManager: FileManager = .default,
        encoder: JSONEncoder = ProjectStore.makeDefaultEncoder(),
        decoder: JSONDecoder = ProjectStore.makeDefaultDecoder(),
        projectsDirectoryURL: URL? = nil
    ) {
        self.fileManager = fileManager
        self.encoder = encoder
        self.decoder = decoder
        self.projectsDirectoryURL = projectsDirectoryURL
    }

    public func saveNewProject(
        recordingURL: URL,
        systemAudioURL: URL? = nil,
        micAudioURL: URL? = nil,
        eventsURL: URL? = nil
    ) throws -> SavedProject {
        guard fileManager.fileExists(atPath: recordingURL.path) else {
            throw StoreError.invalidRecordingURL
        }

        let projectDirectory = makeProjectDirectoryURL()
        var document = ProjectDocument()
        document.project.createdAt = Self.dateRoundedToMilliseconds(document.project.createdAt)
        let writtenDocument = try writeProject(
            document: document,
            assets: ProjectAssetURLs(
                recordingURL: recordingURL,
                systemAudioURL: systemAudioURL,
                micAudioURL: micAudioURL,
                eventsURL: eventsURL
            ),
            to: projectDirectory
        )

        return SavedProject(url: projectDirectory, document: writtenDocument)
    }

    public func loadProject(at url: URL) throws -> SavedProject {
        guard fileManager.fileExists(atPath: url.path) else {
            throw StoreError.invalidProjectDirectory
        }

        let projectJSONURL = url.appendingPathComponent(ProjectFile.projectJSON)
        guard fileManager.fileExists(atPath: projectJSONURL.path) else {
            throw StoreError.projectJSONMissing
        }

        let data = try Data(contentsOf: projectJSONURL)
        let migratedData = try ProjectMigration.migrateIfNeeded(data)
        let decodedDocument = try decoder.decode(ProjectDocument.self, from: migratedData)
        let document = try validatedDocument(decodedDocument)

        return SavedProject(url: url, document: document)
    }

    public func resolveRecordingURL(for project: SavedProject) -> URL {
        project.url.appendingPathComponent(project.document.recordingFileName)
    }

    public func resolveSystemAudioURL(for project: SavedProject) -> URL? {
        guard let fileName = project.document.systemAudioFileName else { return nil }
        return project.url.appendingPathComponent(fileName)
    }

    public func resolveMicAudioURL(for project: SavedProject) -> URL? {
        guard let fileName = project.document.micAudioFileName else { return nil }
        return project.url.appendingPathComponent(fileName)
    }

    public func resolveEventsURL(for project: SavedProject) -> URL? {
        guard let fileName = project.document.eventsFileName else { return nil }
        return project.url.appendingPathComponent(fileName)
    }

    public func defaultProjectsDirectory() -> URL {
        if let projectsDirectoryURL {
            return projectsDirectoryURL
        }
        let base = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        return base
            .appendingPathComponent("guerillaglass", isDirectory: true)
            .appendingPathComponent("Projects", isDirectory: true)
    }

    public func makeProjectDirectoryURL() -> URL {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd'T'HH-mm-ss.SSSZ"
        let timestamp = formatter.string(from: Date())
        return defaultProjectsDirectory()
            .appendingPathComponent("Project-\(timestamp)", isDirectory: true)
    }

    @discardableResult
    public func writeProject(
        document: ProjectDocument,
        assets: ProjectAssetURLs,
        to directoryURL: URL
    ) throws -> ProjectDocument {
        try fileManager.createDirectory(at: directoryURL, withIntermediateDirectories: true)

        var writtenDocument = try validatedDocument(document)

        if let recordingURL = assets.recordingURL {
            guard fileManager.fileExists(atPath: recordingURL.path) else {
                throw StoreError.invalidRecordingURL
            }
            let destination = directoryURL.appendingPathComponent(writtenDocument.recordingFileName)
            try copyItemReplacingIfNeeded(from: recordingURL, to: destination)
        }

        if let systemAudioURL = assets.systemAudioURL {
            let fileName = document.systemAudioFileName ?? ProjectFile.systemAudioM4A
            let destination = directoryURL.appendingPathComponent(fileName)
            try copyItemReplacingIfNeeded(from: systemAudioURL, to: destination)
            writtenDocument.systemAudioFileName = fileName
        }

        if let micAudioURL = assets.micAudioURL {
            let fileName = document.micAudioFileName ?? ProjectFile.micAudioM4A
            let destination = directoryURL.appendingPathComponent(fileName)
            try copyItemReplacingIfNeeded(from: micAudioURL, to: destination)
            writtenDocument.micAudioFileName = fileName
        }

        if let eventsURL = assets.eventsURL {
            let fileName = document.eventsFileName ?? ProjectFile.eventsJSON
            let destination = directoryURL.appendingPathComponent(fileName)
            try copyItemReplacingIfNeeded(from: eventsURL, to: destination)
            writtenDocument.eventsFileName = fileName
        }

        let projectJSONURL = directoryURL.appendingPathComponent(ProjectFile.projectJSON)
        let data = try encoder.encode(writtenDocument)
        try data.write(to: projectJSONURL, options: [.atomic])

        return writtenDocument
    }

    public static func makeDefaultEncoder() -> JSONEncoder {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .custom { date, encoder in
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            var container = encoder.singleValueContainer()
            try container.encode(formatter.string(from: date))
        }
        return encoder
    }

    public static func makeDefaultDecoder() -> JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            let container = try decoder.singleValueContainer()
            let value = try container.decode(String.self)
            if let date = formatter.date(from: value) {
                return date
            }
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Invalid ISO8601 date: \(value)")
        }
        return decoder
    }

    private func copyItemReplacingIfNeeded(from sourceURL: URL, to destinationURL: URL) throws {
        if fileManager.fileExists(atPath: destinationURL.path) {
            try fileManager.removeItem(at: destinationURL)
        }
        try fileManager.copyItem(at: sourceURL, to: destinationURL)
    }

    private func validatedDocument(_ document: ProjectDocument) throws -> ProjectDocument {
        var validated = document
        validated.recordingFileName = try validatedAssetFileName(document.recordingFileName)
        if let systemAudioFileName = document.systemAudioFileName {
            validated.systemAudioFileName = try validatedAssetFileName(systemAudioFileName)
        }
        if let micAudioFileName = document.micAudioFileName {
            validated.micAudioFileName = try validatedAssetFileName(micAudioFileName)
        }
        if let eventsFileName = document.eventsFileName {
            validated.eventsFileName = try validatedAssetFileName(eventsFileName)
        }
        return validated
    }

    private func validatedAssetFileName(_ fileName: String) throws -> String {
        let trimmed = fileName.trimmingCharacters(in: .whitespacesAndNewlines)
        let lastPathComponent = (trimmed as NSString).lastPathComponent
        let isSinglePathComponent = lastPathComponent == trimmed
        let hasIllegalSeparators = trimmed.contains("/") || trimmed.contains("\\")
        let hasIllegalControlCharacters = trimmed.contains("\0")
        let isInvalidReservedName = trimmed.isEmpty || trimmed == "." || trimmed == ".."

        guard isSinglePathComponent,
              !hasIllegalSeparators,
              !hasIllegalControlCharacters,
              !isInvalidReservedName
        else {
            throw StoreError.invalidAssetFileName(fileName)
        }

        return trimmed
    }

    private static func dateRoundedToMilliseconds(_ date: Date) -> Date {
        let interval = date.timeIntervalSince1970
        let rounded = (interval * 1000).rounded() / 1000
        return Date(timeIntervalSince1970: rounded)
    }
}
