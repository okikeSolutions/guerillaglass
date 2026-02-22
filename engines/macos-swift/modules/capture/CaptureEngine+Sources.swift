import AppKit
import CoreGraphics
import ScreenCaptureKit

extension CaptureEngine {
    struct PreferredWindowCandidate {
        let windowID: CGWindowID
        let area: Double
        let hasTitle: Bool

        init(windowID: CGWindowID, area: Double, hasTitle: Bool) {
            self.windowID = windowID
            self.area = area
            self.hasTitle = hasTitle
        }

        init(window: SCWindow) {
            windowID = window.windowID
            area = window.frame.width * window.frame.height
            hasTitle = !(window.title ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        }
    }

    struct ShareableWindowMetadata {
        let bundleIdentifier: String?
        let frame: CGRect
        let isOnScreen: Bool
    }

    static func shouldIncludeShareableWindow(_ metadata: ShareableWindowMetadata) -> Bool {
        ShareableWindowFilter.shouldInclude(
            bundleIdentifier: metadata.bundleIdentifier,
            frame: metadata.frame,
            isOnScreen: metadata.isOnScreen
        )
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

    func resolveFrontmostWindow() async throws -> SCWindow {
        let windows = try await Self.filteredWindows(from: shareableWindowsProvider())
        await cacheShareableWindows(windows)

        guard !windows.isEmpty else {
            throw CaptureError.windowNotFound
        }

        let frontmostProcessID = NSWorkspace.shared.frontmostApplication?.processIdentifier
        if let frontmostProcessID {
            if let frontmostWindowID = Self.frontmostWindowID(for: frontmostProcessID) {
                if let exactMatch = windows.first(where: { $0.windowID == frontmostWindowID }) {
                    return exactMatch
                }
            }

            let frontmostApplicationWindows = windows.filter {
                $0.owningApplication?.processID == frontmostProcessID
            }
            if let preferredFrontmostApplicationWindow = Self.preferredWindow(from: frontmostApplicationWindows) {
                return preferredFrontmostApplicationWindow
            }
        }

        if let preferredWindow = Self.preferredWindow(from: windows) {
            return preferredWindow
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

    private static func preferredWindow(from windows: [SCWindow]) -> SCWindow? {
        windows.max { left, right in
            arePreferredWindowsInIncreasingOrder(
                left: PreferredWindowCandidate(window: left),
                right: PreferredWindowCandidate(window: right)
            )
        }
    }

    static func arePreferredWindowsInIncreasingOrder(
        left: PreferredWindowCandidate,
        right: PreferredWindowCandidate
    ) -> Bool {
        if left.area != right.area {
            return left.area < right.area
        }

        if left.hasTitle != right.hasTitle {
            return !left.hasTitle && right.hasTitle
        }

        // This comparator is used with `max`; returning `left > right` here
        // keeps lower window IDs as the final tie-break winner, matching
        // the TypeScript selector (`candidate.id < best.id`).
        return left.windowID > right.windowID
    }

    private static func frontmostWindowID(for processID: pid_t) -> CGWindowID? {
        let options: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
        guard
            let rawWindowList = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]]
        else {
            return nil
        }

        for windowInfo in rawWindowList {
            guard let ownerPID = (windowInfo[kCGWindowOwnerPID as String] as? NSNumber)?.int32Value else {
                continue
            }
            guard ownerPID == processID else {
                continue
            }

            let layer = (windowInfo[kCGWindowLayer as String] as? NSNumber)?.intValue ?? 0
            if layer != 0 {
                continue
            }

            let alpha = (windowInfo[kCGWindowAlpha as String] as? NSNumber)?.doubleValue ?? 1
            if alpha <= 0 {
                continue
            }

            guard let windowNumber = windowInfo[kCGWindowNumber as String] as? NSNumber else {
                continue
            }
            return CGWindowID(windowNumber.uint32Value)
        }

        return nil
    }
}
