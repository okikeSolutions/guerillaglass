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
        guard let geometry = BackgroundFramingGeometry(
            renderSize: renderSize,
            orientedSourceSize: sourceBounds.size,
            settings: backgroundFraming
        ) else { return nil }
        let baseTransform = VideoGeometryTransforms.sourceToCardTransform(
            naturalSize: sourceNaturalSize,
            preferredTransform: sourcePreferredTransform,
            cardRect: geometry.cardRect
        )
        let sortedKeyframes = plan?.keyframes.sorted(by: { $0.time < $1.time }) ?? []

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
    VideoGeometryTransforms.sourceTransform(
        baseTransform: baseTransform,
        keyframe: keyframe,
        sourceSize: sourceSize
    )
}
