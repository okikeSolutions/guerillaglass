import Foundation
import Project
import SwiftUI
import UniformTypeIdentifiers

public struct ProjectAssetSources: Equatable {
    var recordingURL: URL?
    var systemAudioURL: URL?
    var micAudioURL: URL?
    var eventsURL: URL?

    init() {}

    init(projectURL: URL, document: ProjectDocument, fileManager: FileManager = .default) {
        let recording = projectURL.appendingPathComponent(document.recordingFileName)
        if fileManager.fileExists(atPath: recording.path) {
            recordingURL = recording
        }

        if let systemAudioFileName = document.systemAudioFileName {
            let systemAudio = projectURL.appendingPathComponent(systemAudioFileName)
            if fileManager.fileExists(atPath: systemAudio.path) {
                systemAudioURL = systemAudio
            }
        }

        if let micAudioFileName = document.micAudioFileName {
            let micAudio = projectURL.appendingPathComponent(micAudioFileName)
            if fileManager.fileExists(atPath: micAudio.path) {
                micAudioURL = micAudio
            }
        }

        if let eventsFileName = document.eventsFileName {
            let events = projectURL.appendingPathComponent(eventsFileName)
            if fileManager.fileExists(atPath: events.path) {
                eventsURL = events
            }
        }
    }
}

public struct GuerillaglassDocument: FileDocument {
    public static var readableContentTypes: [UTType] {
        [.guerillaglassProject]
    }

    public static var writableContentTypes: [UTType] {
        [.guerillaglassProject]
    }

    public var projectDocument: ProjectDocument
    public var assets: ProjectAssetSources
    public var projectURL: URL?

    public init() {
        projectDocument = ProjectDocument()
        assets = ProjectAssetSources()
    }

    public init(configuration: ReadConfiguration) throws {
        let wrapper = configuration.file
        guard wrapper.isDirectory else {
            throw CocoaError(.fileReadCorruptFile)
        }

        guard
            let projectWrapper = wrapper.fileWrappers?[ProjectFile.projectJSON],
            let projectData = projectWrapper.regularFileContents
        else {
            throw CocoaError(.fileReadCorruptFile)
        }

        let migrated = try ProjectMigration.migrateIfNeeded(projectData)
        let decoder = ProjectStore.makeDefaultDecoder()
        projectDocument = try decoder.decode(ProjectDocument.self, from: migrated)
        assets = ProjectAssetSources()
    }

    public func fileWrapper(configuration _: WriteConfiguration) throws -> FileWrapper {
        let fileManager = FileManager.default
        let temporaryBase = fileManager.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)

        let store = ProjectStore()
        _ = try store.writeProject(
            document: projectDocument,
            assets: ProjectStore.ProjectAssetURLs(
                recordingURL: assets.recordingURL,
                systemAudioURL: assets.systemAudioURL,
                micAudioURL: assets.micAudioURL,
                eventsURL: assets.eventsURL
            ),
            to: temporaryBase
        )

        return try FileWrapper(url: temporaryBase, options: .immediate)
    }

    public mutating func updateProjectURL(_ url: URL?) {
        projectURL = url
        guard let url else { return }
        assets = ProjectAssetSources(projectURL: url, document: projectDocument)
    }

    public mutating func updateRecordingSource(_ url: URL?) {
        assets.recordingURL = url
    }

    public mutating func updateEventsSource(_ url: URL?) {
        assets.eventsURL = url
    }
}
