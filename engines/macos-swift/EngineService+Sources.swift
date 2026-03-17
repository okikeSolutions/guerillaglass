import Capture
import CoreGraphics
import EngineProtocol
import Foundation
import ScreenCaptureKit

extension EngineService {
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
        let (refreshHzByDisplayID, capabilityByWindowID) = await sourceCapabilities(for: content, windows: windows)
        let displays = content.displays.map { display in
            encodeDisplay(display, refreshHz: refreshHzByDisplayID[display.displayID] ?? nil)
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
    ) async -> ([CGDirectDisplayID: Double?], [CGWindowID: WindowCapability]) {
        let displayIDs = content.displays.map(\.displayID)
        let windowFramesByID = Dictionary(uniqueKeysWithValues: windows.map { ($0.windowID, $0.frame) })
        return await MainActor.run {
            let refreshHzByDisplayID = Dictionary(uniqueKeysWithValues: displayIDs.map { displayID in
                (displayID, CaptureSourceCapability.refreshRate(for: displayID))
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
            return (refreshHzByDisplayID, capabilityByWindowID)
        }
    }

    private func encodeDisplay(_ display: SCDisplay, refreshHz: Double?) -> JSONValue {
        .object([
            "id": .number(Double(display.displayID)),
            "width": .number(Double(display.width)),
            "height": .number(Double(display.height)),
            "pixelScale": .number(1),
            "refreshHz": refreshHz.map { .number($0) } ?? .null,
            "supportedCaptureFrameRates": .array(
                CaptureSourceCapability.supportedFrameRates(
                    refreshHz: refreshHz,
                    width: Double(display.width),
                    height: Double(display.height),
                    pixelScale: 1
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
