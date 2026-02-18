import Capture
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
            guard window.isOnScreen else { return false }
            guard window.frame.width > 1, window.frame.height > 1 else { return false }
            guard let app = window.owningApplication else { return false }
            let bundleID = app.bundleIdentifier
            if bundleID == "com.apple.WindowServer" || bundleID == "com.apple.dock" {
                return false
            }
            return true
        }
    }
}
