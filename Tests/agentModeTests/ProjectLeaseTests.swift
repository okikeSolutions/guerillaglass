@testable import Project
import XCTest

final class ProjectLeaseTests: XCTestCase {
    func testCompetingOwnerIsRejectedAndReleaseAllowsHandoff() throws {
        let root = URL(fileURLWithPath: "/private\(FileManager.default.temporaryDirectory.path)")
            .appendingPathComponent("gg-lease-\(UUID().uuidString).gglassproj")
        defer { try? FileManager.default.removeItem(at: root) }
        var owner: ProjectLease? = try ProjectLease(url: root)
        XCTAssertEqual(owner?.url, root)
        XCTAssertThrowsError(try ProjectLease(url: root))
        owner = nil
        XCTAssertNoThrow(try ProjectLease(url: root))
    }

    func testSymlinkedDirectoryCannotAcquireOwnership() throws {
        let root = URL(fileURLWithPath: "/private\(FileManager.default.temporaryDirectory.path)")
            .appendingPathComponent("gg-lease-link-\(UUID().uuidString)")
        defer { try? FileManager.default.removeItem(at: root) }
        try FileManager.default.createSymbolicLink(at: root, withDestinationURL: root.deletingLastPathComponent())
        XCTAssertThrowsError(try ProjectLease(url: root.appendingPathComponent("escaped.gglassproj")))
    }
}
