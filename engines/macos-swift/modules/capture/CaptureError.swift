import Foundation

public enum CaptureError: LocalizedError {
    case noDisplayAvailable
    case screenRecordingDenied
    case windowNotFound
    case pickerCancelled
    case pickerAlreadyActive
    case captureNotRunning

    public var errorDescription: String? {
        switch self {
        case .noDisplayAvailable:
            String(localized: "No displays are available for capture.")
        case .screenRecordingDenied:
            String(localized: "Screen Recording permission is required to capture your display.")
        case .windowNotFound:
            String(localized: "The selected window is no longer available for capture.")
        case .pickerCancelled:
            String(localized: "Content selection was cancelled.")
        case .pickerAlreadyActive:
            String(localized: "Content picker is already active.")
        case .captureNotRunning:
            String(localized: "Start a capture before recording.")
        }
    }
}
