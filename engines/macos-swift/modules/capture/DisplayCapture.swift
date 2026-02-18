import CoreGraphics
import Foundation
import ScreenCaptureKit

public struct DisplayCapture {
    public let displayID: CGDirectDisplayID

    public init(displayID: CGDirectDisplayID) {
        self.displayID = displayID
    }
}
