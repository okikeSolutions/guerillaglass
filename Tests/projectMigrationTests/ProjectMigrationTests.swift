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
