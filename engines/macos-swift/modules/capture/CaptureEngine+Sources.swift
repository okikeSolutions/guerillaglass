import CoreGraphics
import ScreenCaptureKit

extension CaptureEngine {
    struct ShareableWindowMetadata {
        let bundleIdentifier: String?
        let frame: CGRect
        let isOnScreen: Bool
    }

    static func shouldIncludeShareableWindow(_ metadata: ShareableWindowMetadata) -> Bool {
        guard metadata.isOnScreen else { return false }
        guard metadata.frame.width > 1, metadata.frame.height > 1 else { return false }
        guard let bundleID = metadata.bundleIdentifier else { return false }
        if bundleID == "com.apple.WindowServer" || bundleID == "com.apple.dock" {
            return false
        }
        return true
    }

    public func refreshShareableContent() async {
        do {
            let windows = try await Self.filteredWindows(from: shareableWindowsProvider())
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

        let windows = try await Self.filteredWindows(from: shareableWindowsProvider())
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
                shouldIncludeShareableWindow(
                    ShareableWindowMetadata(
                        bundleIdentifier: window.owningApplication?.bundleIdentifier,
                        frame: window.frame,
                        isOnScreen: window.isOnScreen
                    )
                )
            }
    }
}
