import Automation
import Project
@testable import Rendering
import XCTest

final class RenderingDeterminismTests: XCTestCase {
    func testDefaultLandscapeGeometryMatchesVersionOneFormula() throws {
        let settings = try enabledSettings()
        let geometry = try XCTUnwrap(BackgroundFramingGeometry(
            renderSize: CGSize(width: 1920, height: 1080),
            orientedSourceSize: CGSize(width: 1920, height: 1080),
            settings: settings
        ))

        assertRect(geometry.outputRect, equals: CGRect(x: 0, y: 0, width: 1920, height: 1080))
        assertRect(geometry.cardRect, equals: CGRect(x: 115.2, y: 64.8, width: 1689.6, height: 950.4))
        XCTAssertEqual(geometry.cornerRadius, 23.76, accuracy: 0.0001)
        XCTAssertEqual(geometry.shadowOpacity, 0.105, accuracy: 0.0001)
        XCTAssertEqual(geometry.shadowRadius, 13.23, accuracy: 0.0001)
        XCTAssertEqual(geometry.shadowOffset.height, 4.536, accuracy: 0.0001)
    }

    func testVerticalOutputAspectFitsLandscapeSourceWithoutCropping() throws {
        let geometry = try XCTUnwrap(BackgroundFramingGeometry(
            renderSize: CGSize(width: 1080, height: 1920),
            orientedSourceSize: CGSize(width: 1920, height: 1080),
            settings: enabledSettings()
        ))

        assertRect(geometry.cardRect, equals: CGRect(x: 64.8, y: 692.7, width: 950.4, height: 534.6))
        XCTAssertEqual(geometry.cardRect.width / geometry.cardRect.height, 16 / 9, accuracy: 0.0001)
    }

    func testDisabledGeometryPreservesLegacyFullFrameFit() {
        let geometry = BackgroundFramingGeometry(
            renderSize: CGSize(width: 1920, height: 1080),
            orientedSourceSize: CGSize(width: 1920, height: 1080),
            settings: .defaults
        )

        XCTAssertEqual(geometry?.cardRect, CGRect(x: 0, y: 0, width: 1920, height: 1080))
        XCTAssertEqual(geometry?.cornerRadius, 0)
        XCTAssertEqual(geometry?.shadowOpacity, 0)
    }

    func testGeometryRejectsNonFiniteOrEmptyDimensions() throws {
        let settings = try enabledSettings()
        XCTAssertNil(BackgroundFramingGeometry(
            renderSize: CGSize(width: CGFloat.infinity, height: 1080),
            orientedSourceSize: CGSize(width: 1920, height: 1080),
            settings: settings
        ))
        XCTAssertNil(BackgroundFramingGeometry(
            renderSize: CGSize(width: 1920, height: 1080),
            orientedSourceSize: CGSize(width: 0, height: 1080),
            settings: settings
        ))
    }

    func testRotatedSourceBoundsAndCameraCompositionUseCanonicalOrder() {
        let preferredTransform = CGAffineTransform(rotationAngle: .pi / 2)
            .translatedBy(x: 0, y: -1080)
        let bounds = VideoGeometryTransforms.orientedBounds(
            naturalSize: CGSize(width: 1920, height: 1080),
            preferredTransform: preferredTransform
        )
        XCTAssertEqual(bounds.width, 1080, accuracy: 0.0001)
        XCTAssertEqual(bounds.height, 1920, accuracy: 0.0001)

        let portraitCard = CGRect(x: 100, y: 50, width: 600, height: 800)
        let rotatedBase = VideoGeometryTransforms.sourceToCardTransform(
            naturalSize: CGSize(width: 1920, height: 1080),
            preferredTransform: preferredTransform,
            cardRect: portraitCard
        )
        let rotatedOutputBounds = VideoGeometryTransforms.orientedBounds(
            naturalSize: CGSize(width: 1920, height: 1080),
            preferredTransform: rotatedBase
        )
        assertRect(
            rotatedOutputBounds,
            equals: CGRect(x: 175, y: 50, width: 450, height: 800)
        )

        let card = CGRect(x: 100, y: 50, width: 800, height: 600)
        let base = VideoGeometryTransforms.sourceToCardTransform(
            naturalSize: CGSize(width: 1920, height: 1080),
            preferredTransform: .identity,
            cardRect: card
        )
        let topLeft = CGPoint.zero.applying(base)
        let bottomRight = CGPoint(x: 1920, y: 1080).applying(base)
        XCTAssertEqual(topLeft.x, card.minX, accuracy: 0.0001)
        XCTAssertEqual(topLeft.y, card.minY + 75, accuracy: 0.0001)
        XCTAssertEqual(bottomRight.x, card.maxX, accuracy: 0.0001)
        XCTAssertEqual(bottomRight.y, card.maxY - 75, accuracy: 0.0001)

        let keyframe = CameraKeyframe(time: 0, center: CGPoint(x: 480, y: 540), zoom: 2)
        let combined = VideoGeometryTransforms.sourceTransform(
            baseTransform: base,
            keyframe: keyframe,
            sourceSize: CGSize(width: 1920, height: 1080)
        )

        XCTAssertEqual(combined, VideoGeometryTransforms.cameraTransform(
            for: keyframe,
            sourceSize: CGSize(width: 1920, height: 1080)
        ).concatenating(base))
    }

