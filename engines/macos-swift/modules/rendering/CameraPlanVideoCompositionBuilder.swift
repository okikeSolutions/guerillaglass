import Automation
import AVFoundation
import CoreGraphics
import Project

enum CameraPlanVideoCompositionBuilder {
    static func makeComposition(
        asset: AVAsset,
        track: AVAssetTrack,
        renderSize: CGSize,
        frameRate: Double,
        plan: CameraPlan?,
        backgroundFraming: BackgroundFramingSettings = .defaults
    ) async throws -> AVVideoComposition? {
        guard renderSize.width > 0, renderSize.height > 0 else { return nil }

        let naturalSize = try await track.load(.naturalSize)
        let preferredTransform = try await track.load(.preferredTransform)
        let duration = try await asset.load(.duration)

        let requiresScaling = naturalSize.width != renderSize.width || naturalSize.height != renderSize.height
        let requiresTransform = !preferredTransform.isIdentity
        let hasPlan = !(plan?.keyframes.isEmpty ?? true)

        if !hasPlan, !requiresScaling, !requiresTransform, !backgroundFraming.enabled {
            return nil
        }

        let sourceBounds = VideoGeometryTransforms.orientedBounds(
            naturalSize: naturalSize,
            preferredTransform: preferredTransform
        )
        let compositionContentSize = plan?.outputAspectRatio.map {
            CGSize(width: $0, height: 1)
        } ?? sourceBounds.size
        guard let geometry = BackgroundFramingGeometry(
            renderSize: renderSize,
            orientedSourceSize: compositionContentSize,
            settings: backgroundFraming
        ) else { return nil }

        let layerInstruction = makeLayerInstruction(
            track: track,
            context: CameraTransformContext(
                naturalSize: naturalSize,
                preferredTransform: preferredTransform,
                cardRect: geometry.cardRect,
                plan: plan
            ),
            duration: duration
        )

        let instruction = AVMutableVideoCompositionInstruction()
        instruction.timeRange = CMTimeRange(start: .zero, duration: duration)
        instruction.layerInstructions = [layerInstruction]
        instruction.enablePostProcessing = backgroundFraming.enabled
        instruction.backgroundColor = BackgroundFramingColor(
            hex: backgroundFraming.enabled ? backgroundFraming.backgroundColor : "#000000"
        )?.cgColor

        let composition = AVMutableVideoComposition()
        composition.renderSize = renderSize
        let timescale = max(1, Int32(frameRate.rounded()))
        composition.frameDuration = CMTime(value: 1, timescale: timescale)
        if backgroundFraming.enabled {
            composition.colorPrimaries = AVVideoColorPrimaries_ITU_R_709_2
            composition.colorTransferFunction = AVVideoTransferFunction_ITU_R_709_2
            composition.colorYCbCrMatrix = AVVideoYCbCrMatrix_ITU_R_709_2
        }
        composition.instructions = [instruction]
        BackgroundFramingVideoComposition.apply(
            to: composition,
            geometry: geometry,
            settings: backgroundFraming
        )
        return composition
    }
}

private struct CameraTransformContext {
    let naturalSize: CGSize
    let preferredTransform: CGAffineTransform
    let cardRect: CGRect
    let plan: CameraPlan?
}

private func makeLayerInstruction(
    track: AVAssetTrack,
    context: CameraTransformContext,
    duration: CMTime
) -> AVMutableVideoCompositionLayerInstruction {
    let layerInstruction = AVMutableVideoCompositionLayerInstruction(assetTrack: track)
    guard let plan = context.plan, !plan.keyframes.isEmpty else {
        layerInstruction.setTransform(
            VideoGeometryTransforms.sourceToCardTransform(
                naturalSize: context.naturalSize,
                preferredTransform: context.preferredTransform,
                cardRect: context.cardRect
            ),
            at: .zero
        )
        return layerInstruction
    }

    let keyframes = plan.keyframes.sorted(by: { $0.time < $1.time })
    let firstTransform = cameraTransform(
        context: context,
        keyframe: keyframes[0],
        plan: plan
    )
    layerInstruction.setTransform(firstTransform, at: .zero)

    var previous = keyframes[0]
    for keyframe in keyframes.dropFirst() {
        let startTime = clampTime(previous.time, duration: duration)
        let endTime = clampTime(keyframe.time, duration: duration)
        if endTime <= startTime {
            previous = keyframe
            continue
        }

        let startTransform = cameraTransform(context: context, keyframe: previous, plan: plan)
        let endTransform = cameraTransform(context: context, keyframe: keyframe, plan: plan)
        let timeRange = CMTimeRange(start: startTime, end: endTime)
        layerInstruction.setTransformRamp(
            fromStart: startTransform,
            toEnd: endTransform,
            timeRange: timeRange
        )
        previous = keyframe
    }

    return layerInstruction
}

private func cameraTransform(
    context: CameraTransformContext,
    keyframe: CameraKeyframe,
    plan: CameraPlan
) -> CGAffineTransform {
    guard let outputAspectRatio = plan.outputAspectRatio else {
        let baseTransform = VideoGeometryTransforms.sourceToCardTransform(
            naturalSize: context.naturalSize,
            preferredTransform: context.preferredTransform,
            cardRect: context.cardRect
        )
        return VideoGeometryTransforms.sourceTransform(
            baseTransform: baseTransform,
            keyframe: keyframe,
            sourceSize: context.naturalSize
        )
    }
    return VideoGeometryTransforms.sourceToCameraViewportTransform(
        naturalSize: context.naturalSize,
        preferredTransform: context.preferredTransform,
        cardRect: context.cardRect,
        keyframe: keyframe,
        outputAspectRatio: outputAspectRatio
    )
}

private func clampTime(_ time: TimeInterval, duration: CMTime) -> CMTime {
    let durationSeconds = max(0, duration.seconds)
    let clamped = min(max(0, time), durationSeconds)
    return CMTime(seconds: clamped, preferredTimescale: 600)
}
