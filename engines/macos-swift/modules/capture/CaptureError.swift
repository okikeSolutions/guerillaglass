import Foundation

/// Errors surfaced by the capture engine lifecycle and source selection flow.
public enum CaptureError: LocalizedError {
    case noDisplayAvailable
    case screenRecordingDenied
    case windowNotFound
    case pickerCancelled
    case pickerAlreadyActive
    case captureNotRunning
    case captureStartTimedOut
    case captureStartUnstable(frameRate: Int)
    case recordingStartCancelled
    case unsupportedCaptureFrameRate(requested: Int, supported: [Int], refreshHz: Double?)

    public var errorDescription: String? {
        switch self {
        case .noDisplayAvailable:
            return String(localized: "No displays are available for capture.")
        case .screenRecordingDenied:
            return String(localized: "Screen Recording permission is required to capture your display.")
        case .windowNotFound:
            return String(localized: "The selected window is no longer available for capture.")
        case .pickerCancelled:
            return String(localized: "Content selection was cancelled.")
        case .pickerAlreadyActive:
            return String(localized: "Content picker is already active.")
        case .captureNotRunning:
            return String(localized: "Start a capture before recording.")
        case .captureStartTimedOut:
            return String(localized: "Capture startup timed out before the first frame arrived.")
        case let .captureStartUnstable(frameRate):
            return "Capture did not stabilize quickly enough for \(frameRate) fps recording."
        case .recordingStartCancelled:
            return String(localized: "Recording start was cancelled before capture priming completed.")
        case let .unsupportedCaptureFrameRate(requested, supported, refreshHz):
            let supportedValues = supported.map(String.init).joined(separator: ", ")
            if let refreshHz {
                let formattedRefreshHz = String(
                    format: "%.2f",
                    locale: Locale(identifier: "en_US_POSIX"),
                    refreshHz
                )
                return """
                captureFps \(requested) is unsupported for the current source \
                (refresh rate: \(formattedRefreshHz) Hz). Supported values: \(supportedValues)
                """
            }
            return "captureFps \(requested) is unsupported for the current source. Supported values: \(supportedValues)"
        }
    }
}
