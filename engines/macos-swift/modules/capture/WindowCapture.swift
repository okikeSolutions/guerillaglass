import CoreGraphics
import Foundation
import ScreenCaptureKit

/// Window capture target identified by `CGWindowID`.
public struct WindowCapture {
    public let windowID: CGWindowID

    public init(windowID: CGWindowID) {
        self.windowID = windowID
    }
}
