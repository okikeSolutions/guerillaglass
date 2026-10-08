import AppKit
import Capture
import CoreGraphics
import EngineProtocol
import Foundation
import ScreenCaptureKit

extension EngineService {
    func sources_period_sourcesList(
        _: Operations.sources_period_sourcesList.Input
    ) async throws -> Operations.sources_period_sourcesList.Output {
        guard CGPreflightScreenCaptureAccess() else {
            return .forbidden(.init(body: .json(.init(
                code: .init(value1: .permission_denied),
                message: "Screen Recording permission is required to list capture sources."
            ))))
        }
        do {
            let content = try await SCShareableContent.excludingDesktopWindows(true, onScreenWindowsOnly: true)
            let displays = content.displays.map { display in
                let screen = NSScreen.screens.first {
                    ($0.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber)?.uint32Value == display.displayID
                }
                let scale = CaptureSourceCapability.pixelScale(for: display.displayID)
                let refreshHz = CaptureSourceCapability.refreshRate(for: display.displayID)
                return Components.Schemas.DisplaySource(
                    id: Int(display.displayID),
                    displayName: screen?.localizedName ?? String(display.displayID),
                    isPrimary: display.displayID == CGMainDisplayID(),
                    width: display.width,
                    height: display.height,
                    pixelScale: scale,
                    refreshHz: refreshHz,
                    supportedCaptureFrameRates: CaptureSourceCapability.supportedFrameRates(
                        refreshHz: refreshHz,
                        width: Double(display.width),
                        height: Double(display.height),
                        pixelScale: scale
                    ).map(Double.init)
                )
            }
            let windows = content.windows.filter {
                ShareableWindowFilter.shouldInclude(
                    bundleIdentifier: $0.owningApplication?.bundleIdentifier,
                    frame: $0.frame,
                    isOnScreen: $0.isOnScreen
                )
            }.map { window in
                let scale = CaptureSourceCapability.pixelScale(forWindowFrame: window.frame)
                let refreshHz = CaptureSourceCapability.refreshRate(forWindowFrame: window.frame)
                return Components.Schemas.WindowSource(
                    id: Int(window.windowID),
                    title: window.title?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "",
                    appName: window.owningApplication?.applicationName ?? "",
                    width: window.frame.width,
                    height: window.frame.height,
                    isOnScreen: window.isOnScreen,
                    pixelScale: scale,
                    refreshHz: refreshHz,
                    supportedCaptureFrameRates: CaptureSourceCapability.supportedFrameRates(
                        refreshHz: refreshHz,
                        width: window.frame.width,
                        height: window.frame.height,
                        pixelScale: scale
                    ).map(Double.init)
                )
            }.sorted { left, right in
                let appOrder = left.appName.localizedCaseInsensitiveCompare(right.appName)
                if appOrder != .orderedSame {
                    return appOrder == .orderedAscending
                }
                let titleOrder = left.title.localizedCaseInsensitiveCompare(right.title)
                if titleOrder != .orderedSame {
                    return titleOrder == .orderedAscending
                }
                return left.id < right.id
            }
            return .ok(.init(body: .json(.init(displays: displays, windows: windows))))
        } catch {
            return .internalServerError(.init(body: .json(.init(
                code: .init(value1: .runtime_error),
                message: error.localizedDescription
            ))))
        }
    }
}
