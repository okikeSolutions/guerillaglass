import CoreGraphics
import ScreenCaptureKit

extension CaptureEngine {
    public func refreshShareableContent() async {
        do {
            let content = try await SCShareableContent.excludingDesktopWindows(true, onScreenWindowsOnly: true)
            let windows = Self.filteredWindows(from: content.windows)
            await cacheShareableWindows(windows)
        } catch {
            await MainActor.run {
                self.lastError = error.localizedDescription
            }
        }
    }

    func resolveWindow(windowID: CGWindowID) async throws -> SCWindow {
        if let cached = await cachedWindow(for: windowID) {
            return cached
        }

        let content = try await SCShareableContent.excludingDesktopWindows(true, onScreenWindowsOnly: true)
        let windows = Self.filteredWindows(from: content.windows)
        await cacheShareableWindows(windows)
        if let match = windows.first(where: { $0.windowID == windowID }) {
            return match
        }
        throw CaptureError.windowNotFound
    }

    private func cachedWindow(for windowID: CGWindowID) async -> SCWindow? {
        await MainActor.run {
            windowsByID[windowID]
        }
    }

    private func cacheShareableWindows(_ windows: [SCWindow]) async {
        let shareable = ShareableWindow.sorted(windows.map(ShareableWindow.init(window:)))
        let mapped = Dictionary(uniqueKeysWithValues: windows.map { ($0.windowID, $0) })
        await MainActor.run {
            self.setCachedWindows(shareable, mapped: mapped)
        }
    }

    private static func filteredWindows(from windows: [SCWindow]) -> [SCWindow] {
        windows
            .filter { window in
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
