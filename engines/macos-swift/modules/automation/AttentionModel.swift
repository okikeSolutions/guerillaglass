import CoreGraphics
import Foundation
import InputTracking

public struct AttentionSample: Equatable {
    public let time: TimeInterval
    public let position: CGPoint
    public let intensity: Double
    public let isDwell: Bool
    public let isClick: Bool
}

public struct AttentionModel {
    public init() {}

    public func samples(from events: [InputEvent], constraints: ZoomConstraints) -> [AttentionSample] {
        let orderedEvents = stableSort(events)
        guard !orderedEvents.isEmpty else { return [] }

        var samples: [AttentionSample] = []
        samples.reserveCapacity(orderedEvents.count)

        var previousMove: InputEvent?
        var smoothedSpeed: Double = 0
        var dwellStart: TimeInterval?
        var isDwell = false

        for event in orderedEvents {
            let isClick = event.type == .mouseDown || event.type == .mouseUp
            if event.type == .cursorMoved {
                if let previous = previousMove {
                    let deltaTime = max(event.timestamp - previous.timestamp, 0.0001)
                    let distance = distanceBetween(previous.position.cgPoint, event.position.cgPoint)
                    let speed = distance / deltaTime
                    let alpha = Double(max(0, min(constraints.velocitySmoothingAlpha, 1.0)))
                    smoothedSpeed = alpha * speed + (1 - alpha) * smoothedSpeed
                }
                previousMove = event

                let threshold = Double(max(0.01, constraints.dwellSpeedThreshold))
                if smoothedSpeed < threshold {
                    dwellStart = dwellStart ?? event.timestamp
                    if let start = dwellStart, event.timestamp - start >= constraints.dwellDuration {
                        isDwell = true
                    }
                } else {
                    dwellStart = nil
                    isDwell = false
                }
            }

            let intensity = clampIntensity(
                isClick: isClick,
                isDwell: isDwell,
                constraints: constraints
            )

            samples.append(
                AttentionSample(
                    time: event.timestamp,
                    position: event.position.cgPoint,
                    intensity: intensity,
                    isDwell: isDwell,
                    isClick: isClick
                )
            )
        }

        return coalesceSamples(samples)
    }
}

private func coalesceSamples(_ samples: [AttentionSample]) -> [AttentionSample] {
    guard let first = samples.first else { return [] }
    var result: [AttentionSample] = []
    result.reserveCapacity(samples.count)

    var current = first
    for sample in samples.dropFirst() {
        if sample.time == current.time {
            current = mergeSamples(current, sample)
        } else {
            result.append(current)
            current = sample
        }
    }
    result.append(current)
    return result
}

private func mergeSamples(_ first: AttentionSample, _ second: AttentionSample) -> AttentionSample {
    let firstPriority = samplePriority(first)
    let secondPriority = samplePriority(second)
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

private func samplePriority(_ sample: AttentionSample) -> Int {
    if sample.isClick { return 2 }
    if sample.isDwell { return 1 }
    return 0
}

private func stableSort(_ events: [InputEvent]) -> [InputEvent] {
    events.enumerated().sorted { left, right in
        if left.element.timestamp == right.element.timestamp {
            return left.offset < right.offset
        }
        return left.element.timestamp < right.element.timestamp
    }.map(\.element)
}

private func distanceBetween(_ start: CGPoint, _ end: CGPoint) -> Double {
    let deltaX = Double(start.x - end.x)
    let deltaY = Double(start.y - end.y)
    return (deltaX * deltaX + deltaY * deltaY).squareRoot()
}

private func clampIntensity(isClick: Bool, isDwell: Bool, constraints: ZoomConstraints) -> Double {
    let intensity: Double = if isClick {
        constraints.clickIntensity
    } else if isDwell {
        constraints.dwellIntensity
    } else {
        constraints.motionIntensity
    }
    return min(max(intensity, 0), 1)
}
