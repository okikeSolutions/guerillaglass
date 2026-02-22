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

        let content = try await SCShareableContent.excludingDesktopWindows(true, onScreenWindowsOnly: true)

        let displays: [JSONValue] = content.displays.map { display in
            .object([
                "id": .number(Double(display.displayID)),
                "width": .number(Double(display.width)),
                "height": .number(Double(display.height))
            ])
        }

        let windows = filteredWindows(from: content.windows)
        let sorted = ShareableWindow.sorted(windows.map(ShareableWindow.init(window:)))
        let encodedWindows: [JSONValue] = sorted.map { window in
            .object([
                "id": .number(Double(window.id)),
                "title": .string(window.title),
                "appName": .string(window.appName),
                "width": .number(window.size.width),
                "height": .number(window.size.height),
                "isOnScreen": .bool(window.isOnScreen)
            ])
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
