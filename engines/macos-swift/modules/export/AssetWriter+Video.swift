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
        let profile = VideoCompressionProfile.resolve(
            width: width,
            height: height,
            expectedFrameRate: configuration.expectedFrameRate
        )
        let keyframeInterval = max(1, configuration.expectedFrameRate)
        let settings: [String: Any] = [
            AVVideoCodecKey: configuration.codec,
            AVVideoWidthKey: width,
            AVVideoHeightKey: height,
            AVVideoCompressionPropertiesKey: [
                AVVideoAverageBitRateKey: profile.averageBitRate,
                AVVideoExpectedSourceFrameRateKey: configuration.expectedFrameRate,
                AVVideoMaxKeyFrameIntervalKey: keyframeInterval,
                AVVideoMaxKeyFrameIntervalDurationKey: 1,
                AVVideoAllowFrameReorderingKey: false,
                AVVideoH264EntropyModeKey: AVVideoH264EntropyModeCABAC,
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

extension AssetWriter {
    struct VideoCompressionProfile {
        let averageBitRate: Int

        static func resolve(
            width: Int,
            height: Int,
            expectedFrameRate: Int
        ) -> VideoCompressionProfile {
            let pixelsPerFrame = max(1, width * height)
            return VideoCompressionProfile(
                averageBitRate: averageBitRate(
                    pixelsPerFrame: pixelsPerFrame,
                    expectedFrameRate: expectedFrameRate
                )
            )
        }

        static func averageBitRate(
            pixelsPerFrame: Int,
            expectedFrameRate: Int
        ) -> Int {
            let standardFrameRateBitRate = switch pixelsPerFrame {
            case ...2_073_600:
                16_000_000
            case ...3_686_400:
                24_000_000
            case ...8_294_400:
                40_000_000
            default:
                48_000_000
            }

            if expectedFrameRate >= 120 {
                return standardFrameRateBitRate * 3
            }
            if expectedFrameRate >= 60 {
                return standardFrameRateBitRate * 3 / 2
            }
            return standardFrameRateBitRate
        }
    }
}
