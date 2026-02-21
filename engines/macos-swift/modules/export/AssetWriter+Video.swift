import AVFoundation
import Foundation

extension AssetWriter {
    func appendVideoSynchronously(_ sampleBuffer: CMSampleBuffer) -> VideoAppendOutcome {
        guard canAppendVideo else {
            return .droppedWriterState
        }

        guard let imageBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else {
            return .failed
        }

        do {
            try ensureVideoInputConfigured(for: imageBuffer)
        } catch {
            writer.cancelWriting()
            return .failed
        }

        startVideoSessionIfNeeded(with: sampleBuffer)

        guard let adjusted = adjustedVideoSampleBuffer(sampleBuffer) else {
            return .failed
        }
        guard let videoInput else {
            return .failed
        }
        guard videoInput.isReadyForMoreMediaData else {
            return .droppedBackpressure
        }

        return videoInput.append(adjusted) ? .appended : .failed
    }

    private var canAppendVideo: Bool {
        !isFinishing && writer.status != .failed && writer.status != .cancelled
    }

    private func ensureVideoInputConfigured(for imageBuffer: CVImageBuffer) throws {
        guard videoInput == nil else { return }
        let width = CVPixelBufferGetWidth(imageBuffer)
        let height = CVPixelBufferGetHeight(imageBuffer)
        try configureVideoInput(width: width, height: height)
    }

    private func startVideoSessionIfNeeded(with sampleBuffer: CMSampleBuffer) {
        if writer.status == .unknown {
            writer.startWriting()
        }

        if videoBaseTime == nil {
            videoBaseTime = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
            writer.startSession(atSourceTime: .zero)
        }
    }

    private func configureVideoInput(width: Int, height: Int) throws {
        let bitrate = max(4_000_000, width * height * 4)
        let keyframeInterval = max(1, configuration.expectedFrameRate)
        let settings: [String: Any] = [
            AVVideoCodecKey: configuration.codec,
            AVVideoWidthKey: width,
            AVVideoHeightKey: height,
            AVVideoCompressionPropertiesKey: [
                AVVideoAverageBitRateKey: bitrate,
                AVVideoExpectedSourceFrameRateKey: configuration.expectedFrameRate,
                AVVideoMaxKeyFrameIntervalKey: keyframeInterval,
                AVVideoMaxKeyFrameIntervalDurationKey: 1,
                AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel
            ]
        ]

        let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
        input.expectsMediaDataInRealTime = true
        guard writer.canAdd(input) else {
            throw AssetWriterError.cannotAddVideoInput
        }
        writer.add(input)
        videoInput = input
    }

    private func adjustedVideoSampleBuffer(_ sampleBuffer: CMSampleBuffer) -> CMSampleBuffer? {
        guard let baseTime = videoBaseTime else { return nil }
        let pts = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
        let duration = CMSampleBufferGetDuration(sampleBuffer)
        var timing = CMSampleTimingInfo(
            duration: duration,
            presentationTimeStamp: CMTimeSubtract(pts, baseTime),
            decodeTimeStamp: .invalid
        )
        var adjusted: CMSampleBuffer?
        let status = CMSampleBufferCreateCopyWithNewTiming(
            allocator: kCFAllocatorDefault,
            sampleBuffer: sampleBuffer,
            sampleTimingEntryCount: 1,
            sampleTimingArray: &timing,
            sampleBufferOut: &adjusted
        )
        guard status == noErr else { return nil }
        return adjusted
    }
}
