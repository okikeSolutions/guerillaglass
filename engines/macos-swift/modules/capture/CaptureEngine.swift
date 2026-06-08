import AVFoundation
import CoreGraphics
import Export
import Foundation
import ScreenCaptureKit

/// Primary ScreenCaptureKit capture coordinator for display and window capture sessions.
public final class CaptureEngine: NSObject, ObservableObject {
    @Published public private(set) var isRunning: Bool = false
    @Published public private(set) var captureSessionID: String?
    @Published public internal(set) var lastError: String?
    @Published public private(set) var availableWindows: [ShareableWindow] = []
    @Published public internal(set) var isRecording: Bool = false
    @Published public internal(set) var recordingURL: URL?
    @Published public internal(set) var recordingDuration: TimeInterval = 0
    @Published public internal(set) var lastRecordingTelemetry: CaptureTelemetrySnapshot?
    @Published public private(set) var captureDescriptor: CaptureDescriptor?

    private let sampleQueue = DispatchQueue(label: "gg.capture.sample")
    private let sampleQueueKey = DispatchSpecificKey<Void>()
    let recordingQueue = DispatchQueue(label: "gg.capture.recording")
    let telemetryStore: CaptureTelemetryStore
    let livePreviewStore: CapturePreviewStore
    private var stream: SCStream?
    private var startCaptureTask: Task<Void, Never>?
    var recordingActivationTask: Task<Void, Never>?
    private let startupStateLock = NSLock()
    private var startupContinuation: CheckedContinuation<Void, Error>?
    private var startupResult: Result<Void, Error>?
    private var startupHandshakeNeedsSampleResolution = false
    private let latestCompleteVideoSampleLock = NSLock()
    private var latestCompleteVideoSample: CMSampleBuffer?
    private let recordingActivationStateLock = NSLock()
    private var recordingActivationContinuation: CheckedContinuation<Void, Error>?
    private var recordingActivationResult: Result<Void, Error>?
    private var hasResolvedStartupHandshake = false
    var hasLoggedFirstVideoSample = false
    private let streamQueueDepth = 3
    lazy var audioCapture = AudioCapture { [weak self] buffer, time in
        self?.handleAudioBuffer(buffer, time: time)
    }

    typealias ShareableWindowsProvider = @Sendable () async throws -> [SCWindow]

    var windowsByID: [CGWindowID: SCWindow] = [:]
    var shareableWindowsProvider: ShareableWindowsProvider = {
        let content = try await SCShareableContent.excludingDesktopWindows(
            true,
            onScreenWindowsOnly: true
        )
        return content.windows
    }

    var captureFrameRate: Int = CaptureFrameRatePolicy.defaultValue
    var recordingState = RecordingState()
    @MainActor private var pickerContinuation: CheckedContinuation<SCContentFilter, Error>?

    override public init() {
        let telemetryStore = CaptureTelemetryStore()
        self.telemetryStore = telemetryStore
        livePreviewStore = CapturePreviewStore { [weak telemetryStore] durationMs in
            telemetryStore?.recordPreviewEncodeDuration(durationMs)
        }
        super.init()
        sampleQueue.setSpecific(key: sampleQueueKey, value: ())
    }

    struct RecordingState {
        struct PrimingState {
            let startedAtUptimeNanoseconds: UInt64
            let timeoutNanoseconds: UInt64
            var bufferedFrames: [CMSampleBuffer] = []
            var lastPresentationTimestamp: CMTime?
            var consecutiveStableIntervals: Int = 0
        }

        enum Phase {
            case idle
            case priming(PrimingState)
            case recording
        }

        var phase: Phase = .idle
        var writer: AssetWriter?
        var outputURL: URL?
        var videoBaseTime: CMTime?
        var lastDurationUpdate: TimeInterval = 0
        var expectedFrameRate: Int = CaptureFrameRatePolicy.defaultValue

        var isActive: Bool {
            switch phase {
            case .idle:
                false
            case .priming, .recording:
                true
            }
        }

