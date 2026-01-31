import Automation
import AVFoundation
import CoreGraphics

enum CameraPlanVideoCompositionBuilder {
    static func makeComposition(
        asset: AVAsset,
        track: AVAssetTrack,
        renderSize: CGSize,
        frameRate: Double,
        plan: CameraPlan?
    ) async throws -> AVVideoComposition? {
        guard renderSize.width > 0, renderSize.height > 0 else { return nil }

        let naturalSize = try await track.load(.naturalSize)
        let preferredTransform = try await track.load(.preferredTransform)
        let duration = try await asset.load(.duration)

        let requiresScaling = naturalSize.width != renderSize.width || naturalSize.height != renderSize.height
        let requiresTransform = !preferredTransform.isIdentity
        let hasPlan = !(plan?.keyframes.isEmpty ?? true)

        if !hasPlan, !requiresScaling, !requiresTransform {
            return nil
        }

        let baseTransform = makeBaseTransform(
            preferredTransform: preferredTransform,
            naturalSize: naturalSize,
            renderSize: renderSize
        )

        let layerInstruction = makeLayerInstruction(
            track: track,
            baseTransform: baseTransform,
            plan: plan,
            sourceSize: naturalSize,
            duration: duration
        )

        let instruction = AVMutableVideoCompositionInstruction()
        instruction.timeRange = CMTimeRange(start: .zero, duration: duration)
        instruction.layerInstructions = [layerInstruction]

        let composition = AVMutableVideoComposition()
        composition.renderSize = renderSize
        let timescale = max(1, Int32(frameRate.rounded()))
        composition.frameDuration = CMTime(value: 1, timescale: timescale)
        composition.instructions = [instruction]
        return composition
    }
}

private func makeLayerInstruction(
    track: AVAssetTrack,
    baseTransform: CGAffineTransform,
    plan: CameraPlan?,
    sourceSize: CGSize,
    duration: CMTime
) -> AVMutableVideoCompositionLayerInstruction {
    let layerInstruction = AVMutableVideoCompositionLayerInstruction(assetTrack: track)
    guard let plan, !plan.keyframes.isEmpty else {
        layerInstruction.setTransform(baseTransform, at: .zero)
        return layerInstruction
    }

    let keyframes = plan.keyframes.sorted(by: { $0.time < $1.time })
    let firstTransform = baseTransform.concatenating(
        cameraTransform(for: keyframes[0], sourceSize: sourceSize)
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

        let startTransform = baseTransform.concatenating(
            cameraTransform(for: previous, sourceSize: sourceSize)
        )
        let endTransform = baseTransform.concatenating(
            cameraTransform(for: keyframe, sourceSize: sourceSize)
        )
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

private func makeBaseTransform(
    preferredTransform: CGAffineTransform,
    naturalSize: CGSize,
    renderSize: CGSize
) -> CGAffineTransform {
    let scale = min(renderSize.width / naturalSize.width, renderSize.height / naturalSize.height)
    let scaledSize = CGSize(width: naturalSize.width * scale, height: naturalSize.height * scale)
    let translateX = (renderSize.width - scaledSize.width) / 2
    let translateY = (renderSize.height - scaledSize.height) / 2

    var transform = preferredTransform
    transform = transform.scaledBy(x: scale, y: scale)
    transform = transform.translatedBy(x: translateX, y: translateY)
    return transform
}

private func cameraTransform(for keyframe: CameraKeyframe, sourceSize: CGSize) -> CGAffineTransform {
    let zoom = max(1, keyframe.zoom)
    let sourceCenter = CGPoint(x: sourceSize.width / 2, y: sourceSize.height / 2)
    var transform = CGAffineTransform(translationX: sourceCenter.x, y: sourceCenter.y)
    transform = transform.scaledBy(x: zoom, y: zoom)
    transform = transform.translatedBy(x: -keyframe.center.x, y: -keyframe.center.y)
    return transform
}

private func clampTime(_ time: TimeInterval, duration: CMTime) -> CMTime {
    let durationSeconds = max(0, duration.seconds)
    let clamped = min(max(0, time), durationSeconds)
    return CMTime(seconds: clamped, preferredTimescale: 600)
}
