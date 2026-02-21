import CoreGraphics
import Foundation

/// Immutable descriptor of the current capture source geometry and scale.
public struct CaptureDescriptor: Equatable {
    public struct WindowTarget: Equatable {
        public let id: CGWindowID
        public let title: String
        public let appName: String

        public init(id: CGWindowID, title: String, appName: String) {
            self.id = id
            self.title = title
            self.appName = appName
        }
    }

    public enum Source: String {
        case display
        case window
    }

    public let source: Source
    public let windowTarget: WindowTarget?
    public let contentRect: CGRect
    public let pixelScale: CGFloat

    public init(
        source: Source,
        windowTarget: WindowTarget? = nil,
        contentRect: CGRect,
        pixelScale: CGFloat
    ) {
        self.source = source
        self.windowTarget = windowTarget
        self.contentRect = contentRect
        self.pixelScale = pixelScale
    }

    public var pixelSize: CGSize {
        CGSize(width: contentRect.width * pixelScale, height: contentRect.height * pixelScale)
    }
}
