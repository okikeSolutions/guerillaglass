import CoreGraphics
import Foundation
import InputTracking

public struct CameraKeyframe: Equatable {
    public let time: TimeInterval
    public let center: CGPoint
    public let zoom: CGFloat

    public init(time: TimeInterval, center: CGPoint, zoom: CGFloat) {
        self.time = time
        self.center = center
        self.zoom = zoom
    }
}

public struct CameraPlan: Equatable {
    public let sourceSize: CGSize
    public let keyframes: [CameraKeyframe]
    public let duration: TimeInterval

    public init(sourceSize: CGSize, keyframes: [CameraKeyframe], duration: TimeInterval) {
        self.sourceSize = sourceSize
        self.keyframes = keyframes
        self.duration = duration
    }
}

public final class VirtualCameraPlanner {
    private let attentionModel: AttentionModel

    public init(attentionModel: AttentionModel = AttentionModel()) {
        self.attentionModel = attentionModel
    }

    public func plan(
        events: [InputEvent],
        sourceSize: CGSize,
        duration: TimeInterval,
        constraints: ZoomConstraints = ZoomConstraints()
    ) -> CameraPlan {
        let sanitizedDuration = max(duration, events.map(\.timestamp).max() ?? 0)
        let samples = attentionModel.samples(from: events, constraints: constraints)

        if samples.isEmpty {
            let center = CGPoint(x: sourceSize.width / 2, y: sourceSize.height / 2)
            let zoom = constraints.clampedZoom(constraints.idleZoom)
            let keyframes = makeIdleKeyframes(center: center, zoom: zoom, duration: sanitizedDuration)
            return CameraPlan(sourceSize: sourceSize, keyframes: keyframes, duration: sanitizedDuration)
        }

        let targets = makeAnchoredTargets(
            from: samples,
            sourceSize: sourceSize,
            duration: sanitizedDuration,
            constraints: constraints
        )
        let reducedTargets = reduceTargets(
            targets,
            minimumInterval: max(0, constraints.minimumKeyframeInterval)
        )

        let rawKeyframes = reducedTargets.map { target in
            makeKeyframe(for: target, sourceSize: sourceSize, constraints: constraints)
        }

        let constrainedKeyframes = applyPanConstraints(
            to: rawKeyframes,
            sourceSize: sourceSize,
            constraints: constraints
        )

        return CameraPlan(sourceSize: sourceSize, keyframes: constrainedKeyframes, duration: sanitizedDuration)
    }
}

private struct FocusTarget {
    let time: TimeInterval
    let position: CGPoint
    let intensity: Double
    let isClick: Bool
    let isDwell: Bool
    let isAnchor: Bool

    func withAnchor() -> FocusTarget {
        FocusTarget(
            time: time,
            position: position,
            intensity: intensity,
            isClick: isClick,
            isDwell: isDwell,
            isAnchor: true
        )
    }
}

private func makeAnchoredTargets(
    from samples: [AttentionSample],
    sourceSize: CGSize,
    duration: TimeInterval,
    constraints: ZoomConstraints
) -> [FocusTarget] {
    var targets = samples.map { sample in
        FocusTarget(
            time: sample.time,
            position: sample.position,
            intensity: sample.intensity,
            isClick: sample.isClick,
            isDwell: sample.isDwell,
            isAnchor: false
        )
    }

    guard !targets.isEmpty else { return [] }

    let midpoint = CGPoint(x: sourceSize.width / 2, y: sourceSize.height / 2)
    let minimumInterval = max(0, constraints.minimumKeyframeInterval)

    if let first = targets.first {
        if first.time == 0 {
            targets[0] = first.withAnchor()
        } else {
            let useFirst = first.time <= minimumInterval
            let anchor = FocusTarget(
                time: 0,
                position: useFirst ? first.position : midpoint,
                intensity: useFirst ? first.intensity : 0,
                isClick: useFirst ? first.isClick : false,
                isDwell: useFirst ? first.isDwell : false,
                isAnchor: true
            )
            targets.insert(anchor, at: 0)
        }
    }

    if let last = targets.last {
        if last.time == duration {
            targets[targets.count - 1] = last.withAnchor()
        } else {
            let useLast = duration - last.time <= minimumInterval
            let anchor = FocusTarget(
                time: duration,
                position: last.position,
                intensity: last.intensity,
                isClick: useLast ? last.isClick : false,
                isDwell: useLast ? last.isDwell : false,
                isAnchor: true
            )
            targets.append(anchor)
        }
    }

    return targets
}

private func makeIdleKeyframes(center: CGPoint, zoom: CGFloat, duration: TimeInterval) -> [CameraKeyframe] {
    let start = CameraKeyframe(time: 0, center: center, zoom: zoom)
    guard duration > 0 else { return [start] }
    let end = CameraKeyframe(time: duration, center: center, zoom: zoom)
    return [start, end]
}