        var isRecordingActive: Bool {
            if case .recording = phase {
                return true
            }
            return false
        }
    }

    public struct CaptureTelemetrySnapshot {
        public let sourceDroppedFrames: Int
        public let writerDroppedFrames: Int
        public let writerBackpressureDrops: Int
        public let achievedFps: Double
        public let cpuPercent: Double?
        public let memoryBytes: UInt64?
        public let recordingBitrateMbps: Double?
        public let captureCallbackMs: Double
        public let recordQueueLagMs: Double
        public let writerAppendMs: Double
        public let previewEncodeMs: Double
    }

    @MainActor
    public func startDisplayCapture(
        displayID: CGDirectDisplayID? = nil,
        enableMic: Bool = false,
        targetFrameRate: Int = 30,
        enablePreview: Bool = true
    ) async throws {
        guard !isRunning else { return }
        resetTelemetry()
        setPreviewCachingEnabled(enablePreview)
        clearPreviewFrame()
        clearLatestCompleteVideoSample()
        hasLoggedFirstVideoSample = false
        let frameRate = CaptureFrameRatePolicy.sanitize(targetFrameRate)
        debugLog(
            "startDisplayCapture begin frameRate=\(frameRate) mic=\(enableMic) displayID=\(String(describing: displayID))"
        )

        try await ensureScreenCaptureAccess()
        if enableMic {
            try await audioCapture.start()
        }

        do {
            debugLog("startDisplayCapture fetching shareable content")
            let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
            debugLog("startDisplayCapture shareable content displays=\(content.displays.count)")
            let display: SCDisplay? = if let displayID {
                content.displays.first(where: { $0.displayID == displayID })
            } else {
                content.displays.first
            }
            guard let display else {
                throw CaptureError.noDisplayAvailable
            }

            let filter = SCContentFilter(display: display, excludingWindows: [])
            let configuration = SCStreamConfiguration()
            let (refreshHz, pixelScale) = await MainActor.run {
                (
                    CaptureSourceCapability.refreshRate(for: display.displayID),
                    CaptureSourceCapability.pixelScale(for: display.displayID) ?? 1
                )
            }
            debugLog("startDisplayCapture displayID=\(display.displayID) refreshHz=\(String(describing: refreshHz))")
            try CaptureSourceCapability.validate(
                frameRate: frameRate,
                refreshHz: refreshHz,
                width: Double(display.width),
                height: Double(display.height),
                pixelScale: pixelScale
            )
            configuration.width = display.width
            configuration.height = display.height
            configuration.pixelFormat = kCVPixelFormatType_32BGRA
            configuration.minimumFrameInterval = CaptureFrameIntervalStrategy.minimumFrameInterval(
                for: frameRate
            )
            configuration.showsCursor = true
            configuration.queueDepth = streamQueueDepth

            debugLog("startDisplayCapture creating stream size=\(configuration.width)x\(configuration.height) queueDepth=\(configuration.queueDepth)")
            let stream = SCStream(filter: filter, configuration: configuration, delegate: self)
            debugLog("startDisplayCapture adding output")
            try stream.addStreamOutput(self, type: .screen, sampleHandlerQueue: sampleQueue)

            self.stream = stream
            captureFrameRate = frameRate
            resetStartupHandshake()
            launchStreamStart(stream, context: "startDisplayCapture")
            try await waitForStartupHandshake()
            await MainActor.run {
                self.isRunning = true
                self.captureSessionID = UUID().uuidString
                self.lastError = nil
                self.captureDescriptor = makeDisplayDescriptor(display: display)
            }
        } catch {
            debugLog("startDisplayCapture failed error=\(String(describing: error))")
            startCaptureTask?.cancel()
            startCaptureTask = nil
            if let stream {
                Task {
                    try? await stream.stopCapture()
                }
            }
            stream = nil
            isRunning = false
            captureSessionID = nil
            clearLatestCompleteVideoSample()
            clearStartupHandshake()
            audioCapture.stop()
            throw error
        }
    }

