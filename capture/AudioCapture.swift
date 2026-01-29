import Foundation
import AVFoundation

public final class AudioCapture {
    private let engine = AVAudioEngine()
    private var isRunning = false

    public init() {}

    public func start() async throws {
        guard !isRunning else { return }
        try await ensureMicrophoneAccess()

        let input = engine.inputNode
        let format = input.inputFormat(forBus: 0)
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { _, _ in
            // Placeholder: audio buffers will be routed to AssetWriter in Phase 1.
        }

        engine.prepare()
        try engine.start()
        isRunning = true
    }

    public func stop() {
        guard isRunning else { return }
        engine.inputNode.removeTap(onBus: 0)
        engine.stop()
        isRunning = false
    }

    private func ensureMicrophoneAccess() async throws {
        switch AVCaptureDevice.authorizationStatus(for: .audio) {
        case .authorized:
            return
        case .notDetermined:
            let granted = await AVCaptureDevice.requestAccess(for: .audio)
            if !granted {
                throw AudioCaptureError.microphoneDenied
            }
        default:
            throw AudioCaptureError.microphoneDenied
        }
    }
}

public enum AudioCaptureError: LocalizedError {
    case microphoneDenied

    public var errorDescription: String? {
        switch self {
        case .microphoneDenied:
            return "Microphone permission is required to capture audio."
        }
    }
}
