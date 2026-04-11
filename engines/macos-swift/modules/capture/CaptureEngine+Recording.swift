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
        await MainActor.run {
            self.lastRecordingTelemetry = nil
        }
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
                if engine.recordingState.isActive {
                    continuation.resume(returning: ())
                    return
                }

                engine.recordingState = RecordingState(
                    phase: .priming(
                        RecordingState.PrimingState(
                            startedAtUptimeNanoseconds: DispatchTime.now().uptimeNanoseconds,
                            timeoutNanoseconds: engine.primingTimeoutNanoseconds(for: expectedFrameRate)
                        )
                    ),
                    writer: nil,
                    outputURL: outputURL,
                    videoBaseTime: nil,
                    lastDurationUpdate: 0,
                    expectedFrameRate: expectedFrameRate
                )
                engine.resetRecordingActivation()
                engine.recordActivationTimeoutIfNeeded(frameRate: expectedFrameRate)
                if let seedSample = engine.latestCompleteVideoSeedSample() {
                    engine.activateRecordingFromPrimedSamples([seedSample])
                }
                continuation.resume()
            }
        }

        do {
            try await waitForRecordingActivation(
                timeoutNanoseconds: primingTimeoutNanoseconds(for: expectedFrameRate) + 100_000_000
            )
            recordingActivationTask?.cancel()
            recordingActivationTask = nil
            resetTelemetry()
            await MainActor.run {
                self.isRecording = true
                self.recordingURL = nil
                self.recordingDuration = 0
            }
        } catch {
            recordingActivationTask?.cancel()
            recordingActivationTask = nil
            let queue = recordingQueue
            let box = WeakSelfBox(self)
            await withCheckedContinuation { continuation in
                queue.async { [box] in
                    box.value?.recordingState = RecordingState()
                    continuation.resume()
                }
            }
            throw error
        }
    }

    func stopRecording() async {
        recordingActivationTask?.cancel()
        recordingActivationTask = nil
        let queue = recordingQueue
        let box = WeakSelfBox(self)
        await withCheckedContinuation { continuation in
            queue.async { [box] in
                guard let engine = box.value else {
                    continuation.resume()
                    return
                }
                guard engine.recordingState.isActive else {
                    continuation.resume()
                    return
                }
                if case .priming = engine.recordingState.phase {
                    engine.recordingState = RecordingState()
                    engine.resolveRecordingActivation(
                        .failure(CaptureError.recordingStartCancelled)
                    )
                    Task { @MainActor in
                        engine.isRecording = false
                    }
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
                            engine.lastRecordingTelemetry = engine.telemetrySnapshot()
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
            self.lastRecordingTelemetry = nil
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
            self.lastRecordingTelemetry = nil
        }
    }

    func activeRecordingOutputURL() -> URL? {
        recordingQueue.sync {
            recordingState.isActive ? recordingState.outputURL : nil
        }
    }

    internal func handleAudioBuffer(_ buffer: AVAudioPCMBuffer, time: AVAudioTime) {
        recordingQueue.async { [weak self] in
            guard let self else { return }
            guard recordingState.isRecordingActive, let writer = recordingState.writer else { return }
            writer.appendAudio(buffer: buffer, time: time)
        }
    }

    internal func appendVideoSample(_ sampleBuffer: CMSampleBuffer) {
        let enqueueUptimeNanoseconds = DispatchTime.now().uptimeNanoseconds
        recordingQueue.async { [weak self] in
            guard let self else { return }

            let recordQueueLagMs =
                Double(DispatchTime.now().uptimeNanoseconds - enqueueUptimeNanoseconds) / 1_000_000
            recordRecordQueueLag(recordQueueLagMs)

            switch recordingState.phase {
            case .idle:
                return
            case let .priming(primingState):
                handlePrimingSample(sampleBuffer, primingState: primingState)
            case .recording:
                appendActiveRecordingSample(sampleBuffer)
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
}

private extension CaptureEngine {
    func handlePrimingSample(
        _ sampleBuffer: CMSampleBuffer,
        primingState: RecordingState.PrimingState
    ) {
        var nextPrimingState = primingState
        let presentationTime = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
        guard presentationTime.isNumeric else {
            recordingState.phase = .priming(nextPrimingState)
            return
        }

        if let previousPresentationTimestamp = nextPrimingState.lastPresentationTimestamp {
            let deltaSeconds = max(0, presentationTime.seconds - previousPresentationTimestamp.seconds)
            let expectedDeltaSeconds = 1.0 / Double(recordingState.expectedFrameRate)
            let toleranceSeconds = expectedDeltaSeconds * 0.2
            let isStableInterval = abs(deltaSeconds - expectedDeltaSeconds) <= toleranceSeconds

            if isStableInterval {
                nextPrimingState.consecutiveStableIntervals += 1
                nextPrimingState.bufferedFrames.append(sampleBuffer)
            } else {
                nextPrimingState.consecutiveStableIntervals = 0
                nextPrimingState.bufferedFrames = [sampleBuffer]
            }
        } else {
            nextPrimingState.bufferedFrames = [sampleBuffer]
        }

        nextPrimingState.lastPresentationTimestamp = presentationTime
        recordingState.phase = .priming(nextPrimingState)

        guard nextPrimingState.bufferedFrames.count >= 3, nextPrimingState.consecutiveStableIntervals >= 2 else {
            return
        }

        activateRecordingFromPrimedSamples(nextPrimingState.bufferedFrames)
    }

    func appendActiveRecordingSample(_ sampleBuffer: CMSampleBuffer) {
        guard recordingState.isRecordingActive, let writer = recordingState.writer else { return }

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

        writer.appendVideo(sampleBuffer: sampleBuffer) { [weak self] sample in
            self?.recordWriterAppendSample(sample)
        }
    }

    func activateRecordingFromPrimedSamples(_ primedSamples: [CMSampleBuffer]) {
        do {
            let outputURL = recordingState.outputURL ?? makeRecordingURL()
            let writer = try AssetWriter(
                outputURL: outputURL,
                configuration: AssetWriter.Configuration(
                    fileType: .mov,
                    codec: .h264,
                    expectedFrameRate: recordingState.expectedFrameRate
                )
            )
            guard let firstPrimedSample = primedSamples.first else {
                throw CaptureError.captureStartUnstable(frameRate: recordingState.expectedFrameRate)
            }

            recordingState.outputURL = outputURL
            recordingState.writer = writer
            recordingState.videoBaseTime = CMSampleBufferGetPresentationTimeStamp(firstPrimedSample)
            recordingState.lastDurationUpdate = 0
            recordingState.phase = .recording

            for primedSample in primedSamples {
                appendActiveRecordingSample(primedSample)
            }
            resolveRecordingActivation(.success(()))
        } catch {
            recordingState = RecordingState()
            resolveRecordingActivation(.failure(error))
        }
    }
}
