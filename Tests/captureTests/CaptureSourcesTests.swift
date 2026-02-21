@testable import Capture
import CoreGraphics
import XCTest

final class CaptureSourcesTests: XCTestCase {
    func testRefreshShareableContentStoresErrorWhenFetchFails() async {
        let engine = CaptureEngine()
        engine.shareableWindowsProvider = {
            throw CaptureSourcesTestError.fetchFailed
        }

        await engine.refreshShareableContent()

        let lastError = await MainActor.run { engine.lastError }
        XCTAssertEqual(lastError, CaptureSourcesTestError.fetchFailed.localizedDescription)
    }

    func testRefreshShareableContentClearsCachedWindowsWhenNoWindowsAreAvailable() async {
        let engine = CaptureEngine()
        await MainActor.run {
            engine.setCachedWindows(
                [
                    ShareableWindow(
                        id: 7,
                        title: "Demo",
                        appName: "Preview",
                        size: CGSize(width: 400, height: 300),
                        isOnScreen: true
                    )
                ],
                mapped: [:]
            )
        }
        engine.shareableWindowsProvider = {
            []
        }

        await engine.refreshShareableContent()

        let availableWindows = await MainActor.run { engine.availableWindows }
        XCTAssertTrue(availableWindows.isEmpty)
    }

    func testResolveWindowThrowsWindowNotFoundWhenShareableWindowsAreEmpty() async {
        let engine = CaptureEngine()
        engine.shareableWindowsProvider = {
            []
        }

        do {
            _ = try await engine.resolveWindow(windowID: 42)
            XCTFail("Expected resolveWindow to throw when no windows are available.")
        } catch let error as CaptureError {
            guard case .windowNotFound = error else {
                XCTFail("Unexpected capture error: \(error)")
                return
            }
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }

    func testResolveWindowPropagatesFetchError() async {
        let engine = CaptureEngine()
        engine.shareableWindowsProvider = {
            throw CaptureSourcesTestError.fetchFailed
        }

        do {
            _ = try await engine.resolveWindow(windowID: 1)
            XCTFail("Expected resolveWindow to throw when provider fails.")
        } catch let error as CaptureSourcesTestError {
            XCTAssertEqual(error, .fetchFailed)
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }

    func testShouldIncludeShareableWindowFiltersExpectedWindows() {
        XCTAssertFalse(
            CaptureEngine.shouldIncludeShareableWindow(
                .init(bundleIdentifier: nil, frame: CGRect(x: 0, y: 0, width: 100, height: 100), isOnScreen: true)
            )
        )
        XCTAssertFalse(
            CaptureEngine.shouldIncludeShareableWindow(
                .init(
                    bundleIdentifier: "com.apple.WindowServer",
                    frame: CGRect(x: 0, y: 0, width: 100, height: 100),
                    isOnScreen: true
                )
            )
        )
        XCTAssertFalse(
            CaptureEngine.shouldIncludeShareableWindow(
                .init(
                    bundleIdentifier: "com.apple.dock",
                    frame: CGRect(x: 0, y: 0, width: 100, height: 100),
                    isOnScreen: true
                )
            )
        )
        XCTAssertFalse(
            CaptureEngine.shouldIncludeShareableWindow(
                .init(
                    bundleIdentifier: "com.example.app",
                    frame: CGRect(x: 0, y: 0, width: 1, height: 300),
                    isOnScreen: true
                )
            )
        )
        XCTAssertFalse(
            CaptureEngine.shouldIncludeShareableWindow(
                .init(
                    bundleIdentifier: "com.example.app",
                    frame: CGRect(x: 0, y: 0, width: 200, height: 200),
                    isOnScreen: false
                )
            )
        )
        XCTAssertTrue(
            CaptureEngine.shouldIncludeShareableWindow(
                .init(
                    bundleIdentifier: "com.example.app",
                    frame: CGRect(x: 0, y: 0, width: 200, height: 200),
                    isOnScreen: true
                )
            )
        )
    }
}

private enum CaptureSourcesTestError: Error, LocalizedError, Equatable {
    case fetchFailed

    var errorDescription: String? {
        switch self {
        case .fetchFailed:
            "shareable content fetch failed"
        }
    }
}
