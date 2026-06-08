import AppKit
import Capture
import CoreGraphics
import EngineProtocol
import Foundation
import ScreenCaptureKit

extension EngineService {
    struct DisplayCapability {
        let displayName: String
        let isPrimary: Bool
        let refreshHz: Double?
        let pixelScale: Double?
    }

    typealias WindowCapability = (refreshHz: Double?, pixelScale: Double?)

    func sourcesListResponse(id: String) async -> EngineResponse {
        do {
            let result = try await listSources()
            return .success(id: id, result: result)
        } catch {
            return .failure(id: id, code: "runtime_error", message: error.localizedDescription)
        }
    }

    func listSources() async throws -> JSONValue {
        // Avoid blocking SCShareableContent calls when Screen Recording permission has not been granted yet.
        guard CGPreflightScreenCaptureAccess() else {
            return .object([
                "displays": .array([]),
                "windows": .array([])
            ])
        }

        // Keep ScreenCaptureKit's desktop exclusion disabled here so Guerilla Glass applies a
        // single filtering policy via `filteredWindows(from:)` before capability enrichment.
        let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
        let windows = filteredWindows(from: content.windows)
        let (capabilityByDisplayID, capabilityByWindowID) = await sourceCapabilities(for: content, windows: windows)
        let displays = content.displays.map { display in
            encodeDisplay(display, capabilities: capabilityByDisplayID[display.displayID] ?? nil)
        }
        let sorted = ShareableWindow.sorted(windows.map(ShareableWindow.init(window:)))
        let encodedWindows = sorted.map { window in
            encodeWindow(window, capabilities: capabilityByWindowID[CGWindowID(window.id)] ?? nil)
        }

        return .object([
            "displays": .array(displays),
            "windows": .array(encodedWindows)
        ])
    }

    func filteredWindows(from windows: [SCWindow]) -> [SCWindow] {
        windows.filter { window in
            ShareableWindowFilter.shouldInclude(
                bundleIdentifier: window.owningApplication?.bundleIdentifier,
                frame: window.frame,
                isOnScreen: window.isOnScreen
            )
        }
    }

    private func sourceCapabilities(
        for content: SCShareableContent,
        windows: [SCWindow]
    ) async -> ([CGDirectDisplayID: DisplayCapability], [CGWindowID: WindowCapability]) {
        let displayIDs = content.displays.map(\.displayID)
        let windowFramesByID = Dictionary(uniqueKeysWithValues: windows.map { ($0.windowID, $0.frame) })
        return await MainActor.run {
            let capabilityByDisplayID = Dictionary(uniqueKeysWithValues: displayIDs.map { displayID in
                let screen = NSScreen.screens.first { screen in
                    guard
                        let screenNumber = screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber
                    else {
                        return false
                    }
                    return CGDirectDisplayID(screenNumber.uint32Value) == displayID
                }
                let displayName = screen?.localizedName ?? "Display \(displayID)"
                let isPrimary = displayID == CGMainDisplayID()
                return (
                    displayID,
                    DisplayCapability(
                        displayName: displayName,
                        isPrimary: isPrimary,
                        refreshHz: CaptureSourceCapability.refreshRate(for: displayID),
                        pixelScale: CaptureSourceCapability.pixelScale(for: displayID)
                    )
                )
            })
            let capabilityByWindowID = Dictionary(uniqueKeysWithValues: windowFramesByID.map { windowID, frame in
                (
                    windowID,
                    (
                        refreshHz: CaptureSourceCapability.refreshRate(forWindowFrame: frame),
                        pixelScale: CaptureSourceCapability.pixelScale(forWindowFrame: frame)
                    )
                )
            })
            return (capabilityByDisplayID, capabilityByWindowID)
        }
    }

    private func encodeDisplay(_ display: SCDisplay, capabilities: DisplayCapability?) -> JSONValue {
        let refreshHz = capabilities?.refreshHz
        let pixelScale = capabilities?.pixelScale ?? 1
        return .object([
            "id": .number(Double(display.displayID)),
            "displayName": .string(capabilities?.displayName ?? "Display \(display.displayID)"),
            "isPrimary": .bool(capabilities?.isPrimary ?? false),
            "width": .number(Double(display.width)),
            "height": .number(Double(display.height)),
            "pixelScale": .number(pixelScale),
            "refreshHz": refreshHz.map { .number($0) } ?? .null,
            "supportedCaptureFrameRates": .array(
                CaptureSourceCapability.supportedFrameRates(
                    refreshHz: refreshHz,
                    width: Double(display.width),
                    height: Double(display.height),
                    pixelScale: pixelScale
                ).map {
                    .number(Double($0))
                }
            )
        ])
    }

    private func encodeWindow(
        _ window: ShareableWindow,
        capabilities: WindowCapability?
    ) -> JSONValue {
        let refreshHz = capabilities?.refreshHz
        let pixelScale = capabilities?.pixelScale
        return .object([
            "id": .number(Double(window.id)),
            "title": .string(window.title),
            "appName": .string(window.appName),
            "width": .number(window.size.width),
            "height": .number(window.size.height),
            "isOnScreen": .bool(window.isOnScreen),
            "pixelScale": .number(pixelScale ?? 1),
            "refreshHz": refreshHz.map { .number($0) } ?? .null,
            "supportedCaptureFrameRates": .array(
                CaptureSourceCapability.supportedFrameRates(
                    refreshHz: refreshHz,
                    width: window.size.width,
                    height: window.size.height,
                    pixelScale: pixelScale
                ).map {
                    .number(Double($0))
                }
            )
        ])
    }
}
