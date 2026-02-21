import CoreGraphics
import Foundation
import ScreenCaptureKit

/// Display capture target identified by `CGDirectDisplayID`.
public struct DisplayCapture {
    public let displayID: CGDirectDisplayID

    public init(displayID: CGDirectDisplayID) {
        self.displayID = displayID
    }
}
