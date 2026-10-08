@testable import Capture
import ScreenCaptureKit
import XCTest

final class CaptureStartupSessionTests: XCTestCase {
    @MainActor
    func testRetiredCallbacksCannotCompleteReplacementSelection() async throws {
        let session = CaptureStartupSession()
        defer { session.cancel() }
        let firstPresented = expectation(description: "first selection presented")
        var firstID: UUID?
        var dismissals = 0
        let first = Task {
            try await session.select { id in
                firstID = id
                firstPresented.fulfill()
                return { dismissals += 1 }
            }
        }
        await fulfillment(of: [firstPresented], timeout: 1)
        let oldID = try XCTUnwrap(firstID)
        session.cancel()
        do {
            _ = try await first.value
            XCTFail("Cancelled selection returned a filter")
        } catch CaptureError.pickerCancelled {}

        let nextPresented = expectation(description: "replacement selection presented")
        var nextID: UUID?
        let next = Task {
            try await session.select { id in
                nextID = id
                nextPresented.fulfill()
                return { dismissals += 1 }
            }
        }
        await fulfillment(of: [nextPresented], timeout: 1)
        let currentID = try XCTUnwrap(nextID)
        let selected = SCContentFilter()
        session.finish(.success(SCContentFilter()), requestID: oldID)
        session.finish(.failure(CaptureError.pickerCancelled), requestID: oldID)
        session.finish(.success(selected), requestID: currentID)
        let (completedID, filter) = try await next.value
        XCTAssertTrue(filter === selected)
        XCTAssertEqual(completedID, currentID)
        XCTAssertEqual(dismissals, 2)
        try session.check(currentID)
        session.complete(currentID)
    }

    @MainActor
    func testStopAfterSelectionPreventsResumedCaptureStartup() async throws {
        let session = CaptureStartupSession()
        defer { session.cancel() }
        let presented = expectation(description: "selection presented")
        var requestID: UUID?
        let selection = Task {
            let (id, _) = try await session.select { id in
                requestID = id
                presented.fulfill()
                return {}
            }
            defer { session.complete(id) }
            try session.check(id)
        }
        await fulfillment(of: [presented], timeout: 1)
        try session.finish(.success(SCContentFilter()), requestID: XCTUnwrap(requestID))
        session.beginStop()
        XCTAssertThrowsError(try session.begin()) { error in
            guard case CaptureError.pickerAlreadyActive = error else {
                XCTFail("Direct startup was not refused while cancelled selection owned cleanup")
                return
            }
        }
        do {
            _ = try await session.select { _ in
                XCTFail("A replacement selection took ownership before startup cleanup")
                return {}
            }
            XCTFail("Cancelled startup released its slot too early")
        } catch CaptureError.pickerAlreadyActive {}
        do {
            try await selection.value
            XCTFail("Stopped selection was allowed to start capture")
        } catch CaptureError.pickerCancelled {}
        // Stream teardown may still be suspended after startup has unwound.
        XCTAssertThrowsError(try session.begin())
        session.completeStop()
        let replacementID = try session.begin()
        try session.check(replacementID)
        session.complete(replacementID)
    }

    @MainActor
    func testTaskCancellationDismissesOnceAndAllowsRetry() async throws {
        let session = CaptureStartupSession()
        defer { session.cancel() }
        let presented = expectation(description: "selection presented")
        var dismissals = 0
        let selection = Task {
            try await session.select { _ in
                presented.fulfill()
                return { dismissals += 1 }
            }
        }
        await fulfillment(of: [presented], timeout: 1)
        selection.cancel()
        do {
            _ = try await selection.value
            XCTFail("Interrupted selection returned a filter")
        } catch is CancellationError {}
        XCTAssertEqual(dismissals, 1)
        // A synchronously completed replacement also owns its presentation cleanup.
        let (id, _) = try await session.select { id in
            session.finish(.success(SCContentFilter()), requestID: id)
            return { dismissals += 1 }
        }
        try session.check(id)
        session.complete(id)
        XCTAssertEqual(dismissals, 2)
    }
}