private func makeKeyframe(
    for target: FocusTarget,
    sourceSize: CGSize,
    constraints: ZoomConstraints
) -> CameraKeyframe {
    let baseZoom = max(1.0, constraints.baseZoom)
    let maxZoom = constraints.clampedZoom(constraints.maxZoom)
    let intensity = CGFloat(min(max(target.intensity, 0), 1))
    let zoom = constraints.clampedZoom(baseZoom + (maxZoom - baseZoom) * intensity)
    let clampedTarget = constraints.clampedTarget(target.position, in: sourceSize)
    let center = constraints.clampedCenter(for: clampedTarget, in: sourceSize, zoom: zoom)
    return CameraKeyframe(time: target.time, center: center, zoom: zoom)
}

private func applyPanConstraints(
    to keyframes: [CameraKeyframe],
    sourceSize: CGSize,
    constraints: ZoomConstraints
) -> [CameraKeyframe] {
    guard keyframes.count > 1 else { return keyframes }
    var adjusted: [CameraKeyframe] = []
    adjusted.reserveCapacity(keyframes.count)

    var previousVelocity = CGPoint.zero

    for frame in keyframes {
        guard let last = adjusted.last else {
            let center = constraints.clampedCenter(frame.center, in: sourceSize, zoom: frame.zoom)
            adjusted.append(CameraKeyframe(time: frame.time, center: center, zoom: frame.zoom))
            previousVelocity = .zero
            continue
        }

        let deltaTime = max(frame.time - last.time, 0.0001)
        let deltaTimeValue = CGFloat(deltaTime)
        var desiredCenter = frame.center
        var delta = desiredCenter - last.center
        let maxDistance = constraints.maxPanSpeed * deltaTimeValue
        if delta.magnitude > maxDistance {
            delta = delta.scaled(to: maxDistance)
            desiredCenter = last.center + delta
        }

        var velocity = delta / deltaTimeValue
        let velocityDelta = velocity - previousVelocity
        let maxVelocityDelta = constraints.maxPanAcceleration * deltaTimeValue
        if velocityDelta.magnitude > maxVelocityDelta {
            let limitedDelta = velocityDelta.scaled(to: maxVelocityDelta)
            velocity = previousVelocity + limitedDelta
            desiredCenter = last.center + velocity * deltaTimeValue
        }

        desiredCenter = constraints.clampedCenter(desiredCenter, in: sourceSize, zoom: frame.zoom)
        adjusted.append(CameraKeyframe(time: frame.time, center: desiredCenter, zoom: frame.zoom))
        previousVelocity = velocity
    }

    return adjusted
}

private func reduceTargets(_ targets: [FocusTarget], minimumInterval: TimeInterval) -> [FocusTarget] {
    guard minimumInterval > 0 else { return coalesceTargetsByTimestamp(targets) }
    guard let first = targets.first else { return [] }

    var reduced: [FocusTarget] = []
    reduced.reserveCapacity(targets.count)

    var bucketStart = first.time
    var bucketBest = first

    for target in targets.dropFirst() {
        if target.time - bucketStart < minimumInterval {
            bucketBest = pickBestTarget(bucketBest, target)
        } else {
            reduced.append(bucketBest)
            bucketStart = target.time
            bucketBest = target
        }
    }
    reduced.append(bucketBest)
    return coalesceTargetsByTimestamp(reduced)
}

private func coalesceTargetsByTimestamp(_ targets: [FocusTarget]) -> [FocusTarget] {
    guard let first = targets.first else { return [] }
    var result: [FocusTarget] = []
    result.reserveCapacity(targets.count)

    var current = first
    for target in targets.dropFirst() {
        if target.time == current.time {
            current = pickBestTarget(current, target)
        } else {
            result.append(current)
            current = target
        }
    }
    result.append(current)
    return result
}

private func pickBestTarget(_ first: FocusTarget, _ second: FocusTarget) -> FocusTarget {
    let firstPriority = targetPriority(first)
    let secondPriority = targetPriority(second)
    if secondPriority > firstPriority {
        return second
    }
    if secondPriority == firstPriority {
        if second.intensity > first.intensity {
            return second
        }
        if second.intensity == first.intensity {
            return second
        }
    }
    return first
}

private func targetPriority(_ target: FocusTarget) -> Int {
    if target.isAnchor { return 3 }
    if target.isClick { return 2 }
    if target.isDwell { return 1 }
    return 0
}

private extension CGPoint {
    static func - (lhs: CGPoint, rhs: CGPoint) -> CGPoint {
        CGPoint(x: lhs.x - rhs.x, y: lhs.y - rhs.y)
    }

    static func + (lhs: CGPoint, rhs: CGPoint) -> CGPoint {
        CGPoint(x: lhs.x + rhs.x, y: lhs.y + rhs.y)
    }

    static func / (lhs: CGPoint, rhs: CGFloat) -> CGPoint {
        CGPoint(x: lhs.x / rhs, y: lhs.y / rhs)
    }

    var magnitude: CGFloat {
        (x * x + y * y).squareRoot()
    }

    func scaled(to length: CGFloat) -> CGPoint {
        let current = magnitude
        guard current > 0 else { return .zero }
        return self * (length / current)
    }

    static func * (lhs: CGPoint, rhs: CGFloat) -> CGPoint {
        CGPoint(x: lhs.x * rhs, y: lhs.y * rhs)
    }
}
