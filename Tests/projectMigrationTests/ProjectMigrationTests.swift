import XCTest
@testable import Project

final class ProjectMigrationTests: XCTestCase {
    func testMigrationPassesThroughData() throws {
        let data = try JSONEncoder().encode(Project())
        let migrated = try ProjectMigration.migrateIfNeeded(data)
        XCTAssertEqual(data, migrated)
    }
}
