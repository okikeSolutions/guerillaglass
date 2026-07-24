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
        XCTAssertEqual(decoded.project.timeline, TimelineDocument())
        XCTAssertNil(decoded.project.captureMetadata)
        XCTAssertNotNil(decoded.project.agentAnalysis)
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
        XCTAssertEqual(decoded.project.timeline, TimelineDocument())
        XCTAssertNil(decoded.project.captureMetadata)
        XCTAssertNotNil(decoded.project.agentAnalysis)
    }

    func testMigrationUpgradesV3Document() throws {
        var document = ProjectDocument()
        document.projectVersion = 3
        document.project.agentAnalysis = nil

        let encoder = ProjectStore.makeDefaultEncoder()
        let data = try encoder.encode(document)

        let migrated = try ProjectMigration.migrateIfNeeded(data)
        let decoder = ProjectStore.makeDefaultDecoder()
        let decoded = try decoder.decode(ProjectDocument.self, from: migrated)

        XCTAssertEqual(decoded.projectVersion, ProjectSchemaVersion.current)
        XCTAssertNotNil(decoded.project.agentAnalysis)
        XCTAssertEqual(decoded.project.timeline, TimelineDocument())
    }

    func testMigrationUpgradesV4Document() throws {
        var document = ProjectDocument()
        document.projectVersion = 4

        let encoder = ProjectStore.makeDefaultEncoder()
        let data = try encoder.encode(document)

        let migrated = try ProjectMigration.migrateIfNeeded(data)
        let decoder = ProjectStore.makeDefaultDecoder()
        let decoded = try decoder.decode(ProjectDocument.self, from: migrated)

        XCTAssertEqual(decoded.projectVersion, ProjectSchemaVersion.current)
        XCTAssertEqual(decoded.project.timeline, TimelineDocument())
    }

    func testMigrationUpgradesV5DocumentWithLegacyTimelineSegments() throws {
        struct LegacyTimelineClip: Codable {
            let id: String
            let sourceAssetId: String
            let sourceStartSeconds: Double
            let sourceEndSeconds: Double
        }

        struct LegacyTimelineDocument: Codable {
            let version: Int
            let segments: [LegacyTimelineClip]
        }

        struct LegacyProject: Codable {
            let id: UUID
            let createdAt: Date
            let autoZoom: AutoZoomSettings
            let timeline: LegacyTimelineDocument
            let captureMetadata: CaptureMetadata?
            let lastRecordingTelemetry: CaptureTelemetrySummary?
            let agentAnalysis: AgentAnalysisMetadata?
        }

        struct LegacyProjectDocument: Codable {
            let projectVersion: Int
            let project: LegacyProject
            let recordingFileName: String
            let systemAudioFileName: String?
            let micAudioFileName: String?
            let eventsFileName: String?
        }

        let projectID = UUID()
        let createdAt = Date()
        let document = LegacyProjectDocument(
            projectVersion: 5,
            project: LegacyProject(
                id: projectID,
                createdAt: createdAt,
                autoZoom: AutoZoomSettings(),
                timeline: LegacyTimelineDocument(
                    version: 1,
                    segments: [
                        LegacyTimelineClip(
                            id: "segment-0",
                            sourceAssetId: "recording",
                            sourceStartSeconds: 1,
                            sourceEndSeconds: 3
                        )
                    ]
                ),
                captureMetadata: nil,
                lastRecordingTelemetry: nil,
                agentAnalysis: AgentAnalysisMetadata()
            ),
            recordingFileName: ProjectFile.recordingMov,
            systemAudioFileName: nil,
            micAudioFileName: nil,
            eventsFileName: nil
        )

        let encoder = ProjectStore.makeDefaultEncoder()
        let data = try encoder.encode(document)

        let migrated = try ProjectMigration.migrateIfNeeded(data)
        let decoder = ProjectStore.makeDefaultDecoder()
        let decoded = try decoder.decode(ProjectDocument.self, from: migrated)

        XCTAssertEqual(decoded.projectVersion, ProjectSchemaVersion.current)
        XCTAssertEqual(decoded.project.id, projectID)
        XCTAssertEqual(
            decoded.project.createdAt.timeIntervalSince1970,
            createdAt.timeIntervalSince1970,
            accuracy: 0.001
        )
        XCTAssertEqual(decoded.project.timeline.items.count, 1)
        guard case let .clip(clip)? = decoded.project.timeline.items.first else {
            XCTFail("Expected migrated legacy segment to decode as a clip item.")
            return
        }
        XCTAssertEqual(clip.id, "segment-0")
        XCTAssertEqual(clip.sourceAssetId, .recording)
        XCTAssertEqual(clip.sourceStartSeconds, 1)
        XCTAssertEqual(clip.sourceEndSeconds, 3)
    }

    func testMigrationUpgradesV6DocumentWithMissingBackgroundFraming() throws {
        var document = ProjectDocument()
        document.projectVersion = 6
        let encoded = try ProjectStore.makeDefaultEncoder().encode(document)
        var payload = try XCTUnwrap(JSONSerialization.jsonObject(with: encoded) as? [String: Any])
        var project = try XCTUnwrap(payload["project"] as? [String: Any])
        project.removeValue(forKey: "backgroundFraming")
        payload["project"] = project
        let legacyData = try JSONSerialization.data(withJSONObject: payload)

        let migrated = try ProjectMigration.migrateIfNeeded(legacyData)
        let decoded = try ProjectStore.makeDefaultDecoder().decode(ProjectDocument.self, from: migrated)

        XCTAssertEqual(decoded.projectVersion, ProjectSchemaVersion.current)
        XCTAssertEqual(decoded.project.backgroundFraming, .defaults)
    }

    func testMigrationRejectsMalformedPresentBackgroundFraming() throws {
        var document = ProjectDocument()
        document.projectVersion = 6
        let encoded = try ProjectStore.makeDefaultEncoder().encode(document)
        var payload = try XCTUnwrap(JSONSerialization.jsonObject(with: encoded) as? [String: Any])
        var project = try XCTUnwrap(payload["project"] as? [String: Any])
        project["backgroundFraming"] = ["enabled": true]
        payload["project"] = project
        let malformedData = try JSONSerialization.data(withJSONObject: payload)

        XCTAssertThrowsError(try ProjectMigration.migrateIfNeeded(malformedData))
    }

    func testBackgroundFramingRejectsInvalidBoundaries() throws {
        XCTAssertThrowsError(try BackgroundFramingSettings(
            version: 2,
            enabled: true,
            backgroundColor: "#18181B",
            paddingFraction: 0.06,
            cornerRadiusFraction: 0.025,
            shadowStrength: 0.35
        ))
        XCTAssertThrowsError(try BackgroundFramingSettings(
            version: 1,
            enabled: true,
            backgroundColor: "18181B",
            paddingFraction: 0.06,
            cornerRadiusFraction: 0.025,
            shadowStrength: 0.35
        ))
        for invalidPadding in [-0.001, 0.251, .nan, .infinity] {
            XCTAssertThrowsError(try BackgroundFramingSettings(
                version: 1,
                enabled: true,
                backgroundColor: "#18181B",
                paddingFraction: invalidPadding,
                cornerRadiusFraction: 0.025,
                shadowStrength: 0.35
            ))
        }
        XCTAssertThrowsError(try BackgroundFramingSettings(
            version: 1,
            enabled: true,
            backgroundColor: "#18181B",
            paddingFraction: 0.06,
            cornerRadiusFraction: 0.101,
            shadowStrength: 0.35
        ))
        XCTAssertThrowsError(try BackgroundFramingSettings(
            version: 1,
            enabled: true,
            backgroundColor: "#18181B",
            paddingFraction: 0.06,
            cornerRadiusFraction: 0.025,
            shadowStrength: 1.001
        ))
    }

    func testBackgroundFramingExportPrecedence() throws {
        let persisted = try BackgroundFramingSettings(
            version: 1,
            enabled: true,
            backgroundColor: "#112233",
            paddingFraction: 0.1,
            cornerRadiusFraction: 0.04,
            shadowStrength: 0.5
        )
        let override = try BackgroundFramingSettings(
            version: 1,
            enabled: true,
            backgroundColor: "#abcdef",
            paddingFraction: 0.2,
            cornerRadiusFraction: 0.08,
            shadowStrength: 0.8
        )

        XCTAssertEqual(
            BackgroundFramingSettings.resolve(exportOverride: override, persisted: persisted),
            override
        )
        XCTAssertEqual(
            BackgroundFramingSettings.resolve(exportOverride: nil, persisted: persisted),
            persisted
        )
        XCTAssertEqual(
            BackgroundFramingSettings.resolve(exportOverride: nil, persisted: nil),
            .defaults
        )
        XCTAssertEqual(override.backgroundColor, "#ABCDEF")
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
