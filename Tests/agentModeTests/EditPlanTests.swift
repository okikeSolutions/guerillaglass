@testable import Project
import XCTest

final class EditPlanTests: XCTestCase {
    private func plan(_ items: [TimelineItem]) throws -> EditPlan {
        let data = try JSONSerialization.data(withJSONObject: [
            "version": 1, "id": "storyboard-1", "baseRevision": String(repeating: "a", count: 64),
            "sourceRevision": String(repeating: "b", count: 64),
            "timeline": ["version": 2, "items": []]
        ])
        var result = try JSONDecoder().decode(EditPlan.self, from: data)
        result.timeline = TimelineDocument(items: items)
        return result
    }

    func testArbitrarySceneOrderAndRepeatedSourceAreValid() throws {
        let proposal = try plan([
            .clip(.init(id: "result", sourceStartSeconds: 6, sourceEndSeconds: 7)),
            .gap(.init(id: "pause", durationSeconds: 0.5)),
            .clip(.init(id: "setup", sourceStartSeconds: 0, sourceEndSeconds: 1)),
            .clip(.init(id: "repeat", sourceStartSeconds: 6, sourceEndSeconds: 7))
        ])
        XCTAssertNoThrow(try proposal.validate(sourceDuration: 8))
    }

    func testInvalidRangesAndDuplicateScenesAreRejected() throws {
        let clip = TimelineItem.clip(TimelineClip(id: "scene", sourceStartSeconds: 1, sourceEndSeconds: 2))
        for items: [TimelineItem] in [
            [], [clip, clip], [.gap(.init(id: "only-gap", durationSeconds: 1))],
            [.clip(.init(id: "negative", sourceStartSeconds: -1, sourceEndSeconds: 2))],
            [.clip(.init(id: "empty", sourceStartSeconds: 2, sourceEndSeconds: 2))],
            [.clip(.init(id: "beyond-source", sourceStartSeconds: 1, sourceEndSeconds: 9))],
            [clip, .gap(.init(id: "invalid-gap", durationSeconds: .nan))]
        ] {
            XCTAssertThrowsError(try plan(items).validate(sourceDuration: 8))
        }
    }
}
