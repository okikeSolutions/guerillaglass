import CoreGraphics
import Foundation
import Project

/// Resolution-independent background-stage geometry shared by preview and export rendering.
public struct BackgroundFramingGeometry: Equatable, Sendable {
    public let outputRect: CGRect
    public let cardRect: CGRect
    public let cornerRadius: CGFloat
    public let shadowOpacity: Float
    public let shadowRadius: CGFloat
    public let shadowOffset: CGSize

    public init?(
        renderSize: CGSize,
        orientedSourceSize: CGSize,
        settings: BackgroundFramingSettings
    ) {
        guard renderSize.isFiniteAndPositive, orientedSourceSize.isFiniteAndPositive else {
            return nil
        }

        let outputRect = CGRect(origin: .zero, size: renderSize)
        let shorterOutputDimension = min(renderSize.width, renderSize.height)
        let padding = settings.enabled ? CGFloat(settings.paddingFraction) * shorterOutputDimension : 0
        let availableRect = outputRect.insetBy(dx: padding, dy: padding)
        guard availableRect.width > 0, availableRect.height > 0 else { return nil }

        let scale = min(
            availableRect.width / orientedSourceSize.width,
            availableRect.height / orientedSourceSize.height
        )
        let cardSize = CGSize(
            width: orientedSourceSize.width * scale,
            height: orientedSourceSize.height * scale
        )
        let cardRect = CGRect(
            x: availableRect.midX - cardSize.width / 2,
            y: availableRect.midY - cardSize.height / 2,
            width: cardSize.width,
            height: cardSize.height
        )
        let shorterCardDimension = min(cardSize.width, cardSize.height)
        let shadowStrength = settings.enabled ? CGFloat(settings.shadowStrength) : 0

        self.outputRect = outputRect
        self.cardRect = cardRect
        cornerRadius = settings.enabled
            ? CGFloat(settings.cornerRadiusFraction) * shorterCardDimension
            : 0
        shadowOpacity = Float(0.30 * shadowStrength)
        shadowRadius = 0.035 * shorterOutputDimension * shadowStrength
        shadowOffset = CGSize(width: 0, height: 0.012 * shorterOutputDimension * shadowStrength)
    }
}

/// Explicit opaque sRGB color used by the deterministic background stage.
public struct BackgroundFramingColor: Equatable, Sendable {
    public let red: CGFloat
    public let green: CGFloat
    public let blue: CGFloat

    public init?(hex: String) {
        guard hex.count == 7, hex.first == "#", let value = UInt32(hex.dropFirst(), radix: 16) else {
            return nil
        }
        red = CGFloat((value >> 16) & 0xFF) / 255
        green = CGFloat((value >> 8) & 0xFF) / 255
        blue = CGFloat(value & 0xFF) / 255
    }

    public var cgColor: CGColor {
        let colorSpace = CGColorSpace(name: CGColorSpace.sRGB)!
        return CGColor(colorSpace: colorSpace, components: [red, green, blue, 1])!
    }
}

private extension CGSize {
    var isFiniteAndPositive: Bool {
        width.isFinite && height.isFinite && width > 0 && height > 0
    }
}
