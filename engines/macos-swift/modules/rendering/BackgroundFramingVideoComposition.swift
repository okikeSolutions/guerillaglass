import AVFoundation
import Project
import QuartzCore

/// Clip/gap visibility used to suppress the source-card shadow during timeline gaps.
public struct BackgroundFramingVisibilitySegment: Equatable, Sendable {
    public let startSeconds: Double
    public let durationSeconds: Double
    public let isVisible: Bool

    public init(startSeconds: Double, durationSeconds: Double, isVisible: Bool) {
        self.startSeconds = startSeconds
        self.durationSeconds = durationSeconds
        self.isVisible = isVisible
    }
}

/// Applies the static background stage, rounded source-card mask, and shadow to a composition.
public enum BackgroundFramingVideoComposition {
    public static func apply(
        to composition: AVMutableVideoComposition,
        geometry: BackgroundFramingGeometry,
        settings: BackgroundFramingSettings,
        visibilitySegments: [BackgroundFramingVisibilitySegment] = []
    ) {
        guard settings.enabled, let stageColor = BackgroundFramingColor(hex: settings.backgroundColor) else {
            return
        }

        let parentLayer = CALayer()
        parentLayer.frame = geometry.outputRect
        parentLayer.backgroundColor = stageColor.cgColor

        let cardPath = CGPath(
            roundedRect: geometry.cardRect,
            cornerWidth: geometry.cornerRadius,
            cornerHeight: geometry.cornerRadius,
            transform: nil
        )

        let shadowLayer = CAShapeLayer()
        shadowLayer.frame = geometry.outputRect
        shadowLayer.path = cardPath
        shadowLayer.fillColor = CGColor(gray: 0, alpha: 1)
        shadowLayer.shadowPath = cardPath
        shadowLayer.shadowColor = CGColor(gray: 0, alpha: 1)
        shadowLayer.shadowOpacity = geometry.shadowOpacity
        shadowLayer.shadowRadius = geometry.shadowRadius
        shadowLayer.shadowOffset = CGSize(
            width: geometry.shadowOffset.width,
            height: -geometry.shadowOffset.height
        )
        applyVisibility(visibilitySegments, to: shadowLayer)

        let videoLayer = CALayer()
        videoLayer.frame = geometry.outputRect
        let maskLayer = CAShapeLayer()
        maskLayer.frame = geometry.outputRect
        maskLayer.path = cardPath
        maskLayer.fillColor = CGColor(gray: 1, alpha: 1)
        videoLayer.mask = maskLayer

        parentLayer.addSublayer(shadowLayer)
        parentLayer.addSublayer(videoLayer)
        // The Configuration initializer requires the macOS 26 SDK. Keep the deployment-compatible
        // initializer until the repository's minimum supported Xcode SDK provides that symbol.
        composition.animationTool = AVVideoCompositionCoreAnimationTool(
            postProcessingAsVideoLayer: videoLayer,
            in: parentLayer
        )
    }
}

private func applyVisibility(
    _ segments: [BackgroundFramingVisibilitySegment],
    to layer: CALayer
) {
    let validSegments = segments.filter {
        $0.startSeconds.isFinite && $0.durationSeconds.isFinite &&
            $0.startSeconds >= 0 && $0.durationSeconds > 0
    }
    guard let finalSegment = validSegments.last else { return }
    let duration = finalSegment.startSeconds + finalSegment.durationSeconds
    guard duration > 0 else { return }

    layer.opacity = validSegments.first?.isVisible == true ? 1 : 0
    let animation = CAKeyframeAnimation(keyPath: "opacity")
    animation.values = validSegments.map { $0.isVisible ? 1 : 0 } + [finalSegment.isVisible ? 1 : 0]
    animation.keyTimes = validSegments.map { NSNumber(value: $0.startSeconds / duration) } + [1]
    animation.calculationMode = .discrete
    animation.beginTime = AVCoreAnimationBeginTimeAtZero
    animation.duration = duration
    animation.isRemovedOnCompletion = false
    animation.fillMode = .both
    layer.add(animation, forKey: "background-framing-visibility")
}