    @MainActor
    public func startWindowCapture(
        windowID: CGWindowID,
        enableMic: Bool = false,
        targetFrameRate: Int = 30,
        enablePreview: Bool = true
    ) async throws {
        guard !isRunning else { return }
        resetTelemetry()
        setPreviewCachingEnabled(enablePreview)
        clearPreviewFrame()
        clearLatestCompleteVideoSample()
        hasLoggedFirstVideoSample = false
        let frameRate = CaptureFrameRatePolicy.sanitize(targetFrameRate)
        debugLog("startWindowCapture begin windowID=\(windowID) frameRate=\(frameRate) mic=\(enableMic)")

        try await ensureScreenCaptureAccess()
        if enableMic {
            try await audioCapture.start()
        }

        do {
            debugLog("startWindowCapture resolving window")
            let window = try await resolveWindow(windowID: windowID)
            debugLog("startWindowCapture resolved window title=\(window.title ?? "")")
            let filter = SCContentFilter(desktopIndependentWindow: window)
            let configuration = SCStreamConfiguration()

            let scale: CGFloat = if #available(macOS 14.0, *) {
                CGFloat(filter.pointPixelScale)
            } else {
                1
            }
            let refreshHz = await MainActor.run {
                CaptureSourceCapability.refreshRate(forWindowFrame: window.frame)
            }
            debugLog("startWindowCapture refreshHz=\(String(describing: refreshHz))")
            try CaptureSourceCapability.validate(
                frameRate: frameRate,
                refreshHz: refreshHz,
                width: Double(window.frame.width),
                height: Double(window.frame.height),
                pixelScale: Double(scale)
            )
            configuration.width = max(1, Int(round(window.frame.width * scale)))
            configuration.height = max(1, Int(round(window.frame.height * scale)))
            configuration.pixelFormat = kCVPixelFormatType_32BGRA
            configuration.minimumFrameInterval = CaptureFrameIntervalStrategy.minimumFrameInterval(
                for: frameRate
            )
            configuration.showsCursor = true
            configuration.queueDepth = streamQueueDepth
            configuration.scalesToFit = true

            debugLog("startWindowCapture creating stream size=\(configuration.width)x\(configuration.height) queueDepth=\(configuration.queueDepth)")
            let stream = SCStream(filter: filter, configuration: configuration, delegate: self)
            debugLog("startWindowCapture adding output")
            try stream.addStreamOutput(self, type: .screen, sampleHandlerQueue: sampleQueue)

            self.stream = stream
            captureFrameRate = frameRate
            resetStartupHandshake()
            launchStreamStart(stream, context: "startWindowCapture")
            try await waitForStartupHandshake()
            await MainActor.run {
                self.isRunning = true
                self.captureSessionID = UUID().uuidString
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
            debugLog("startWindowCapture failed error=\(String(describing: error))")
            startCaptureTask?.cancel()
            startCaptureTask = nil
            if let stream {
                Task {
                    try? await stream.stopCapture()
                }
            }
            stream = nil
            isRunning = false
            captureSessionID = nil
            clearLatestCompleteVideoSample()
            clearStartupHandshake()
            audioCapture.stop()
            throw error
        }
    }

    @MainActor
    public func startCurrentWindowCapture(
        enableMic: Bool = false,
        targetFrameRate: Int = 30,
        enablePreview: Bool = true
    ) async throws {
        let frontmostWindow = try await resolveFrontmostWindow()
        try await startWindowCapture(
            windowID: frontmostWindow.windowID,
            enableMic: enableMic,
            targetFrameRate: targetFrameRate,
            enablePreview: enablePreview
        )
    }

    @available(macOS 14.0, *)
    @MainActor
    public func startCaptureUsingPicker(
        style: SCShareableContentStyle? = nil,
        enableMic: Bool = false,
        targetFrameRate: Int = 30,
        enablePreview: Bool = true
    ) async throws {
        let filter = try await pickContent(style: style)
        try await startCapture(
            using: filter,
            enableMic: enableMic,
            targetFrameRate: targetFrameRate,
            enablePreview: enablePreview
        )
    }
}

