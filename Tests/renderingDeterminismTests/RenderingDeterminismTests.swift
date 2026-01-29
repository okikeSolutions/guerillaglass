@testable import Rendering
import XCTest

final class RenderingDeterminismTests: XCTestCase {
    func testRendererInitialization() {
        let preview = PreviewRenderer()
        let export = ExportRenderer()

        XCTAssertNotNil(preview)
        XCTAssertNotNil(export)
    }
}
