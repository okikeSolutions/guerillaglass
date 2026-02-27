import AVFoundation
import Export
import Foundation
import OSLog

/// Public extension for the macOS engine API surface.
public extension CaptureEngine {
    private static let logger = Logger(subsystem: "com.guerillaglass", category: "recording")

    internal final class WeakSelfBox: @unchecked Sendable {
        weak var value: CaptureEngine?

        init(_ value: CaptureEngine) {
            self.value = value
        }
    }

    func startRecording() async throws {
        guard isRunning else {
            throw CaptureError.captureNotRunning
        }
        resetTelemetry()
        let expectedFrameRate = max(1, captureFrameRate)

        let outputURL = makeRecordingURL()
        Self.logger.info("Start recording to \(outputURL.path, privacy: .private(mask: .hash))")
        let queue = recordingQueue
        let box = WeakSelfBox(self)
        try await withCheckedThrowingContinuation { continuation in
            queue.async { [box] in
                guard let engine = box.value else {
                    continuation.resume(returning: ())
                    return
                }
                if engine.recordingState.isRecording {
                    continuation.resume(returning: ())
                    return
                }
                do {
                    let writer = try AssetWriter(
                        outputURL: outputURL,
                        configuration: AssetWriter.Configuration(
                            fileType: .mov,
                            codec: .h264,
                            expectedFrameRate: expectedFrameRate
                        )
                    )
                    engine.recordingState = RecordingState(
                        isRecording: true,
                        writer: writer,
                        outputURL: outputURL
                    )
                    Task { @MainActor [weak engine] in
                        guard let engine else { return }
                        engine.isRecording = true
                        engine.recordingURL = nil
                        engine.recordingDuration = 0
                    }
                    continuation.resume()
                } catch {
                    Self.logger.error("Failed to start recording: \(error.localizedDescription, privacy: .private)")
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    func stopRecording() async {
        let queue = recordingQueue
        let box = WeakSelfBox(self)
        await withCheckedContinuation { continuation in
            queue.async { [box] in
                guard let engine = box.value else {
                    continuation.resume()
                    return
                }
                guard engine.recordingState.isRecording else {
                    continuation.resume()
                    return
                }
                let writer = engine.recordingState.writer
                engine.recordingState = RecordingState()
                guard let writer else {
                    Task { @MainActor in
                        engine.isRecording = false
                        Self.logger.error("Stop recording failed: writer missing")
                        continuation.resume()
                    }
                    return
                }
                writer.finish { result in
                    Task { @MainActor in
                        engine.isRecording = false
                        switch result {
                        case let .success(url):
                            Self.logger.info("Recording finished: \(url.path, privacy: .private(mask: .hash))")
                            let duration = await Self.recordingDuration(for: url)
                            engine.recordingURL = url
                            engine.recordingDuration = duration
                        case let .failure(error):
                            Self.logger.error("Recording failed: \(error.localizedDescription, privacy: .private)")
                            engine.lastError = error.localizedDescription
                        }
                        continuation.resume()
                    }
                }
            }
        }
    }

    func loadRecording(from url: URL) {
        Task { @MainActor in
            self.recordingURL = url
        }
        Task {
            let duration = await Self.recordingDuration(for: url)
            await MainActor.run {
                self.recordingDuration = duration
            }
        }
    }

    func clearRecording() {
        Task { @MainActor in
            self.recordingURL = nil
            self.recordingDuration = 0
        }
    }

    func activeRecordingOutputURL() -> URL? {
        recordingQueue.sync {
            recordingState.isRecording ? recordingState.outputURL : nil
        }
    }

    internal func handleAudioBuffer(_ buffer: AVAudioPCMBuffer, time: AVAudioTime) {
        recordAudioLevel(Self.audioLevelDbfs(for: buffer))
        recordingQueue.async { [weak self] in
            guard let self else { return }
            guard recordingState.isRecording, let writer = recordingState.writer else { return }
            writer.appendAudio(buffer: buffer, time: time)
        }
    }

    internal func appendVideoSample(_ sampleBuffer: CMSampleBuffer) {
        recordingQueue.async { [weak self] in
            guard let self else { return }
            guard recordingState.isRecording, let writer = recordingState.writer else { return }
            let pts = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
            if recordingState.videoBaseTime == nil {
                recordingState.videoBaseTime = pts
            }
            if let baseTime = recordingState.videoBaseTime {
                let elapsed = CMTimeSubtract(pts, baseTime)
                if elapsed.isNumeric {
                    let seconds = elapsed.seconds
                    if seconds - recordingState.lastDurationUpdate >= 0.1 {
                        recordingState.lastDurationUpdate = seconds
                        Task { @MainActor in
                            self.recordingDuration = seconds
                        }
                    }
                }
            }
            writer.appendVideo(sampleBuffer: sampleBuffer) { [weak self] outcome in
                self?.recordWriterAppendOutcome(outcome)
            }
        }
    }

    private func makeRecordingURL() -> URL {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withDashSeparatorInDate, .withColonSeparatorInTime]
        let timestamp = formatter.string(from: Date())
        return FileManager.default.temporaryDirectory
            .appendingPathComponent("guerillaglass-recording-\(timestamp).mov")
    }

    private static func recordingDuration(for url: URL) async -> TimeInterval {
        let asset = AVAsset(url: url)
        let duration = await (try? asset.load(.duration)) ?? .zero
        if duration.isNumeric {
            return duration.seconds
        }
        return 0
    }

    private static func audioLevelDbfs(for buffer: AVAudioPCMBuffer) -> Double? {
        guard let channelData = buffer.floatChannelData else { return nil }
        let channelCount = Int(buffer.format.channelCount)
        let frameCount = Int(buffer.frameLength)
        guard channelCount > 0, frameCount > 0 else { return nil }

        var meanSquare: Float = 0
        for channel in 0 ..< channelCount {
            let samples = channelData[channel]
            var channelSquare: Float = 0
            for frame in 0 ..< frameCount {
                let sample = samples[frame]
                channelSquare += sample * sample
            }
            meanSquare += channelSquare / Float(frameCount)
        }
        meanSquare /= Float(channelCount)

        if meanSquare <= 0 {
            return -80
        }

        let rms = sqrt(meanSquare)
        let dbfs = 20 * log10(Double(rms))
        return min(0, max(-80, dbfs))
    }
}
