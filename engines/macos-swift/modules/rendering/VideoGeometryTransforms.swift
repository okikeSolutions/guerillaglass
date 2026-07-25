import Automation
import CoreGraphics

/// Canonical source-orientation, aspect-fit, and camera transforms shared by render paths.
public enum VideoGeometryTransforms {
    public static func orientedBounds(
        naturalSize: CGSize,
        preferredTransform: CGAffineTransform
    ) -> CGRect {
        let points = [
            CGPoint(x: 0, y: 0),
            CGPoint(x: naturalSize.width, y: 0),
            CGPoint(x: 0, y: naturalSize.height),
            CGPoint(x: naturalSize.width, y: naturalSize.height)
        ].map { $0.applying(preferredTransform) }
        let minX = points.map(\.x).min() ?? 0
        let maxX = points.map(\.x).max() ?? 0
        let minY = points.map(\.y).min() ?? 0
        let maxY = points.map(\.y).max() ?? 0
        return CGRect(x: minX, y: minY, width: maxX - minX, height: maxY - minY)
    }

    public static func sourceToCardTransform(
        naturalSize: CGSize,
        preferredTransform: CGAffineTransform,
        cardRect: CGRect
    ) -> CGAffineTransform {
        let bounds = orientedBounds(naturalSize: naturalSize, preferredTransform: preferredTransform)
        guard bounds.width > 0, bounds.height > 0 else { return preferredTransform }

        let scale = min(cardRect.width / bounds.width, cardRect.height / bounds.height)
        let scaledSize = CGSize(width: bounds.width * scale, height: bounds.height * scale)
        let destinationOrigin = CGPoint(
            x: cardRect.midX - scaledSize.width / 2,
            y: cardRect.midY - scaledSize.height / 2
        )

        var destinationTransform = CGAffineTransform(
            translationX: destinationOrigin.x,
            y: destinationOrigin.y
        )
        destinationTransform = destinationTransform.scaledBy(x: scale, y: scale)
        destinationTransform = destinationTransform.translatedBy(
            x: -bounds.minX,
            y: -bounds.minY
        )
        return preferredTransform.concatenating(destinationTransform)
    }

    public static func cameraTransform(
        for keyframe: CameraKeyframe,
        sourceSize: CGSize
    ) -> CGAffineTransform {
        let zoom = max(1, keyframe.zoom)
        let sourceCenter = CGPoint(x: sourceSize.width / 2, y: sourceSize.height / 2)
        var transform = CGAffineTransform(translationX: sourceCenter.x, y: sourceCenter.y)
        transform = transform.scaledBy(x: zoom, y: zoom)
        transform = transform.translatedBy(x: -keyframe.center.x, y: -keyframe.center.y)
        return transform
    }

    public static func sourceTransform(
        baseTransform: CGAffineTransform,
        keyframe: CameraKeyframe,
        sourceSize: CGSize
    ) -> CGAffineTransform {
        cameraTransform(for: keyframe, sourceSize: sourceSize).concatenating(baseTransform)
    }

    public static func sourceToCameraViewportTransform(
        naturalSize: CGSize,
        preferredTransform: CGAffineTransform,
        cardRect: CGRect,
        keyframe: CameraKeyframe,
        outputAspectRatio: CGFloat
    ) -> CGAffineTransform {
        let bounds = orientedBounds(naturalSize: naturalSize, preferredTransform: preferredTransform)
        guard bounds.width > 0,
              bounds.height > 0,
              cardRect.width > 0,
              cardRect.height > 0,
              outputAspectRatio.isFinite,
              outputAspectRatio > 0
        else {
            return sourceToCardTransform(
                naturalSize: naturalSize,
                preferredTransform: preferredTransform,
                cardRect: cardRect
            )
        }

        let viewport = cameraViewportRect(
            sourceSize: bounds.size,
            keyframe: keyframe,
            outputAspectRatio: outputAspectRatio
        )
        let scale = min(cardRect.width / viewport.width, cardRect.height / viewport.height)
        let scaledSize = CGSize(width: viewport.width * scale, height: viewport.height * scale)
        let destinationOrigin = CGPoint(
            x: cardRect.midX - scaledSize.width / 2,
            y: cardRect.midY - scaledSize.height / 2
        )

        var destinationTransform = CGAffineTransform(
            translationX: destinationOrigin.x,
            y: destinationOrigin.y
        )
        destinationTransform = destinationTransform.scaledBy(x: scale, y: scale)
        destinationTransform = destinationTransform.translatedBy(
            x: -bounds.minX - viewport.minX,
            y: -bounds.minY - viewport.minY
        )
        return preferredTransform.concatenating(destinationTransform)
    }

    public static func cameraViewportRect(
        sourceSize: CGSize,
        keyframe: CameraKeyframe,
        outputAspectRatio: CGFloat
    ) -> CGRect {
        let sourceAspectRatio = sourceSize.width / sourceSize.height
        let baseSize = if sourceAspectRatio > outputAspectRatio {
            CGSize(width: sourceSize.height * outputAspectRatio, height: sourceSize.height)
        } else {
            CGSize(width: sourceSize.width, height: sourceSize.width / outputAspectRatio)
        }

        let zoom = max(1, keyframe.zoom)
        let viewportSize = CGSize(width: baseSize.width / zoom, height: baseSize.height / zoom)
        let halfWidth = viewportSize.width / 2
        let halfHeight = viewportSize.height / 2
        let center = CGPoint(
            x: min(max(keyframe.center.x, halfWidth), sourceSize.width - halfWidth),
            y: min(max(keyframe.center.y, halfHeight), sourceSize.height - halfHeight)
        )
        return CGRect(
            x: center.x - halfWidth,
            y: center.y - halfHeight,
            width: viewportSize.width,
            height: viewportSize.height
        )
    }
}
