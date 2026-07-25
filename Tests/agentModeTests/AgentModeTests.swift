@testable import Project
import XCTest

final class AgentModeTests: XCTestCase {
    func testPlannerProducesDeterministicOrderedFramePlan() throws {
        let transcript = Data(#"""
        {
          "segments": [
            {"text":"Opening hook", "startSeconds":0.25, "endSeconds":1.0},
            {"text":"Action steps", "startSeconds":2.0, "endSeconds":3.0},
            {"text":"Result payoff", "startSeconds":4.0, "endSeconds":5.0},
            {"text":"Conclusion takeaway", "startSeconds":6.0, "endSeconds":7.25}
          ]
        }
        """#.utf8)

        let first = try ImportedTranscriptAgentPlanner.plan(
            data: transcript,
            sourceDuration: 10,
            sourceFps: AgentFrameRate(numerator: 30)
        )
        let second = try ImportedTranscriptAgentPlanner.plan(
            data: transcript,
            sourceDuration: 10,
            sourceFps: AgentFrameRate(numerator: 30)
        )

        XCTAssertEqual(first, second)
        XCTAssertTrue(first.qaReport.passed)
        XCTAssertEqual(first.cutPlan.segments, [
            .init(id: "agent-hook-0", beat: .hook, startFrame: 7, endFrame: 30),
            .init(id: "agent-action-1", beat: .action, startFrame: 60, endFrame: 90),
            .init(id: "agent-payoff-2", beat: .payoff, startFrame: 120, endFrame: 150),
            .init(id: "agent-takeaway-3", beat: .takeaway, startFrame: 180, endFrame: 218),
        ])
        let timeline = try first.cutPlan.timeline()
        XCTAssertEqual(timeline.items.count, 4)
        guard case let .clip(firstClip) = timeline.items[0] else {
            return XCTFail("Expected a clip")
        }
        XCTAssertEqual(firstClip.sourceStartSeconds, 7.0 / 30.0, accuracy: 0.000_001)
        XCTAssertEqual(firstClip.sourceEndSeconds, 1, accuracy: 0.000_001)
    }

    func testCutPlanRetainsFractionalFrameRateWithoutRounding() throws {
        let rate = AgentFrameRate(numerator: 30000, denominator: 1001)
        let plan = AgentCutPlanArtifact(
            sourceFps: rate,
            sourceFrameCount: 300,
            segments: [
                .init(id: "agent-hook-0", beat: .hook, startFrame: 1, endFrame: 30),
                .init(id: "agent-action-1", beat: .action, startFrame: 30, endFrame: 60),
                .init(id: "agent-payoff-2", beat: .payoff, startFrame: 60, endFrame: 90),
                .init(id: "agent-takeaway-3", beat: .takeaway, startFrame: 90, endFrame: 120),
            ]
        )

        let timeline = try plan.timeline()
        guard case let .clip(clip) = timeline.items[0] else {
            return XCTFail("Expected a clip")
        }
        XCTAssertEqual(clip.sourceStartSeconds, 1001.0 / 30000.0, accuracy: 0.000_000_1)
        XCTAssertEqual(clip.sourceEndSeconds, 1.001, accuracy: 0.000_000_1)
    }

    func testPlannerBlocksMissingOrOutOfOrderNarrativeBeats() throws {
        let transcript = Data(#"""
        {
          "segments": [
            {"text":"payoff result", "startSeconds":0, "endSeconds":1},
            {"text":"opening hook", "startSeconds":1, "endSeconds":2},
            {"text":"action process", "startSeconds":2, "endSeconds":3}
          ]
        }
        """#.utf8)

        let result = try ImportedTranscriptAgentPlanner.plan(
            data: transcript,
            sourceDuration: 5,
            sourceFps: AgentFrameRate(numerator: 30)
        )

        XCTAssertFalse(result.qaReport.passed)
        XCTAssertTrue(result.cutPlan.segments.isEmpty)
        XCTAssertEqual(result.qaReport.missingBeats, ["payoff", "takeaway"])
    }

    func testArtifactStorePersistsAndRecoversCanonicalRun() throws {
        let root = URL(fileURLWithPath: "/private\(FileManager.default.temporaryDirectory.path)", isDirectory: true)
            .appendingPathComponent("gg-agent-store-\(UUID().uuidString)", isDirectory: true)
        defer { try? FileManager.default.removeItem(at: root) }
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        let transcript = Data(#"""
        {
          "segments": [
            {"text":"hook", "startSeconds":0, "endSeconds":1},
            {"text":"action", "startSeconds":1, "endSeconds":2},
            {"text":"payoff", "startSeconds":2, "endSeconds":3},
            {"text":"takeaway", "startSeconds":3, "endSeconds":4}
          ]
        }
        """#.utf8)
        let planned = try ImportedTranscriptAgentPlanner.plan(
            data: transcript,
            sourceDuration: 5,
            sourceFps: AgentFrameRate(numerator: 30)
        )
        let projectId = UUID()
        let now = Date(timeIntervalSince1970: 1_700_000_000)
        let summary = AgentRunSummaryArtifact(
            jobId: "agent-test",
            projectId: projectId,
            recordingFileName: ProjectFile.recordingMov,
            recordingRevision: "fixture-revision",
            status: .completed,
            runtimeBudgetMinutes: 10,
            qaReport: planned.qaReport,
            artifacts: AgentArtifactStore.references,
            cutPlan: planned.cutPlan,
            baseTimeline: TimelineDocument(),
            requiresDestructiveConfirmation: false,
            createdAt: now,
            updatedAt: now
        )

        let store = AgentArtifactStore()
        let persisted = try store.write(plannedRun: planned, summary: summary, projectURL: root)
        let recovered = try XCTUnwrap(store.loadLatest(projectURL: root, projectId: projectId))

        XCTAssertEqual(recovered, persisted)
        XCTAssertTrue(persisted.artifacts.dropLast().allSatisfy { $0.sha256?.count == 64 })
        var invalidReplacement = planned
        invalidReplacement.qaReport.score = .nan
        XCTAssertThrowsError(try store.write(
            plannedRun: invalidReplacement,
            summary: summary,
            projectURL: root
        ))
        XCTAssertEqual(
            try store.loadLatest(projectURL: root, projectId: projectId),
            persisted,
            "a failed replacement must preserve the prior generation"
        )
        let quarantine = try XCTUnwrap(store.quarantineLatest(projectURL: root))
        XCTAssertNil(try store.loadLatest(projectURL: root, projectId: projectId))
        try store.restoreQuarantined(quarantine, projectURL: root)
        XCTAssertEqual(
            try store.loadLatest(projectURL: root, projectId: projectId),
            persisted,
            "a failed Save As must restore the destination generation"
        )
        for reference in AgentArtifactStore.references {
            XCTAssertTrue(FileManager.default.fileExists(atPath: root.appendingPathComponent(reference.path).path))
        }
        XCTAssertThrowsError(try store.loadLatest(projectURL: root, projectId: UUID()))
        try Data("{}".utf8).write(
            to: root.appendingPathComponent("analysis/\(ProjectFile.cutPlanV1JSON)"),
            options: .atomic
        )
        XCTAssertThrowsError(try store.loadLatest(projectURL: root, projectId: projectId))
    }

    func testArtifactStoreRejectsSymlinkedAnalysisDirectory() throws {
        let temporaryDirectory = URL(
            fileURLWithPath: "/private\(FileManager.default.temporaryDirectory.path)",
            isDirectory: true
        )
        let root = temporaryDirectory
            .appendingPathComponent("gg-agent-symlink-\(UUID().uuidString)", isDirectory: true)
        let outside = temporaryDirectory
            .appendingPathComponent("gg-agent-outside-\(UUID().uuidString)", isDirectory: true)
        defer {
            try? FileManager.default.removeItem(at: root)
            try? FileManager.default.removeItem(at: outside)
        }
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: outside, withIntermediateDirectories: true)
        try FileManager.default.createSymbolicLink(
            at: root.appendingPathComponent(ProjectFile.analysisDirectory),
            withDestinationURL: outside
        )

        let planned = try ImportedTranscriptAgentPlanner.plan(
            data: Data(#"{"segments":[{"text":"hook action payoff takeaway","startSeconds":0,"endSeconds":1}]}"#.utf8),
            sourceDuration: 2,
            sourceFps: AgentFrameRate(numerator: 30)
        )
        let summary = AgentRunSummaryArtifact(
            jobId: "agent-test",
            projectId: UUID(),
            recordingFileName: ProjectFile.recordingMov,
            recordingRevision: "fixture-revision",
            status: .blocked,
            runtimeBudgetMinutes: 10,
            qaReport: planned.qaReport,
            artifacts: AgentArtifactStore.references,
            cutPlan: planned.cutPlan,
            baseTimeline: TimelineDocument(),
            requiresDestructiveConfirmation: false,
            createdAt: Date(),
            updatedAt: Date()
        )

        XCTAssertThrowsError(try AgentArtifactStore().write(
            plannedRun: planned,
            summary: summary,
            projectURL: root
        ))
    }
}
