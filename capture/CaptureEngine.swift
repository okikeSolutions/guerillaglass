import AVFoundation
import CoreGraphics
import CoreImage
import Export
import Foundation
import ScreenCaptureKit

public final class CaptureEngine: NSObject, ObservableObject {
    @Published public private(set) var latestFrame: CGImage?
    @Published public private(set) var isRunning: Bool = false
    @Published public internal(set) var lastError: String?
    @Published public private(set) var availableWindows: [ShareableWindow] = []
    @Published public internal(set) var isRecording: Bool = false
    @Published public internal(set) var recordingURL: URL?
    @Published public internal(set) var recordingDuration: TimeInterval = 0

    private let ciContext = CIContext(options: nil)
    private let sampleQueue = DispatchQueue(label: "gg.capture.sample")
    let recordingQueue = DispatchQueue(label: "gg.capture.recording")
    private var stream: SCStream?
    private lazy var audioCapture = AudioCapture { [weak self] buffer, time in
        self?.handleAudioBuffer(buffer, time: time)
    }

    private var windowsByID: [CGWindowID: SCWindow] = [:]
    var recordingState = RecordingState()
    @MainActor private var pickerContinuation: CheckedContinuation<SCContentFilter, Error>?

    override public init() {
        super.init()
    }

    struct RecordingState {
        var isRecording: Bool = false
        var writer: AssetWriter?
        var outputURL: URL?
        var videoBaseTime: CMTime?
        var lastDurationUpdate: TimeInterval = 0
    }

    public func startDisplayCapture(enableMic: Bool = false) async throws {
        guard !isRunning else { return }

        try await ensureScreenCaptureAccess()
        if enableMic {
            try await audioCapture.start()
        }

        do {
            let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
            guard let display = content.displays.first else {
                throw CaptureError.noDisplayAvailable
            }

            let filter = SCContentFilter(display: display, excludingWindows: [])
            let configuration = SCStreamConfiguration()
            configuration.width = display.width
            configuration.height = display.height
            configuration.pixelFormat = kCVPixelFormatType_32BGRA
            configuration.minimumFrameInterval = CMTime(value: 1, timescale: 30)
            configuration.showsCursor = true

            let stream = SCStream(filter: filter, configuration: configuration, delegate: self)
            try stream.addStreamOutput(self, type: .screen, sampleHandlerQueue: sampleQueue)

            self.stream = stream
            try await stream.startCapture()
            await MainActor.run {
                self.isRunning = true
                self.lastError = nil
            }
        } catch {
            audioCapture.stop()
            throw error
        }
    }

    public func startWindowCapture(windowID: CGWindowID, enableMic: Bool = false) async throws {
        guard !isRunning else { return }

        try await ensureScreenCaptureAccess()
        if enableMic {
            try await audioCapture.start()
        }

        do {
            let window = try await resolveWindow(windowID: windowID)
            let filter = SCContentFilter(desktopIndependentWindow: window)
            let configuration = SCStreamConfiguration()

            let scale: CGFloat = if #available(macOS 14.0, *) {
                CGFloat(filter.pointPixelScale)
            } else {
                1
            }
            configuration.width = max(1, Int(round(window.frame.width * scale)))
            configuration.height = max(1, Int(round(window.frame.height * scale)))
            configuration.pixelFormat = kCVPixelFormatType_32BGRA
            configuration.minimumFrameInterval = CMTime(value: 1, timescale: 30)
            configuration.showsCursor = true
            configuration.scalesToFit = true

            let stream = SCStream(filter: filter, configuration: configuration, delegate: self)
            try stream.addStreamOutput(self, type: .screen, sampleHandlerQueue: sampleQueue)

            self.stream = stream
            try await stream.startCapture()
            await MainActor.run {
                self.isRunning = true
                self.lastError = nil
            }
        } catch {
            audioCapture.stop()
            throw error
        }
    }

    @available(macOS 14.0, *)
    public func startCaptureUsingPicker(
        style: SCShareableContentStyle,
        enableMic: Bool = false
    ) async throws {
        let filter = try await pickContent(style: style)
        try await startCapture(using: filter, enableMic: enableMic)
    }

    @MainActor
    public func stopCapture() async {
        guard let stream else { return }
        if isRecording {
            await stopRecording()
        }
        try? await stream.stopCapture()
        audioCapture.stop()
        isRunning = false
        latestFrame = nil
        self.stream = nil
    }

    @MainActor
    public func clearError() {
        lastError = nil
    }

    @MainActor
    public func setErrorMessage(_ message: String?) {
        lastError = message
    }

    private func ensureScreenCaptureAccess() async throws {
        if CGPreflightScreenCaptureAccess() {
            return
        }
        let granted = await MainActor.run {
            CGRequestScreenCaptureAccess()
        }
        if !granted {
            throw CaptureError.screenRecordingDenied
        }
    }

    private func startCapture(using filter: SCContentFilter, enableMic: Bool) async throws {
        guard !isRunning else { return }

        try await ensureScreenCaptureAccess()
        if enableMic {
            try await audioCapture.start()
        }

        do {
            let configuration = SCStreamConfiguration()
            configuration.pixelFormat = kCVPixelFormatType_32BGRA
            configuration.minimumFrameInterval = CMTime(value: 1, timescale: 30)
            configuration.showsCursor = true

            if #available(macOS 14.0, *) {
                let rect = filter.contentRect
                let scale = CGFloat(filter.pointPixelScale)
                if rect.width > 1, rect.height > 1 {
                    configuration.width = max(1, Int(round(rect.width * scale)))
                    configuration.height = max(1, Int(round(rect.height * scale)))
                }
                configuration.scalesToFit = filter.style == .window
            }

            let stream = SCStream(filter: filter, configuration: configuration, delegate: self)
            try stream.addStreamOutput(self, type: .screen, sampleHandlerQueue: sampleQueue)

            self.stream = stream
            try await stream.startCapture()
            await MainActor.run {
                self.isRunning = true
                self.lastError = nil
            }
        } catch {
            audioCapture.stop()
            throw error
        }
    }

    @available(macOS 14.0, *)
    @MainActor
    private func pickContent(style: SCShareableContentStyle) async throws -> SCContentFilter {
        if pickerContinuation != nil {
            throw CaptureError.pickerAlreadyActive
        }

        let picker = SCContentSharingPicker.shared
        var configuration = SCContentSharingPickerConfiguration()
        configuration.allowedPickerModes = style == .display ? .singleDisplay : .singleWindow
        configuration.excludedWindowIDs = []
        if let bundleID = Bundle.main.bundleIdentifier {
            configuration.excludedBundleIDs = [bundleID]
        } else {
            configuration.excludedBundleIDs = []
        }
        configuration.allowsChangingSelectedContent = true
        picker.defaultConfiguration = configuration
        picker.isActive = true
        picker.add(self)

        return try await withCheckedThrowingContinuation { continuation in
            pickerContinuation = continuation
            picker.present(using: style)
        }
    }

    @available(macOS 14.0, *)
    @MainActor
    private func finishPicker(
        _ result: Result<SCContentFilter, Error>,
        picker: SCContentSharingPicker
    ) {
        picker.remove(self)
        picker.isActive = false
        let continuation = pickerContinuation
        pickerContinuation = nil

        guard let continuation else {
            return
        }

        switch result {
        case let .success(filter):
            continuation.resume(returning: filter)
        case let .failure(error):
            continuation.resume(throwing: error)
        }
    }
}

