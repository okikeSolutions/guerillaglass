import Foundation

public struct ProjectDocument: Codable, Equatable {
    public var projectVersion: Int
    public var project: Project
    public var recordingFileName: String
    public var systemAudioFileName: String?
    public var micAudioFileName: String?
    public var eventsFileName: String?

    public init(
        projectVersion: Int = ProjectSchemaVersion.current,
        project: Project = Project(),
        recordingFileName: String = ProjectFile.recordingMov,
        systemAudioFileName: String? = nil,
        micAudioFileName: String? = nil,
        eventsFileName: String? = nil
    ) {
        self.projectVersion = projectVersion
        self.project = project
        self.recordingFileName = recordingFileName
        self.systemAudioFileName = systemAudioFileName
        self.micAudioFileName = micAudioFileName
        self.eventsFileName = eventsFileName
    }
}
