import CoreGraphics
import Foundation

/// Public value type exposed by the macOS engine module.
public struct ZoomConstraints: Equatable {
    public var maxZoom: CGFloat
    public var minVisibleAreaFraction: CGFloat
    public var safeMarginFraction: CGFloat
    public var dwellDuration: TimeInterval
    public var dwellSpeedThreshold: CGFloat
    public var velocitySmoothingAlpha: CGFloat
    public var maxPanSpeed: CGFloat
    public var maxPanAcceleration: CGFloat
    public var idleZoom: CGFloat
    public var baseZoom: CGFloat
    public var minimumKeyframeInterval: TimeInterval
    public var motionIntensity: Double
    public var dwellIntensity: Double
    public var clickIntensity: Double

    public init(
        maxZoom: CGFloat = 2.5,
        minVisibleAreaFraction: CGFloat = 0.4,
        safeMarginFraction: CGFloat = 0.1,
        dwellDuration: TimeInterval = 0.35,
        dwellSpeedThreshold: CGFloat = 40,
        velocitySmoothingAlpha: CGFloat = 0.2,
        maxPanSpeed: CGFloat = 1400,
        maxPanAcceleration: CGFloat = 3600,
        idleZoom: CGFloat = 1.05,
        baseZoom: CGFloat = 1.0,
        minimumKeyframeInterval: TimeInterval = 1.0 / 30.0,
        motionIntensity: Double = 0.25,
        dwellIntensity: Double = 0.7,
        clickIntensity: Double = 1.0
    ) {
        self.maxZoom = maxZoom
        self.minVisibleAreaFraction = minVisibleAreaFraction
        self.safeMarginFraction = safeMarginFraction
        self.dwellDuration = dwellDuration
        self.dwellSpeedThreshold = dwellSpeedThreshold
        self.velocitySmoothingAlpha = velocitySmoothingAlpha
        self.maxPanSpeed = maxPanSpeed
        self.maxPanAcceleration = maxPanAcceleration
        self.idleZoom = idleZoom
        self.baseZoom = baseZoom
        self.minimumKeyframeInterval = minimumKeyframeInterval
        self.motionIntensity = motionIntensity
        self.dwellIntensity = dwellIntensity
        self.clickIntensity = clickIntensity
    }

    public func clampedZoom(_ zoom: CGFloat) -> CGFloat {
        let minimumZoom: CGFloat = 1.0
        let minArea = max(0.01, min(minVisibleAreaFraction, 1.0))
        let maxByArea = 1.0 / minArea
        let allowedMaxZoom = min(maxZoom, maxByArea)
        return min(max(zoom, minimumZoom), allowedMaxZoom)
    }

    public func clampedTarget(_ point: CGPoint, in sourceSize: CGSize) -> CGPoint {
        guard sourceSize.width > 0, sourceSize.height > 0 else { return point }
        let margin = max(0, min(safeMarginFraction, 0.25))
        let insetX = sourceSize.width * margin
        let insetY = sourceSize.height * margin
        let minX = insetX
        let maxX = sourceSize.width - insetX
        let minY = insetY
        let maxY = sourceSize.height - insetY
        let clampedX = min(max(point.x, minX), maxX)
        let clampedY = min(max(point.y, minY), maxY)
        return CGPoint(x: clampedX, y: clampedY)
    }

    public func clampedCenter(_ center: CGPoint, in sourceSize: CGSize, zoom: CGFloat) -> CGPoint {
        guard sourceSize.width > 0, sourceSize.height > 0 else { return center }
        let zoomed = clampedZoom(zoom)
        let viewWidth = sourceSize.width / zoomed
        let viewHeight = sourceSize.height / zoomed
        let halfWidth = viewWidth / 2
        let halfHeight = viewHeight / 2
        let minX = halfWidth
        let maxX = sourceSize.width - halfWidth
        let minY = halfHeight
        let maxY = sourceSize.height - halfHeight
        let clampedX = min(max(center.x, minX), maxX)
        let clampedY = min(max(center.y, minY), maxY)
        return CGPoint(x: clampedX, y: clampedY)
    }

    public func clampedCenter(for target: CGPoint, in sourceSize: CGSize, zoom: CGFloat) -> CGPoint {
        guard sourceSize.width > 0, sourceSize.height > 0 else { return target }
        let zoomed = clampedZoom(zoom)
        let viewWidth = sourceSize.width / zoomed
        let viewHeight = sourceSize.height / zoomed
        let halfWidth = viewWidth / 2
        let halfHeight = viewHeight / 2

        let minCenterX = halfWidth
        let maxCenterX = sourceSize.width - halfWidth
        let minCenterY = halfHeight
        let maxCenterY = sourceSize.height - halfHeight

        let margin = max(0, min(safeMarginFraction, 0.25))
        let marginX = viewWidth * margin
        let marginY = viewHeight * margin
        let innerHalfWidth = max(0, halfWidth - marginX)
        let innerHalfHeight = max(0, halfHeight - marginY)

        let minAllowedX = max(minCenterX, target.x - innerHalfWidth)
        let maxAllowedX = min(maxCenterX, target.x + innerHalfWidth)
        let minAllowedY = max(minCenterY, target.y - innerHalfHeight)
        let maxAllowedY = min(maxCenterY, target.y + innerHalfHeight)

        guard minAllowedX <= maxAllowedX, minAllowedY <= maxAllowedY else {
            return clampedCenter(target, in: sourceSize, zoom: zoom)
        }

        let clampedX = min(max(target.x, minAllowedX), maxAllowedX)
        let clampedY = min(max(target.y, minAllowedY), maxAllowedY)
        return CGPoint(x: clampedX, y: clampedY)
    }
}
