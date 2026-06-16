import Automation
import AVFoundation
import CoreGraphics

public enum TimelineVideoCompositionBuilder {
    public static func makeComposition(
        timelineComposition: ExportTimelineComposition,
        renderSize: CGSize,
        frameRate: Double,
        plan: CameraPlan? = nil
    ) -> AVVideoComposition? {
        guard renderSize.width > 0, renderSize.height > 0 else { return nil }
        guard let videoTrack = timelineComposition.videoTrack else { return nil }
        guard let sourceNaturalSize = timelineComposition.sourceNaturalSize else { return nil }

        let sourcePreferredTransform = timelineComposition.sourcePreferredTransform ?? .identity
        let baseTransform = makeBaseTransform(
            preferredTransform: sourcePreferredTransform,
            naturalSize: sourceNaturalSize,
            renderSize: renderSize
        )
        let sortedKeyframes = plan?.keyframes.sorted(by: { $0.time < $1.time }) ?? []

        let instructions = timelineComposition.items.compactMap { item -> AVMutableVideoCompositionInstruction? in
            let range = item.programRange
            guard range.duration > .zero else { return nil }
            let instruction = AVMutableVideoCompositionInstruction()
            instruction.timeRange = range
            instruction.backgroundColor = CGColor(gray: 0, alpha: 1)
            switch item {
            case let .clip(_, sourceRange, programRange):
                let layerInstruction = AVMutableVideoCompositionLayerInstruction(assetTrack: videoTrack)
                applyTimelineClipTransforms(
                    layerInstruction: layerInstruction,
                    baseTransform: baseTransform,
                    sourceSize: sourceNaturalSize,
                    sourceRange: sourceRange,
                    programRange: programRange,
                    keyframes: sortedKeyframes
                )
                instruction.layerInstructions = [layerInstruction]
            case .gap:
                instruction.layerInstructions = []
            }
            return instruction
        }

        guard !instructions.isEmpty else { return nil }
        let composition = AVMutableVideoComposition()
        composition.renderSize = renderSize
        let timescale = max(1, Int32(frameRate.rounded()))
        composition.frameDuration = CMTime(value: 1, timescale: timescale)
        composition.instructions = instructions
        return composition
    }
}

private func applyTimelineClipTransforms(
    layerInstruction: AVMutableVideoCompositionLayerInstruction,
    baseTransform: CGAffineTransform,
    sourceSize: CGSize,
    sourceRange: CMTimeRange,
    programRange: CMTimeRange,
    keyframes: [CameraKeyframe]
) {
    guard !keyframes.isEmpty else {
        layerInstruction.setTransform(baseTransform, at: programRange.start)
        return
    }

    let sourceStartSeconds = sourceRange.start.seconds
    let sourceEndSeconds = sourceRange.end.seconds
    let initialKeyframe = interpolatedKeyframe(
        at: sourceStartSeconds,
        keyframes: keyframes,
        sourceSize: sourceSize
    )
    layerInstruction.setTransform(
        timelineClipTransform(baseTransform: baseTransform, keyframe: initialKeyframe, sourceSize: sourceSize),
        at: programRange.start
    )

    var previous = initialKeyframe
    for keyframe in keyframes where keyframe.time > sourceStartSeconds && keyframe.time < sourceEndSeconds {
        let rampStartSourceSeconds = previous.time
        let rampEndSourceSeconds = keyframe.time
        let startTime = sourceSecondsToProgramTime(
            rampStartSourceSeconds,
            sourceRange: sourceRange,
            programRange: programRange
        )
        let endTime = sourceSecondsToProgramTime(
            rampEndSourceSeconds,
            sourceRange: sourceRange,
            programRange: programRange
        )
        if endTime > startTime {
            let startTransform = timelineClipTransform(
                baseTransform: baseTransform,
                keyframe: previous,
                sourceSize: sourceSize
            )
            let endTransform = timelineClipTransform(
                baseTransform: baseTransform,
                keyframe: keyframe,
                sourceSize: sourceSize
            )
            layerInstruction.setTransformRamp(
                fromStart: startTransform,
                toEnd: endTransform,
                timeRange: CMTimeRange(start: startTime, end: endTime)
            )
        }
        previous = keyframe
    }

    let finalKeyframe = interpolatedKeyframe(
        at: sourceEndSeconds,
        keyframes: keyframes,
        sourceSize: sourceSize
    )
    let finalStartTime = sourceSecondsToProgramTime(
        previous.time,
        sourceRange: sourceRange,
        programRange: programRange
    )
    if programRange.end > finalStartTime {
        let startTransform = timelineClipTransform(
            baseTransform: baseTransform,
            keyframe: previous,
            sourceSize: sourceSize
        )
        let endTransform = timelineClipTransform(
            baseTransform: baseTransform,
            keyframe: finalKeyframe,
            sourceSize: sourceSize
        )
        layerInstruction.setTransformRamp(
            fromStart: startTransform,
            toEnd: endTransform,
            timeRange: CMTimeRange(start: finalStartTime, end: programRange.end)
        )
    }
}

