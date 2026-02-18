import CoreGraphics
import ScreenCaptureKit

extension CaptureEngine {
    func makeDescriptor(filter: SCContentFilter) -> CaptureDescriptor? {
        guard #available(macOS 14.0, *) else { return nil }
        let rect = filter.contentRect
        let scale = CGFloat(filter.pointPixelScale)
        let source: CaptureDescriptor.Source = filter.style == .window ? .window : .display
        return CaptureDescriptor(source: source, contentRect: rect, pixelScale: scale)
    }

    func makeDisplayDescriptor(display: SCDisplay) -> CaptureDescriptor {
        let bounds = CGDisplayBounds(display.displayID)
        let pixelWidth = CGFloat(CGDisplayPixelsWide(display.displayID))
        let scale = bounds.width > 0 ? max(1, pixelWidth / bounds.width) : 1
        return CaptureDescriptor(source: .display, contentRect: bounds, pixelScale: scale)
    }
}
