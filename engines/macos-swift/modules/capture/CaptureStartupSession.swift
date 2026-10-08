import Foundation
import ScreenCaptureKit

/// Owns capture startup and optional content selection until acquisition or cleanup completes.
@MainActor
final class CaptureStartupSession {
    private var requestID: UUID?
    private var cancelled = false
    private var pendingStops = 0
    private var continuation: CheckedContinuation<SCContentFilter, Error>?
    private var dismiss: (() -> Void)?
    private var deadlineTask: Task<Void, Never>?

    func begin() throws -> UUID {
        guard requestID == nil, pendingStops == 0 else { throw CaptureError.pickerAlreadyActive }
        try Task.checkCancellation()
        let id = UUID()
        requestID = id
        cancelled = false
        return id
    }

    func select(present: (UUID) -> (() -> Void)) async throws -> (UUID, SCContentFilter) {
        let id = try begin()
        do {
            let filter = try await withTaskCancellationHandler {
                try Task.checkCancellation()
                return try await withCheckedThrowingContinuation { continuation in
                    self.continuation = continuation
                    let dismiss = present(id)
                    guard self.continuation != nil else {
                        dismiss()
                        return
                    }
                    self.dismiss = dismiss
                    deadlineTask = Task { @MainActor in
                        do {
                            try await Task.sleep(for: .seconds(600))
                        } catch {
                            return
                        }
                        self.finish(.failure(CaptureError.pickerTimedOut), requestID: id)
                    }
                }
            } onCancel: {
                Task { @MainActor in
                    self.finish(.failure(CancellationError()), requestID: id)
                }
            }
            return (id, filter)
        } catch {
            complete(id)
            throw error
        }
    }

    func check(_ id: UUID) throws {
        try Task.checkCancellation()
        guard requestID == id, !cancelled else { throw CaptureError.pickerCancelled }
    }

    func complete(_ id: UUID) {
        guard requestID == id else { return }
        requestID = nil
    }

    func beginStop() {
        pendingStops += 1
        cancel()
    }

    func completeStop() {
        pendingStops -= 1
    }

    func cancel() {
        if let id = requestID {
            if continuation != nil {
                finish(.failure(CaptureError.pickerCancelled), requestID: id)
            } else {
                // Startup still owns shared stream/audio state until its cleanup completes.
                cancelled = true
            }
        }
    }

    func finish(_ result: Result<SCContentFilter, Error>, requestID id: UUID) {
        guard requestID == id, let continuation else { return }
        self.continuation = nil
        deadlineTask?.cancel()
        deadlineTask = nil
        dismiss?()
        dismiss = nil
        if case .failure = result {
            requestID = nil
        }
        continuation.resume(with: result)
    }
}
