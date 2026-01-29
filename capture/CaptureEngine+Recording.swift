import AVFoundation
import Export
import Foundation

extension CaptureEngine {
    final class WeakSelfBox: @unchecked Sendable {
        weak var value: CaptureEngine?

        init(_ value: CaptureEngine) {
            self.value = value
        }
    }

    public func startRecording() async throws {
        guard isRunning else {
            throw CaptureError.captureNotRunning
        }

        let outputURL = makeRecordingURL()
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
                            expectedFrameRate: 30
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
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    public func stopRecording() async {
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
                writer?.finish { result in
                    Task {
                        await MainActor.run {
                            engine.isRecording = false
                        }
                        switch result {
                        case let .success(url):
                            let duration = await Self.recordingDuration(for: url)
                            await MainActor.run {
                                engine.recordingURL = url
                                engine.recordingDuration = duration
                            }
                        case let .failure(error):
                            await MainActor.run {
                                engine.lastError = error.localizedDescription
                            }
                        }
                    }
                    continuation.resume()
                }
            }
        }
    }

    func handleAudioBuffer(_ buffer: AVAudioPCMBuffer, time: AVAudioTime) {
        recordingQueue.async { [weak self] in
            guard let self else { return }
            guard recordingState.isRecording, let writer = recordingState.writer else { return }
            writer.appendAudio(buffer: buffer, time: time)
        }
    }

    func appendVideoSample(_ sampleBuffer: CMSampleBuffer) {
        recordingQueue.async { [weak self] in
            guard let self else { return }
            guard recordingState.isRecording, let writer = recordingState.writer else { return }
            writer.appendVideo(sampleBuffer: sampleBuffer)
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
}
