import Foundation

public enum ProjectMigration {
    public enum MigrationError: Error {
        case unknownVersion
        case invalidPayload
    }

    private struct VersionProbe: Decodable {
        let projectVersion: Int
    }

    public static func migrateIfNeeded(_ data: Data) throws -> Data {
        let decoder = ProjectStore.makeDefaultDecoder()
        guard let probe = try? decoder.decode(VersionProbe.self, from: data) else {
            throw MigrationError.invalidPayload
        }

        switch probe.projectVersion {
        case ProjectSchemaVersion.current:
            return data
        default:
            throw MigrationError.unknownVersion
        }
    }
}
