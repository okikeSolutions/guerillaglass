import Foundation
import ScreenCaptureKit
import AVFoundation
import CoreGraphics
import CoreImage

public final class CaptureEngine: NSObject, ObservableObject {
    @Published public private(set) var latestFrame: CGImage?
    @Published public private(set) var isRunning: Bool = false
    @Published public private(set) var lastError: String?

    private let ciContext = CIContext(options: nil)
    private let sampleQueue = DispatchQueue(label: "gg.capture.sample")
    private var stream: SCStream?
    private let audioCapture = AudioCapture()

    public override init() {
        super.init()
    }

    public func startDisplayCapture(enableMic: Bool = false) async throws {
        guard !isRunning else { return }

        try await ensureScreenCaptureAccess()
        if enableMic {
            try await audioCapture.start()
        }

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
    }

    @MainActor
    public func stopCapture() async {
        guard let stream else { return }
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
}

extension CaptureEngine: SCStreamOutput, SCStreamDelegate {
    public func stream(
        _ stream: SCStream,
        didOutputSampleBuffer sampleBuffer: CMSampleBuffer,
        of outputType: SCStreamOutputType
    ) {
        guard outputType == .screen,
              let imageBuffer = sampleBuffer.imageBuffer else { return }

        let ciImage = CIImage(cvImageBuffer: imageBuffer)
        guard let cgImage = ciContext.createCGImage(ciImage, from: ciImage.extent) else { return }

        Task { @MainActor in
            self.latestFrame = cgImage
        }
    }

    public func stream(_ stream: SCStream, didStopWithError error: Error) {
        Task { @MainActor in
            self.isRunning = false
            self.lastError = error.localizedDescription
        }
    }
}

public enum CaptureError: LocalizedError {
    case noDisplayAvailable
    case screenRecordingDenied

    public var errorDescription: String? {
        switch self {
        case .noDisplayAvailable:
            return "No displays are available for capture."
        case .screenRecordingDenied:
            return "Screen Recording permission is required to capture your display."
        }
    }
}
