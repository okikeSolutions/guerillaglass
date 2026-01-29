import CoreGraphics
import Foundation
import ScreenCaptureKit

public struct WindowCapture {
    public let windowID: CGWindowID

    public init(windowID: CGWindowID) {
        self.windowID = windowID
    }
}