    func testPortraitCameraViewportCropsAndFillsPortraitCard() {
        let sourceSize = CGSize(width: 1920, height: 1080)
        let keyframe = CameraKeyframe(
            time: 0,
            center: CGPoint(x: 960, y: 540),
            zoom: 1
        )
        let viewport = VideoGeometryTransforms.cameraViewportRect(
            sourceSize: sourceSize,
            keyframe: keyframe,
            outputAspectRatio: 9 / 16
        )
        assertRect(
            viewport,
            equals: CGRect(x: 656.25, y: 0, width: 607.5, height: 1080)
        )

        let card = CGRect(x: 50, y: 100, width: 540, height: 960)
        let transform = VideoGeometryTransforms.sourceToCameraViewportTransform(
            naturalSize: sourceSize,
            preferredTransform: .identity,
            cardRect: card,
            keyframe: keyframe,
            outputAspectRatio: 9 / 16
        )
        let topLeft = viewport.origin.applying(transform)
        let bottomRight = CGPoint(x: viewport.maxX, y: viewport.maxY).applying(transform)
        XCTAssertEqual(topLeft.x, card.minX, accuracy: 0.0001)
        XCTAssertEqual(topLeft.y, card.minY, accuracy: 0.0001)
        XCTAssertEqual(bottomRight.x, card.maxX, accuracy: 0.0001)
        XCTAssertEqual(bottomRight.y, card.maxY, accuracy: 0.0001)
    }

    func testPortraitCameraViewportPreservesPreferredSourceOrientation() {
        let naturalSize = CGSize(width: 1920, height: 1080)
        let preferredTransform = CGAffineTransform(rotationAngle: .pi / 2)
            .translatedBy(x: 0, y: -1080)
        let card = CGRect(x: 50, y: 100, width: 540, height: 960)
        let transform = VideoGeometryTransforms.sourceToCameraViewportTransform(
            naturalSize: naturalSize,
            preferredTransform: preferredTransform,
            cardRect: card,
            keyframe: CameraKeyframe(
                time: 0,
                center: CGPoint(x: 540, y: 960),
                zoom: 1
            ),
            outputAspectRatio: 9 / 16
        )
        let outputBounds = VideoGeometryTransforms.orientedBounds(
            naturalSize: naturalSize,
            preferredTransform: transform
        )
        assertRect(outputBounds, equals: card)
    }

    func testBackgroundColorUsesExplicitSRGBComponents() throws {
        let color = try XCTUnwrap(BackgroundFramingColor(hex: "#1A2B3C"))
        XCTAssertEqual(color.red, 26 / 255, accuracy: 0.0001)
        XCTAssertEqual(color.green, 43 / 255, accuracy: 0.0001)
        XCTAssertEqual(color.blue, 60 / 255, accuracy: 0.0001)
        XCTAssertNil(BackgroundFramingColor(hex: "#123"))
    }

    private func enabledSettings() throws -> BackgroundFramingSettings {
        try BackgroundFramingSettings(
            version: 1,
            enabled: true,
            backgroundColor: "#18181B",
            paddingFraction: 0.06,
            cornerRadiusFraction: 0.025,
            shadowStrength: 0.35
        )
    }

    private func assertRect(
        _ actual: CGRect,
        equals expected: CGRect,
        accuracy: CGFloat = 0.0001,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        XCTAssertEqual(actual.minX, expected.minX, accuracy: accuracy, file: file, line: line)
        XCTAssertEqual(actual.minY, expected.minY, accuracy: accuracy, file: file, line: line)
        XCTAssertEqual(actual.width, expected.width, accuracy: accuracy, file: file, line: line)
        XCTAssertEqual(actual.height, expected.height, accuracy: accuracy, file: file, line: line)
    }
}