extension CaptureEngine {
    @MainActor
    public func stopCapture() async {
        clearPreviewFrame()
        clearLatestCompleteVideoSample()
        guard let stream else { return }
        if isRecording {
            await stopRecording()
        }
        try? await stream.stopCapture()
        audioCapture.stop()
        isRunning = false
        captureSessionID = nil
        startCaptureTask?.cancel()
        startCaptureTask = nil
        recordingActivationTask?.cancel()
        recordingActivationTask = nil
        recordingQueue.sync {
            recordingState = RecordingState()
        }
        hasLoggedFirstVideoSample = false
        clearStartupHandshake()
        clearRecordingActivationWaitState()
        self.stream = nil
        captureDescriptor = nil
        captureFrameRate = CaptureFrameRatePolicy.defaultValue
        resetTelemetry()
    }

    @MainActor
    public func clearError() {
        lastError = nil
    }

    func setPreviewCachingEnabled(_ enabled: Bool) {
        livePreviewStore.setEnabled(enabled)
    }

    @MainActor
    public func setErrorMessage(_ message: String?) {
        lastError = message
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

    private func withSampleQueue<T>(_ operation: () -> T) -> T {
        if DispatchQueue.getSpecific(key: sampleQueueKey) != nil {
            return operation()
        }
        return sampleQueue.sync(execute: operation)
    }

    func debugLog(_ message: String) {
        fputs("[CaptureEngine] \(message)\n", stderr)
    }

    private func resetStartupHandshake() {
        startupStateLock.lock()
        startupContinuation = nil
        startupResult = nil
        hasResolvedStartupHandshake = false
        startupStateLock.unlock()
        withSampleQueue {
            startupHandshakeNeedsSampleResolution = true
        }
    }

    func resolveStartupHandshake(_ result: Result<Void, Error>) {
        startupStateLock.lock()
        guard !hasResolvedStartupHandshake else {
            startupStateLock.unlock()
            return
        }
        hasResolvedStartupHandshake = true
        if let continuation = startupContinuation {
            startupContinuation = nil
            startupResult = nil
            startupStateLock.unlock()
            continuation.resume(with: result)
            return
        }
        startupResult = result
        startupStateLock.unlock()
    }

    func resolveStartupHandshakeIfNeeded(_ result: Result<Void, Error>) {
        resolveStartupHandshake(result)
    }

    private func clearStartupHandshake() {
        startupStateLock.lock()
        startupContinuation = nil
        startupResult = nil
        hasResolvedStartupHandshake = false
        startupStateLock.unlock()
        withSampleQueue {
            startupHandshakeNeedsSampleResolution = false
        }
    }

    private func clearStartupHandshakeWaitState(resumingWith error: Error? = nil) {
        startupStateLock.lock()
        let continuation = startupContinuation
        startupContinuation = nil
        startupResult = nil
        startupStateLock.unlock()
        if let continuation, let error {
            continuation.resume(throwing: error)
        }
    }

    func shouldResolveStartupHandshake(for status: SCFrameStatus?) -> Bool {
        guard status == nil || status == .complete else {
            return false
        }
        guard startupHandshakeNeedsSampleResolution else {
            return false
        }
        startupHandshakeNeedsSampleResolution = false
        return true
    }

    func resetRecordingActivation() {
        recordingActivationStateLock.lock()
        recordingActivationContinuation = nil
        recordingActivationResult = nil
        recordingActivationStateLock.unlock()
    }

    func resolveRecordingActivation(_ result: Result<Void, Error>) {
        recordingActivationStateLock.lock()
        if let continuation = recordingActivationContinuation {
            recordingActivationContinuation = nil
            recordingActivationResult = nil
            recordingActivationStateLock.unlock()
            continuation.resume(with: result)
            return
        }
        recordingActivationResult = result
        recordingActivationStateLock.unlock()
    }

    private func clearRecordingActivationWaitState(resumingWith error: Error? = nil) {
        recordingActivationStateLock.lock()
        let continuation = recordingActivationContinuation
        recordingActivationContinuation = nil
        recordingActivationResult = nil
        recordingActivationStateLock.unlock()
        if let continuation, let error {
            continuation.resume(throwing: error)
        }
    }

    private func waitForStartupHandshake(timeoutNanoseconds: UInt64 = 5_000_000_000) async throws {
        let timeoutTask = Task { [weak self] in
            do {
                try await Task.sleep(nanoseconds: timeoutNanoseconds)
            } catch {
                return
            }
            self?.resolveStartupHandshakeIfNeeded(.failure(CaptureError.captureStartTimedOut))
        }
        defer {
            timeoutTask.cancel()
        }

        try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                startupStateLock.lock()
                if let result = startupResult {
                    startupResult = nil
                    startupStateLock.unlock()
                    continuation.resume(with: result)
                    return
                }
                startupContinuation = continuation
                startupStateLock.unlock()
            }
        } onCancel: { [weak self] in
            self?.clearStartupHandshakeWaitState(resumingWith: CancellationError())
        }
    }

    func waitForRecordingActivation(timeoutNanoseconds: UInt64) async throws {
        let frameRate = captureFrameRate
        let timeoutTask = Task { [weak self] in
            do {
                try await Task.sleep(nanoseconds: timeoutNanoseconds)
            } catch {
                return
            }
            self?.resolveRecordingActivation(.failure(CaptureError.captureStartUnstable(frameRate: frameRate)))
        }
        defer {
            timeoutTask.cancel()
        }

        try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                recordingActivationStateLock.lock()
                if let result = recordingActivationResult {
                    recordingActivationResult = nil
                    recordingActivationStateLock.unlock()
                    continuation.resume(with: result)
                    return
                }
                recordingActivationContinuation = continuation
                recordingActivationStateLock.unlock()
            }
        } onCancel: { [weak self] in
            self?.clearRecordingActivationWaitState(resumingWith: CancellationError())
        }
    }

    func primingTimeoutNanoseconds(for frameRate: Int) -> UInt64 {
        frameRate >= 120 ? 550_000_000 : 400_000_000
    }

    func cacheLatestCompleteVideoSample(_ sampleBuffer: CMSampleBuffer) {
        latestCompleteVideoSampleLock.lock()
        latestCompleteVideoSample = sampleBuffer
        latestCompleteVideoSampleLock.unlock()
    }

    func latestCompleteVideoSeedSample() -> CMSampleBuffer? {
        latestCompleteVideoSampleLock.lock()
        defer {
            latestCompleteVideoSampleLock.unlock()
        }
        return latestCompleteVideoSample
    }

    func clearLatestCompleteVideoSample() {
        latestCompleteVideoSampleLock.lock()
        latestCompleteVideoSample = nil
        latestCompleteVideoSampleLock.unlock()
    }

    func recordActivationTimeoutIfNeeded(frameRate: Int) {
        let timeoutNanoseconds = primingTimeoutNanoseconds(for: frameRate)
        recordingActivationTask?.cancel()
        recordingActivationTask = Task { [weak self] in
            do {
                try await Task.sleep(nanoseconds: timeoutNanoseconds)
            } catch {
                return
            }
            guard let self else { return }
            recordingQueue.async { [weak self] in
                guard let self else { return }
                guard case .priming = recordingState.phase else { return }
                recordingState = RecordingState()
                resolveRecordingActivation(.failure(CaptureError.captureStartUnstable(frameRate: frameRate)))
            }
        }
    }

    private func launchStreamStart(_ stream: SCStream, context: String) {
        startCaptureTask?.cancel()
        startCaptureTask = Task { [weak self] in
            do {
                self?.debugLog("\(context) awaiting startCapture")
                try await stream.startCapture()
                self?.debugLog("\(context) startCapture resolved")
            } catch {
                guard let self else { return }
                debugLog("\(context) startCapture failed error=\(String(describing: error))")
                resolveStartupHandshakeIfNeeded(.failure(error))
                await MainActor.run {
                    self.isRunning = false
                    self.captureSessionID = nil
                    self.lastError = error.localizedDescription
                }
            }
        }
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

    @available(macOS 14.0, *)
    @MainActor
    private func startCapture(
        using filter: SCContentFilter,
        enableMic: Bool,
        targetFrameRate: Int,
        enablePreview: Bool
    ) async throws {
        guard !isRunning else { return }
        resetTelemetry()
        setPreviewCachingEnabled(enablePreview)
        clearPreviewFrame()
        clearLatestCompleteVideoSample()
        hasLoggedFirstVideoSample = false
        let frameRate = CaptureFrameRatePolicy.sanitize(targetFrameRate)
        debugLog("startCapture(using:) begin frameRate=\(frameRate) mic=\(enableMic)")

        try await ensureScreenCaptureAccess()
        if enableMic {
            try await audioCapture.start()
        }

        do {
            let configuration = SCStreamConfiguration()
            let refreshHz = await MainActor.run {
                CaptureSourceCapability.refreshRate(forContentRect: filter.contentRect)
            }
            debugLog("startCapture(using:) refreshHz=\(String(describing: refreshHz))")
            let pixelScale = Double(filter.pointPixelScale)
            try CaptureSourceCapability.validate(
                frameRate: frameRate,
                refreshHz: refreshHz,
                width: Double(filter.contentRect.width),
                height: Double(filter.contentRect.height),
                pixelScale: pixelScale
            )
            configuration.pixelFormat = kCVPixelFormatType_32BGRA
            configuration.minimumFrameInterval = CaptureFrameIntervalStrategy.minimumFrameInterval(
                for: frameRate
            )
            configuration.showsCursor = true
            configuration.queueDepth = streamQueueDepth

            let rect = filter.contentRect
            let scale = CGFloat(filter.pointPixelScale)
            if rect.width > 1, rect.height > 1 {
                configuration.width = max(1, Int(round(rect.width * scale)))
                configuration.height = max(1, Int(round(rect.height * scale)))
            }
            configuration.scalesToFit = filter.style == .window

            debugLog("startCapture(using:) creating stream size=\(configuration.width)x\(configuration.height) queueDepth=\(configuration.queueDepth)")
            let stream = SCStream(filter: filter, configuration: configuration, delegate: self)
            debugLog("startCapture(using:) adding output")
            try stream.addStreamOutput(self, type: .screen, sampleHandlerQueue: sampleQueue)

            self.stream = stream
            captureFrameRate = frameRate
            resetStartupHandshake()
            launchStreamStart(stream, context: "startCapture(using:)")
            try await waitForStartupHandshake()
            await MainActor.run {
                self.isRunning = true
                self.captureSessionID = UUID().uuidString
                self.lastError = nil
                self.captureDescriptor = makeDescriptor(filter: filter)
            }
        } catch {
            debugLog("startCapture(using:) failed error=\(String(describing: error))")
            startCaptureTask?.cancel()
            startCaptureTask = nil
            if let stream {
                Task {
                    try? await stream.stopCapture()
                }
            }
            stream = nil
            isRunning = false
            captureSessionID = nil
            clearLatestCompleteVideoSample()
            clearStartupHandshake()
            audioCapture.stop()
            throw error
        }
    }

    @available(macOS 14.0, *)
    @MainActor
    private func pickContent(style: SCShareableContentStyle?) async throws -> SCContentFilter {
        if pickerContinuation != nil {
            throw CaptureError.pickerAlreadyActive
        }

        let picker = SCContentSharingPicker.shared
        var configuration = SCContentSharingPickerConfiguration()
        configuration.allowedPickerModes = [.singleDisplay, .singleWindow]
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
            if let style {
                picker.present(using: style)
            } else {
                picker.present()
            }
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
