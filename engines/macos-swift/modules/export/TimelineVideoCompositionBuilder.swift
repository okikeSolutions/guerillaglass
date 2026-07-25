import Automation
import AVFoundation
import CoreGraphics
import Project
import Rendering

public enum TimelineVideoCompositionBuilder {
    public static func makeComposition(
        timelineComposition: ExportTimelineComposition,
        renderSize: CGSize,
        frameRate: Double,
        plan: CameraPlan? = nil,
        backgroundFraming: BackgroundFramingSettings = .defaults
    ) -> AVVideoComposition? {
        guard renderSize.width > 0, renderSize.height > 0 else { return nil }
        guard let videoTrack = timelineComposition.videoTrack else { return nil }
        guard let sourceNaturalSize = timelineComposition.sourceNaturalSize else { return nil }

        let sourcePreferredTransform = timelineComposition.sourcePreferredTransform ?? .identity
        let sourceBounds = VideoGeometryTransforms.orientedBounds(
            naturalSize: sourceNaturalSize,
            preferredTransform: sourcePreferredTransform
        )
        let compositionContentSize = plan?.outputAspectRatio.map {
            CGSize(width: $0, height: 1)
        } ?? sourceBounds.size
        guard let geometry = BackgroundFramingGeometry(
            renderSize: renderSize,
            orientedSourceSize: compositionContentSize,
            settings: backgroundFraming
        ) else { return nil }
        let baseTransform = VideoGeometryTransforms.sourceToCardTransform(
            naturalSize: sourceNaturalSize,
            preferredTransform: sourcePreferredTransform,
            cardRect: geometry.cardRect
        )
        let sortedKeyframes = plan?.keyframes.sorted(by: { $0.time < $1.time }) ?? []
        let cameraContext = TimelineCameraTransformContext(
            baseTransform: baseTransform,
            naturalSize: sourceNaturalSize,
            preferredTransform: sourcePreferredTransform,
            cardRect: geometry.cardRect,
            outputAspectRatio: plan?.outputAspectRatio
        )

        let instructions = timelineComposition.items.compactMap { item -> AVMutableVideoCompositionInstruction? in
            let range = item.programRange
            guard range.duration > .zero else { return nil }
            let instruction = AVMutableVideoCompositionInstruction()
            instruction.timeRange = range
            instruction.enablePostProcessing = backgroundFraming.enabled
            instruction.backgroundColor = BackgroundFramingColor(
                hex: backgroundFraming.enabled ? backgroundFraming.backgroundColor : "#000000"
            )?.cgColor
            switch item {
            case let .clip(_, sourceRange, programRange):
                let layerInstruction = AVMutableVideoCompositionLayerInstruction(assetTrack: videoTrack)
                applyTimelineClipTransforms(
                    layerInstruction: layerInstruction,
                    cameraContext: cameraContext,
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
        if backgroundFraming.enabled {
            composition.colorPrimaries = AVVideoColorPrimaries_ITU_R_709_2
            composition.colorTransferFunction = AVVideoTransferFunction_ITU_R_709_2
            composition.colorYCbCrMatrix = AVVideoYCbCrMatrix_ITU_R_709_2
        }
        composition.instructions = instructions
        let visibilitySegments = timelineComposition.items.map { item in
            BackgroundFramingVisibilitySegment(
                startSeconds: item.programRange.start.seconds,
                durationSeconds: item.programRange.duration.seconds,
                isVisible: item.isClip
            )
        }
        BackgroundFramingVideoComposition.apply(
            to: composition,
            geometry: geometry,
            settings: backgroundFraming,
            visibilitySegments: visibilitySegments
        )
        return composition
    }
}

private struct TimelineCameraTransformContext {
    let baseTransform: CGAffineTransform
    let naturalSize: CGSize
    let preferredTransform: CGAffineTransform
    let cardRect: CGRect
    let outputAspectRatio: CGFloat?
}

private func applyTimelineClipTransforms(
    layerInstruction: AVMutableVideoCompositionLayerInstruction,
    cameraContext: TimelineCameraTransformContext,
    sourceRange: CMTimeRange,
    programRange: CMTimeRange,
    keyframes: [CameraKeyframe]
) {
    let baseTransform = cameraContext.baseTransform
    let naturalSize = cameraContext.naturalSize

    guard !keyframes.isEmpty else {
        layerInstruction.setTransform(baseTransform, at: programRange.start)
        return
    }

    let sourceStartSeconds = sourceRange.start.seconds
    let sourceEndSeconds = sourceRange.end.seconds
    let initialKeyframe = interpolatedKeyframe(
        at: sourceStartSeconds,
        keyframes: keyframes,
        sourceSize: naturalSize
    )
    layerInstruction.setTransform(
        timelineClipTransform(cameraContext: cameraContext, keyframe: initialKeyframe),
        at: programRange.start
    )

    var previous = initialKeyframe
    for keyframe in keyframes where keyframe.time > sourceStartSeconds && keyframe.time < sourceEndSeconds {
        let startTime = sourceSecondsToProgramTime(
            previous.time,
            sourceRange: sourceRange,
            programRange: programRange
        )
        let endTime = sourceSecondsToProgramTime(
            keyframe.time,
            sourceRange: sourceRange,
            programRange: programRange
        )
        if endTime > startTime {
            layerInstruction.setTransformRamp(
                fromStart: timelineClipTransform(
                    cameraContext: cameraContext,
                    keyframe: previous
                ),
                toEnd: timelineClipTransform(
                    cameraContext: cameraContext,
                    keyframe: keyframe
                ),
                timeRange: CMTimeRange(start: startTime, end: endTime)
            )
        }
        previous = keyframe
    }

    let finalKeyframe = interpolatedKeyframe(
        at: sourceEndSeconds,
        keyframes: keyframes,
        sourceSize: naturalSize
    )
    let finalStartTime = sourceSecondsToProgramTime(
        previous.time,
        sourceRange: sourceRange,
        programRange: programRange
    )
    if programRange.end > finalStartTime {
        layerInstruction.setTransformRamp(
            fromStart: timelineClipTransform(
                cameraContext: cameraContext,
                keyframe: previous
            ),
            toEnd: timelineClipTransform(
                cameraContext: cameraContext,
                keyframe: finalKeyframe
            ),
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
    cameraContext: TimelineCameraTransformContext,
    keyframe: CameraKeyframe
) -> CGAffineTransform {
    guard let outputAspectRatio = cameraContext.outputAspectRatio else {
        return VideoGeometryTransforms.sourceTransform(
            baseTransform: cameraContext.baseTransform,
            keyframe: keyframe,
            sourceSize: cameraContext.naturalSize
        )
    }
    return VideoGeometryTransforms.sourceToCameraViewportTransform(
        naturalSize: cameraContext.naturalSize,
        preferredTransform: cameraContext.preferredTransform,
        cardRect: cameraContext.cardRect,
        keyframe: keyframe,
        outputAspectRatio: outputAspectRatio
    )
}
