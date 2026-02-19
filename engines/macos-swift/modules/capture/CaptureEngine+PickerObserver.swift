import ScreenCaptureKit

@available(macOS 14.0, *)
extension CaptureEngine: SCContentSharingPickerObserver {
    public func contentSharingPicker(_: SCContentSharingPicker, didCancelFor _: SCStream?) {
        Task { @MainActor in
            self.finishPicker(.failure(CaptureError.pickerCancelled), picker: SCContentSharingPicker.shared)
        }
    }

    public func contentSharingPicker(
        _: SCContentSharingPicker,
        didUpdateWith filter: SCContentFilter,
        for _: SCStream?
    ) {
        Task { @MainActor in
            self.finishPicker(.success(filter), picker: SCContentSharingPicker.shared)
        }
    }

    public func contentSharingPickerStartDidFailWithError(_ error: Error) {
        Task { @MainActor in
            self.finishPicker(.failure(error), picker: SCContentSharingPicker.shared)
        }
    }
}
