import Foundation

/// Public enum exposed by the macOS engine module.
public enum ProjectMigration {
    public enum MigrationError: Error {
        case unknownVersion
        case invalidPayload
    }

    private struct VersionProbe: Decodable {
        let projectVersion: Int
    }

    private struct ProjectDocumentV1: Decodable {
        let projectVersion: Int
        let project: ProjectV1
        let recordingFileName: String
        let systemAudioFileName: String?
        let micAudioFileName: String?
        let eventsFileName: String?
    }

    private struct ProjectV1: Decodable {
        let id: UUID
        let createdAt: Date
    }

    public static func migrateIfNeeded(_ data: Data) throws -> Data {
        let decoder = ProjectStore.makeDefaultDecoder()
        guard let probe = try? decoder.decode(VersionProbe.self, from: data) else {
            throw MigrationError.invalidPayload
        }

        switch probe.projectVersion {
        case 1:
            let v3Data = try migrateV1ToV3(data, decoder: decoder)
            return try migrateV3ToV4(v3Data, decoder: decoder)
        case 2:
            let v3Data = try migrateV2ToV3(data, decoder: decoder)
            return try migrateV3ToV4(v3Data, decoder: decoder)
        case 3:
            return try migrateV3ToV4(data, decoder: decoder)
        case ProjectSchemaVersion.current:
            return data
        default:
            throw MigrationError.unknownVersion
        }
    }

    private static func migrateV1ToV3(_ data: Data, decoder: JSONDecoder) throws -> Data {
        let documentV1 = try decoder.decode(ProjectDocumentV1.self, from: data)
        let project = Project(
            id: documentV1.project.id,
            createdAt: documentV1.project.createdAt,
            autoZoom: AutoZoomSettings(),
            captureMetadata: nil
        )
        let document = ProjectDocument(
            projectVersion: 3,
            project: project,
            recordingFileName: documentV1.recordingFileName,
            systemAudioFileName: documentV1.systemAudioFileName,
            micAudioFileName: documentV1.micAudioFileName,
            eventsFileName: documentV1.eventsFileName
        )
        let encoder = ProjectStore.makeDefaultEncoder()
        return try encoder.encode(document)
    }

    private static func migrateV2ToV3(_ data: Data, decoder: JSONDecoder) throws -> Data {
        var document = try decoder.decode(ProjectDocument.self, from: data)
        document.projectVersion = 3
        let encoder = ProjectStore.makeDefaultEncoder()
        return try encoder.encode(document)
    }

    private static func migrateV3ToV4(_ data: Data, decoder: JSONDecoder) throws -> Data {
        var document = try decoder.decode(ProjectDocument.self, from: data)
        document.projectVersion = ProjectSchemaVersion.current
        if document.project.agentAnalysis == nil {
            document.project.agentAnalysis = AgentAnalysisMetadata()
        }
        let encoder = ProjectStore.makeDefaultEncoder()
        return try encoder.encode(document)
    }
}