private func sourceSecondsToProgramTime(
    _ sourceSeconds: Double,
    sourceRange: CMTimeRange,
    programRange: CMTimeRange
) -> CMTime {
    let offsetSeconds = max(0, min(sourceSeconds - sourceRange.start.seconds, sourceRange.duration.seconds))
    return programRange.start + CMTime(seconds: offsetSeconds, preferredTimescale: 600)
}

private func interpolatedKeyframe(
    at seconds: Double,
    keyframes: [CameraKeyframe],
    sourceSize: CGSize
) -> CameraKeyframe {
    guard let first = keyframes.first else {
        return CameraKeyframe(
            time: seconds,
            center: CGPoint(x: sourceSize.width / 2, y: sourceSize.height / 2),
            zoom: 1
        )
    }
    guard seconds > first.time else {
        return CameraKeyframe(time: seconds, center: first.center, zoom: first.zoom)
    }

    var previous = first
    for next in keyframes.dropFirst() {
        if seconds <= next.time {
            let span = max(next.time - previous.time, .ulpOfOne)
            let progress = CGFloat((seconds - previous.time) / span)
            return CameraKeyframe(
                time: seconds,
                center: CGPoint(
                    x: previous.center.x + (next.center.x - previous.center.x) * progress,
                    y: previous.center.y + (next.center.y - previous.center.y) * progress
                ),
                zoom: previous.zoom + (next.zoom - previous.zoom) * progress
            )
        }
        previous = next
    }

    return CameraKeyframe(time: seconds, center: previous.center, zoom: previous.zoom)
}

private func timelineClipTransform(
    baseTransform: CGAffineTransform,
    keyframe: CameraKeyframe,
    sourceSize: CGSize
) -> CGAffineTransform {
    cameraTransform(for: keyframe, sourceSize: sourceSize).concatenating(baseTransform)
}

private func cameraTransform(for keyframe: CameraKeyframe, sourceSize: CGSize) -> CGAffineTransform {
    let zoom = max(1, keyframe.zoom)
    let sourceCenter = CGPoint(x: sourceSize.width / 2, y: sourceSize.height / 2)
    var transform = CGAffineTransform(translationX: sourceCenter.x, y: sourceCenter.y)
    transform = transform.scaledBy(x: zoom, y: zoom)
    transform = transform.translatedBy(x: -keyframe.center.x, y: -keyframe.center.y)
    return transform
}

private func makeBaseTransform(
    preferredTransform: CGAffineTransform,
    naturalSize: CGSize,
    renderSize: CGSize
) -> CGAffineTransform {
    let orientedBounds = transformedBounds(size: naturalSize, transform: preferredTransform)
    guard orientedBounds.width > 0, orientedBounds.height > 0 else { return preferredTransform }

    let scale = min(renderSize.width / orientedBounds.width, renderSize.height / orientedBounds.height)
    let scaledSize = CGSize(width: orientedBounds.width * scale, height: orientedBounds.height * scale)
    let translateX = (renderSize.width - scaledSize.width) / 2
    let translateY = (renderSize.height - scaledSize.height) / 2

    var transform = preferredTransform
    transform = transform.translatedBy(x: -orientedBounds.minX, y: -orientedBounds.minY)
    transform = transform.scaledBy(x: scale, y: scale)
    transform = transform.translatedBy(x: translateX, y: translateY)
    return transform
}

private func transformedBounds(size: CGSize, transform: CGAffineTransform) -> CGRect {
    let points = [
        CGPoint(x: 0, y: 0),
        CGPoint(x: size.width, y: 0),
        CGPoint(x: 0, y: size.height),
        CGPoint(x: size.width, y: size.height)
    ].map { $0.applying(transform) }
    let minX = points.map(\.x).min() ?? 0
    let maxX = points.map(\.x).max() ?? 0
    let minY = points.map(\.y).min() ?? 0
    let maxY = points.map(\.y).max() ?? 0
    return CGRect(x: minX, y: minY, width: maxX - minX, height: maxY - minY)
}
