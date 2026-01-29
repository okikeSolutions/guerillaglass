import CoreGraphics
import Foundation
import ScreenCaptureKit

public struct ShareableWindow: Identifiable, Hashable {
    public let id: CGWindowID
    public let title: String
    public let appName: String
    public let size: CGSize
    public let isOnScreen: Bool

    public init(window: SCWindow) {
        id = window.windowID
        let rawTitle = window.title?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        title = rawTitle
        appName = window.owningApplication?.applicationName ?? String(localized: "Unknown App")
        size = CGSize(width: window.frame.width, height: window.frame.height)
        isOnScreen = window.isOnScreen
    }

    init(id: CGWindowID, title: String, appName: String, size: CGSize, isOnScreen: Bool) {
        self.id = id
        self.title = title
        self.appName = appName
        self.size = size
        self.isOnScreen = isOnScreen
    }

    public var displayName: String {
        if title.isEmpty {
            return appName
        }
        return "\(appName) - \(title)"
    }

    public static func sorted(_ windows: [ShareableWindow]) -> [ShareableWindow] {
        windows.sorted { left, right in
            if left.appName != right.appName {
                return left.appName.localizedCaseInsensitiveCompare(right.appName) == .orderedAscending
            }
            if left.title != right.title {
                return left.title.localizedCaseInsensitiveCompare(right.title) == .orderedAscending
            }
            return left.id < right.id
        }
    }
}
