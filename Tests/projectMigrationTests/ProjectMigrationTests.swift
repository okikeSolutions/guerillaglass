@testable import Project
import XCTest

final class ProjectMigrationTests: XCTestCase {
    func testMigrationPassesThroughCurrentVersion() throws {
        let encoder = ProjectStore.makeDefaultEncoder()
        let document = ProjectDocument()
        let data = try encoder.encode(document)
        let migrated = try ProjectMigration.migrateIfNeeded(data)
        XCTAssertEqual(data, migrated)
    }

    func testMigrationUpgradesV1Document() throws {
        struct ProjectV1: Codable {
            let id: UUID
            let createdAt: Date
        }

        struct ProjectDocumentV1: Codable {
            let projectVersion: Int
            let project: ProjectV1
            let recordingFileName: String
            let systemAudioFileName: String?
            let micAudioFileName: String?
            let eventsFileName: String?
        }

        let encoder = ProjectStore.makeDefaultEncoder()
        let projectV1 = ProjectV1(id: UUID(), createdAt: Date())
        let documentV1 = ProjectDocumentV1(
            projectVersion: 1,
            project: projectV1,
            recordingFileName: ProjectFile.recordingMov,
            systemAudioFileName: nil,
            micAudioFileName: nil,
            eventsFileName: nil
        )
        let data = try encoder.encode(documentV1)

        let migrated = try ProjectMigration.migrateIfNeeded(data)
        let decoder = ProjectStore.makeDefaultDecoder()
        let decoded = try decoder.decode(ProjectDocument.self, from: migrated)

        XCTAssertEqual(decoded.projectVersion, ProjectSchemaVersion.current)
        XCTAssertEqual(decoded.project.id, projectV1.id)
        XCTAssertEqual(decoded.project.autoZoom, AutoZoomSettings())
        XCTAssertNil(decoded.project.captureMetadata)
    }

    func testMigrationUpgradesV2Document() throws {
        var document = ProjectDocument()
        document.projectVersion = 2
        document.project.autoZoom = AutoZoomSettings(isEnabled: false, intensity: 0.5)

        let encoder = ProjectStore.makeDefaultEncoder()
        let data = try encoder.encode(document)

        let migrated = try ProjectMigration.migrateIfNeeded(data)
        let decoder = ProjectStore.makeDefaultDecoder()
        let decoded = try decoder.decode(ProjectDocument.self, from: migrated)

        XCTAssertEqual(decoded.projectVersion, ProjectSchemaVersion.current)
        XCTAssertEqual(decoded.project.autoZoom, document.project.autoZoom)
        XCTAssertNil(decoded.project.captureMetadata)
    }

    func testMigrationRejectsMissingVersion() throws {
        let encoder = ProjectStore.makeDefaultEncoder()
        let project = Project()
        let data = try encoder.encode(project)
        XCTAssertThrowsError(try ProjectMigration.migrateIfNeeded(data)) { error in
            guard case ProjectMigration.MigrationError.invalidPayload = error else {
                XCTFail("Unexpected error: \(error)")
                return
            }
        }
    }

    func testMigrationRejectsUnknownVersion() throws {
        var document = ProjectDocument()
        document.projectVersion = 999
        let encoder = ProjectStore.makeDefaultEncoder()
        let data = try encoder.encode(document)
        XCTAssertThrowsError(try ProjectMigration.migrateIfNeeded(data)) { error in
            guard case ProjectMigration.MigrationError.unknownVersion = error else {
                XCTFail("Unexpected error: \(error)")
                return
            }
        }
    }
}
