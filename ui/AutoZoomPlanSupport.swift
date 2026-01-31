import Automation
import AVFoundation
import CoreGraphics
import InputTracking
import Project

struct CameraPlanCacheKey: Equatable {
    let eventsSignature: UInt64
    let settings: AutoZoomSettings
    let duration: TimeInterval
    let sourceSize: CGSize
}

struct CameraPlanCache {
    let key: CameraPlanCacheKey
    let plan: CameraPlan?
    let composition: AVVideoComposition?
}

enum AutoZoomPlanSupport {
    static func makeCacheKey(
        events: [InputEvent],
        settings: AutoZoomSettings,
        duration: TimeInterval,
        sourceSize: CGSize
    ) -> CameraPlanCacheKey {
        CameraPlanCacheKey(
            eventsSignature: eventsSignature(events),
            settings: settings.clamped(),
            duration: roundedTime(duration, scale: 1000),
            sourceSize: roundedSize(sourceSize, scale: 100)
        )
    }

    static func mapEventsToCaptureSpace(
        _ events: [InputEvent],
        metadata: CaptureMetadata,
        sourceSize: CGSize
    ) -> [InputEvent] {
        let rect = metadata.contentRect.cgRect
        let scale = CGFloat(max(0.01, metadata.pixelScale))
        guard rect.width > 0, rect.height > 0 else { return events }

        let pixelSize = metadata.pixelSize
        let scaleX = pixelSize.width > 0 ? sourceSize.width / pixelSize.width : 1
        let scaleY = pixelSize.height > 0 ? sourceSize.height / pixelSize.height : 1

        return events.map { event in
            let point = event.position.cgPoint
            let normalizedX = point.x - rect.minX
            let normalizedY = rect.maxY - point.y
            var mapped = CGPoint(
                x: normalizedX * scale * scaleX,
                y: normalizedY * scale * scaleY
            )
            mapped.x = min(max(mapped.x, 0), max(0, sourceSize.width))
            mapped.y = min(max(mapped.y, 0), max(0, sourceSize.height))
            return InputEvent(
                type: event.type,
                timestamp: event.timestamp,
                position: mapped,
                button: event.button
            )
        }
    }

    static func eventsSignature(_ events: [InputEvent]) -> UInt64 {
        var hash: UInt64 = 0xCBF2_9CE4_8422_2325
        for event in events {
            hash = fnvCombine(hash, eventTypeCode(event.type))
            hash = fnvCombine(hash, buttonCode(event.button))
            hash = fnvCombine(hash, event.timestamp.bitPattern)
            hash = fnvCombine(hash, event.position.xValue.bitPattern)
            hash = fnvCombine(hash, event.position.yValue.bitPattern)
        }
        return hash
    }
}

private func roundedTime(_ value: TimeInterval, scale: Double) -> TimeInterval {
    (value * scale).rounded() / scale
}

private func roundedSize(_ size: CGSize, scale: CGFloat) -> CGSize {
    CGSize(
        width: (size.width * scale).rounded() / scale,
        height: (size.height * scale).rounded() / scale
    )
}

private func fnvCombine(_ hash: UInt64, _ value: UInt64) -> UInt64 {
    let prime: UInt64 = 0x100_0000_01B3
    var result = hash ^ value
    result &*= prime
    return result
}

private func eventTypeCode(_ type: InputEventType) -> UInt64 {
    switch type {
    case .cursorMoved:
        1
    case .mouseDown:
        2
    case .mouseUp:
        3
    }
}

private func buttonCode(_ button: MouseButton?) -> UInt64 {
    switch button {
    case .left:
        1
    case .right:
        2
    case .other:
        3
    case .none:
        0
    }
}
