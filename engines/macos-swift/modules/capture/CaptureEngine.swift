import AVFoundation
import CoreGraphics
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
    @Published public private(set) var captureDescriptor: CaptureDescriptor?

    let ciContext = CIContext(options: nil)
    private let sampleQueue = DispatchQueue(label: "gg.capture.sample")
    let recordingQueue = DispatchQueue(label: "gg.capture.recording")
    private let telemetryQueue = DispatchQueue(label: "gg.capture.telemetry")
    private var stream: SCStream?
    lazy var audioCapture = AudioCapture { [weak self] buffer, time in
        self?.handleAudioBuffer(buffer, time: time)
    }

    var windowsByID: [CGWindowID: SCWindow] = [:]
    private var telemetryState = TelemetryState()
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

    public struct CaptureTelemetrySnapshot {
        public let totalFrames: Int
        public let droppedFrames: Int
        public let droppedFramePercent: Double
        public let audioLevelDbfs: Double?
    }

    private struct TelemetryState {
        var totalFrames: Int = 0
        var droppedFrames: Int = 0
        var audioLevelDbfs: Double?
        var lastCompleteFramePTSSeconds: Double?

        var droppedFramePercent: Double {
            guard totalFrames > 0 else { return 0 }
            return (Double(droppedFrames) / Double(totalFrames)) * 100
        }
    }

    public func startDisplayCapture(enableMic: Bool = false) async throws {
        guard !isRunning else { return }
        resetTelemetry()

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
                self.captureDescriptor = makeDisplayDescriptor(display: display)
            }
        } catch {
            audioCapture.stop()
            throw error
        }
    }

    public func startWindowCapture(windowID: CGWindowID, enableMic: Bool = false) async throws {
        guard !isRunning else { return }
        resetTelemetry()

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
                self.captureDescriptor = CaptureDescriptor(
                    source: .window,
                    windowTarget: CaptureDescriptor.WindowTarget(
                        id: window.windowID,
                        title: window.title ?? "",
                        appName: window.owningApplication?.applicationName ?? "Unknown App"
                    ),
                    contentRect: window.frame,
                    pixelScale: scale
                )
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
        captureDescriptor = nil
        resetTelemetry()
    }

    @MainActor
    public func clearError() {
        lastError = nil
    }

    @MainActor
    public func setErrorMessage(_ message: String?) {
        lastError = message
    }

    @MainActor
    func setLatestFrame(_ frame: CGImage?) {
        latestFrame = frame
    }

    @MainActor
    func setRunning(_ running: Bool) {
        isRunning = running
    }

    @MainActor
    func setCachedWindows(_ shareable: [ShareableWindow], mapped: [CGWindowID: SCWindow]) {
        availableWindows = shareable
        windowsByID = mapped
    }
}

extension CaptureEngine {
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

    public func telemetrySnapshot() -> CaptureTelemetrySnapshot {
        telemetryQueue.sync {
            CaptureTelemetrySnapshot(
                totalFrames: telemetryState.totalFrames,
                droppedFrames: telemetryState.droppedFrames,
                droppedFramePercent: telemetryState.droppedFramePercent,
                audioLevelDbfs: telemetryState.audioLevelDbfs
            )
        }
    }

    func resetTelemetry() {
        telemetryQueue.sync {
            telemetryState = TelemetryState()
        }
    }

    func recordVideoSample(status: SCFrameStatus?, sampleBuffer: CMSampleBuffer) {
        telemetryQueue.async { [weak self] in
            guard let self else { return }
            guard status == nil || status == .complete else { return }

            let pts = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
            let expectedFrameIntervalSeconds = 1.0 / 30.0

            if !pts.isNumeric {
                telemetryState.totalFrames += 1
                return
            }

            let ptsSeconds = pts.seconds
            if let previousPTS = telemetryState.lastCompleteFramePTSSeconds {
                let deltaSeconds = max(0, ptsSeconds - previousPTS)
                let missedFrames = CaptureTelemetryMath.estimateMissedFrames(
                    deltaSeconds: deltaSeconds,
                    expectedFrameIntervalSeconds: expectedFrameIntervalSeconds
                )
                if missedFrames > 0 {
                    telemetryState.droppedFrames += missedFrames
                    telemetryState.totalFrames += missedFrames + 1
                } else {
                    telemetryState.totalFrames += 1
                }
            } else {
                telemetryState.totalFrames += 1
            }
            telemetryState.lastCompleteFramePTSSeconds = ptsSeconds
        }
    }

    func recordAudioLevel(_ level: Double?) {
        guard let level else { return }
        telemetryQueue.async { [weak self] in
            guard let self else { return }
            let smoothingFactor = 0.18
            if let previous = telemetryState.audioLevelDbfs {
                telemetryState.audioLevelDbfs = previous + (level - previous) * smoothingFactor
            } else {
                telemetryState.audioLevelDbfs = level
            }
        }
    }

    func frameStatus(for sampleBuffer: CMSampleBuffer) -> SCFrameStatus? {
        guard let attachmentsArray = CMSampleBufferGetSampleAttachmentsArray(
            sampleBuffer,
            createIfNecessary: false
        ) as? [[SCStreamFrameInfo: Any]],
            let attachments = attachmentsArray.first,
            let rawStatus = attachments[.status] as? Int
        else {
            return nil
        }
        return SCFrameStatus(rawValue: rawStatus)
    }

    private func startCapture(using filter: SCContentFilter, enableMic: Bool) async throws {
        guard !isRunning else { return }
        resetTelemetry()

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
                self.captureDescriptor = makeDescriptor(filter: filter)
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
    func finishPicker(
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
