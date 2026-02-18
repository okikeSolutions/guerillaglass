import CoreGraphics
import Foundation

public struct CaptureDescriptor: Equatable {
    public enum Source: String {
        case display
        case window
    }

    public let source: Source
    public let contentRect: CGRect
    public let pixelScale: CGFloat

    public init(source: Source, contentRect: CGRect, pixelScale: CGFloat) {
        self.source = source
        self.contentRect = contentRect
        self.pixelScale = pixelScale
    }

    public var pixelSize: CGSize {
        CGSize(width: contentRect.width * pixelScale, height: contentRect.height * pixelScale)
    }
}
