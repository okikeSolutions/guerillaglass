@testable import Capture
import XCTest

final class ShareableWindowTests: XCTestCase {
    func testDisplayNameUsesAppNameWhenTitleEmpty() {
        let window = ShareableWindow(
            id: 1,
            title: "",
            appName: "Notes",
            size: CGSize(width: 800, height: 600),
            isOnScreen: true
        )

        XCTAssertEqual(window.displayName, "Notes")
    }

    func testDisplayNameIncludesTitle() {
        let window = ShareableWindow(
            id: 2,
            title: "Document 1",
            appName: "TextEdit",
            size: CGSize(width: 800, height: 600),
            isOnScreen: true
        )

        XCTAssertEqual(window.displayName, "TextEdit - Document 1")
    }

    func testSortedOrdersByAppThenTitleThenId() {
        let first = ShareableWindow(
            id: 2,
            title: "B",
            appName: "Alpha",
            size: CGSize(width: 100, height: 100),
            isOnScreen: true
        )
        let second = ShareableWindow(
            id: 1,
            title: "A",
            appName: "Alpha",
            size: CGSize(width: 100, height: 100),
            isOnScreen: true
        )
        let third = ShareableWindow(
            id: 3,
            title: "",
            appName: "Beta",
            size: CGSize(width: 100, height: 100),
            isOnScreen: true
        )

        let sorted = ShareableWindow.sorted([first, third, second])

        XCTAssertEqual(sorted.map(\.id), [1, 2, 3])
    }
}
