import AppKit
import Foundation
import IOKit.hidsystem

public enum InputMonitoringStatus: Equatable {
    case notDetermined
    case denied
    case authorized
}

public final class InputPermissionManager {
    public init() {}

    public func status() -> InputMonitoringStatus {
        switch IOHIDCheckAccess(kIOHIDRequestTypeListenEvent) {
        case kIOHIDAccessTypeGranted:
            .authorized
        case kIOHIDAccessTypeDenied:
            .denied
        case kIOHIDAccessTypeUnknown:
            .notDetermined
        default:
            .denied
        }
    }

    @discardableResult
    public func requestAccess() -> InputMonitoringStatus {
        _ = IOHIDRequestAccess(kIOHIDRequestTypeListenEvent)
        return status()
    }

    @discardableResult
    public func openInputMonitoringSettings() -> Bool {
        let urlString = "x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent"
        guard let url = URL(string: urlString) else {
            return false
        }
        return NSWorkspace.shared.open(url)
    }
}
