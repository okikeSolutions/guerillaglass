import Foundation
import ScreenCaptureKit

/// Each observer retains the completion for its own selection request.
@available(macOS 14.0, *)
final class CapturePickerObserver: NSObject, SCContentSharingPickerObserver {
    private let complete: @MainActor (Result<SCContentFilter, Error>) -> Void

    init(complete: @escaping @MainActor (Result<SCContentFilter, Error>) -> Void) {
        self.complete = complete
    }

    func contentSharingPicker(_: SCContentSharingPicker, didCancelFor _: SCStream?) {
        Task { @MainActor in complete(.failure(CaptureError.pickerCancelled)) }
    }

    func contentSharingPicker(_: SCContentSharingPicker, didUpdateWith filter: SCContentFilter, for _: SCStream?) {
        Task { @MainActor in complete(.success(filter)) }
    }

    func contentSharingPickerStartDidFailWithError(_ error: Error) {
        Task { @MainActor in complete(.failure(error)) }
    }
}
