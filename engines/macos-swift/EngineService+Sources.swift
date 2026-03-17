import Capture
import CoreGraphics
import EngineProtocol
import Foundation
import ScreenCaptureKit

extension EngineService {
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

        var displays: [JSONValue] = []
        displays.reserveCapacity(content.displays.count)
        for display in content.displays {
            let refreshHz = await MainActor.run {
                CaptureSourceCapability.refreshRate(for: display.displayID)
            }
            displays.append(
                .object([
                    "id": .number(Double(display.displayID)),
                    "width": .number(Double(display.width)),
                    "height": .number(Double(display.height)),
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
            )
        }

        let windows = filteredWindows(from: content.windows)
        let windowsByID = Dictionary(uniqueKeysWithValues: windows.map { ($0.windowID, $0) })
        let sorted = ShareableWindow.sorted(windows.map(ShareableWindow.init(window:)))
        var encodedWindows: [JSONValue] = []
        encodedWindows.reserveCapacity(sorted.count)
        for window in sorted {
            let (refreshHz, pixelScale) = await MainActor.run {
                if let sourceWindow = windowsByID[CGWindowID(window.id)] {
                    return (
                        CaptureSourceCapability.refreshRate(forWindowFrame: sourceWindow.frame),
                        CaptureSourceCapability.pixelScale(forWindowFrame: sourceWindow.frame)
                    )
                }
                return (nil, nil)
            }
            encodedWindows.append(
                .object([
                    "id": .number(Double(window.id)),
                    "title": .string(window.title),
                    "appName": .string(window.appName),
                    "width": .number(window.size.width),
                    "height": .number(window.size.height),
                    "isOnScreen": .bool(window.isOnScreen),
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
            )
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
}
