@testable import Project
import XCTest

final class SceneCameraTests: XCTestCase {
    struct Vectors: Decodable {
        var camera: [SceneCameraKeyframe]
        var samples: [SceneCameraKeyframe]
    }

    func testSharedAffineInterpolationAndEndpointHolds() throws {
        let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        let vectors = try JSONDecoder().decode(Vectors.self, from: Data(contentsOf: root.appendingPathComponent("docs/fixtures/scene-camera.json")))
        for expected in vectors.samples {
            let actual = try XCTUnwrap(SceneCameraKeyframe.sample(vectors.camera, at: expected.timeSeconds))
            XCTAssertEqual(actual.centerX, expected.centerX, accuracy: 0.000001)
            XCTAssertEqual(actual.centerY, expected.centerY, accuracy: 0.000001)
            XCTAssertEqual(actual.zoom, expected.zoom, accuracy: 0.000001)
        }
    }

    func testCameraValidationRejectsUnsafeOrAmbiguousKeyframes() {
        let valid = SceneCameraKeyframe(timeSeconds: 1, centerX: 0.5, centerY: 0.5, zoom: 2)
        for camera in [[], [valid, valid], [.init(timeSeconds: 0, centerX: .nan, centerY: 0, zoom: 1)],
                       [.init(timeSeconds: 9, centerX: 0.5, centerY: 0.5, zoom: 2)],
                       [.init(timeSeconds: 0, centerX: 0.5, centerY: 0.5, zoom: 9)]]
        {
            XCTAssertThrowsError(try SceneCameraKeyframe.validate(camera, sourceDuration: 8))
        }
    }
}