extension CaptureEngine {
    public func refreshShareableContent() async {
        do {
            let content = try await SCShareableContent.excludingDesktopWindows(true, onScreenWindowsOnly: true)
            let windows = Self.filteredWindows(from: content.windows)
            await cacheShareableWindows(windows)
        } catch {
            await MainActor.run {
                self.lastError = error.localizedDescription
            }
        }
    }

    func resolveWindow(windowID: CGWindowID) async throws -> SCWindow {
        if let cached = await cachedWindow(for: windowID) {
            return cached
        }

        let content = try await SCShareableContent.excludingDesktopWindows(true, onScreenWindowsOnly: true)
        let windows = Self.filteredWindows(from: content.windows)
        await cacheShareableWindows(windows)
        if let match = windows.first(where: { $0.windowID == windowID }) {
            return match
        }
        throw CaptureError.windowNotFound
    }

    private func cachedWindow(for windowID: CGWindowID) async -> SCWindow? {
        await MainActor.run {
            windowsByID[windowID]
        }
    }

    private func cacheShareableWindows(_ windows: [SCWindow]) async {
        let shareable = ShareableWindow.sorted(windows.map(ShareableWindow.init(window:)))
        let mapped = Dictionary(uniqueKeysWithValues: windows.map { ($0.windowID, $0) })
        await MainActor.run {
            self.availableWindows = shareable
            self.windowsByID = mapped
        }
    }

    private static func filteredWindows(from windows: [SCWindow]) -> [SCWindow] {
        windows
            .filter { window in
                guard window.isOnScreen else { return false }
                guard window.frame.width > 1, window.frame.height > 1 else { return false }
                guard let app = window.owningApplication else { return false }
                let bundleID = app.bundleIdentifier
                if bundleID == "com.apple.WindowServer" || bundleID == "com.apple.dock" {
                    return false
                }
                return true
            }
    }
}

extension CaptureEngine: SCStreamOutput, SCStreamDelegate {
    public func stream(
        _: SCStream,
        didOutputSampleBuffer sampleBuffer: CMSampleBuffer,
        of outputType: SCStreamOutputType
    ) {
        guard outputType == .screen,
              let imageBuffer = sampleBuffer.imageBuffer else { return }

        appendVideoSample(sampleBuffer)

        let ciImage = CIImage(cvImageBuffer: imageBuffer)
        guard let cgImage = ciContext.createCGImage(ciImage, from: ciImage.extent) else { return }

        Task { @MainActor in
            self.latestFrame = cgImage
        }
    }

    public func stream(_: SCStream, didStopWithError error: Error) {
        audioCapture.stop()
        Task { @MainActor in
            self.isRunning = false
            self.lastError = error.localizedDescription
        }
    }
}

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
