import XCTest
@testable import Rendering

final class RenderingDeterminismTests: XCTestCase {
    func testRendererInitialization() {
        let preview = PreviewRenderer()
        let export = ExportRenderer()

        XCTAssertNotNil(preview)
        XCTAssertNotNil(export)
    }
}
