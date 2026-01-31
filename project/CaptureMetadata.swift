import CoreGraphics
import Foundation

public struct CaptureRect: Codable, Equatable {
    public var originX: Double
    public var originY: Double
    public var width: Double
    public var height: Double

    public init(originX: Double, originY: Double, width: Double, height: Double) {
        self.originX = originX
        self.originY = originY
        self.width = width
        self.height = height
    }

    public init(rect: CGRect) {
        self.init(
            originX: rect.origin.x,
            originY: rect.origin.y,
            width: rect.size.width,
            height: rect.size.height
        )
    }

    public var cgRect: CGRect {
        CGRect(x: originX, y: originY, width: width, height: height)
    }

    private enum CodingKeys: String, CodingKey {
        case originX = "x"
        case originY = "y"
        case width
        case height
    }
}

public struct CaptureMetadata: Codable, Equatable {
    public enum Source: String, Codable {
        case display
        case window
    }

    public var source: Source
    public var contentRect: CaptureRect
    public var pixelScale: Double

    public init(source: Source, contentRect: CaptureRect, pixelScale: Double) {
        self.source = source
        self.contentRect = contentRect
        self.pixelScale = pixelScale
    }

    public var pixelSize: CGSize {
        CGSize(
            width: contentRect.width * pixelScale,
            height: contentRect.height * pixelScale
        )
    }
}
