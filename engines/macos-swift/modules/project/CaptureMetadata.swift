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
    public struct Window: Codable, Equatable {
        public var id: UInt32
        public var title: String
        public var appName: String

        public init(id: UInt32, title: String, appName: String) {
            self.id = id
            self.title = title
            self.appName = appName
        }
    }

    public enum Source: String, Codable {
        case display
        case window
    }

    public var source: Source
    public var window: Window?
    public var contentRect: CaptureRect
    public var pixelScale: Double

    public init(
        source: Source,
        window: Window? = nil,
        contentRect: CaptureRect,
        pixelScale: Double
    ) {
        self.source = source
        self.window = window
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
