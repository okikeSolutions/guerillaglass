import AVFoundation
import Foundation

public final class AssetWriter {
    public struct Configuration {
        public let fileType: AVFileType
        public let codec: AVVideoCodecType
        public let expectedFrameRate: Int

        public init(
            fileType: AVFileType = .mov,
            codec: AVVideoCodecType = .h264,
            expectedFrameRate: Int = 30
        ) {
            self.fileType = fileType
            self.codec = codec
            self.expectedFrameRate = expectedFrameRate
        }
    }

    public enum AssetWriterError: LocalizedError {
        case cannotCreateWriter
        case cannotAddVideoInput
        case cannotAddAudioInput
        case invalidAudioFormat
        case writerFailed(Error?)

        public var errorDescription: String? {
            switch self {
            case .cannotCreateWriter:
                String(localized: "Unable to create export file.")
            case .cannotAddVideoInput:
                String(localized: "Unable to configure video export.")
            case .cannotAddAudioInput:
                String(localized: "Unable to configure audio export.")
            case .invalidAudioFormat:
                String(localized: "Unsupported audio format.")
            case let .writerFailed(error):
                error?.localizedDescription ?? String(localized: "Export failed.")
            }
        }
    }

    private let outputURL: URL
    private let configuration: Configuration
    private let queue = DispatchQueue(label: "gg.export.assetwriter")
    private let writer: AVAssetWriter
    private var videoInput: AVAssetWriterInput?
    private var audioInput: AVAssetWriterInput?
    private var videoBaseTime: CMTime?
    private var audioBaseSampleTime: AVAudioFramePosition?
    private var isFinishing = false

    public init(outputURL: URL, configuration: Configuration = Configuration()) throws {
        self.outputURL = outputURL
        self.configuration = configuration

        if FileManager.default.fileExists(atPath: outputURL.path) {
            try FileManager.default.removeItem(at: outputURL)
        }

        do {
            writer = try AVAssetWriter(outputURL: outputURL, fileType: configuration.fileType)
        } catch {
            throw AssetWriterError.cannotCreateWriter
        }
    }

    public func appendVideo(sampleBuffer: CMSampleBuffer) {
        queue.async {
            guard !self.isFinishing else { return }
            guard self.writer.status != .failed, self.writer.status != .cancelled else { return }
            guard let imageBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }

            if self.videoInput == nil {
                let width = CVPixelBufferGetWidth(imageBuffer)
                let height = CVPixelBufferGetHeight(imageBuffer)
                do {
                    try self.configureVideoInput(width: width, height: height)
                } catch {
                    self.writer.cancelWriting()
                    return
                }
            }

            if self.writer.status == .unknown {
                self.writer.startWriting()
            }

            if self.videoBaseTime == nil {
                self.videoBaseTime = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
                self.writer.startSession(atSourceTime: .zero)
            }

            guard let adjusted = self.adjustedVideoSampleBuffer(sampleBuffer) else { return }
            guard let videoInput = self.videoInput, videoInput.isReadyForMoreMediaData else { return }
            videoInput.append(adjusted)
        }
    }

    public func appendAudio(buffer: AVAudioPCMBuffer, time: AVAudioTime) {
        queue.async {
            guard !self.isFinishing else { return }
            guard self.writer.status == .writing || self.writer.status == .unknown else { return }
            guard self.videoBaseTime != nil else { return }
            guard time.isSampleTimeValid else { return }

            if self.audioInput == nil {
                do {
                    try self.configureAudioInput(format: buffer.format)
                } catch {
                    return
                }
            }

            let baseSample = self.audioBaseSampleTime ?? time.sampleTime
            if self.audioBaseSampleTime == nil {
                self.audioBaseSampleTime = baseSample
            }

            let sampleOffset = time.sampleTime - baseSample
            let pts = CMTime(
                value: CMTimeValue(sampleOffset),
                timescale: CMTimeScale(buffer.format.sampleRate)
            )

            guard let sampleBuffer = try? self.makeAudioSampleBuffer(
                buffer: buffer,
                presentationTimeStamp: pts
            ) else { return }

            guard let audioInput = self.audioInput, audioInput.isReadyForMoreMediaData else { return }
            audioInput.append(sampleBuffer)
        }
    }

    public func finish(completion: @escaping (Result<URL, Error>) -> Void) {
        queue.async {
            guard !self.isFinishing else { return }
            self.isFinishing = true

            self.videoInput?.markAsFinished()
            self.audioInput?.markAsFinished()

            self.writer.finishWriting {
                if self.writer.status == .completed {
                    completion(.success(self.outputURL))
                } else {
                    completion(.failure(AssetWriterError.writerFailed(self.writer.error)))
                }
            }
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

    private func makeAudioSampleBuffer(
        buffer: AVAudioPCMBuffer,
        presentationTimeStamp: CMTime
    ) throws -> CMSampleBuffer {
        let formatDescription = try makeAudioFormatDescription(for: buffer)

        let frameCount = CMTimeValue(buffer.frameLength)
        var timing = CMSampleTimingInfo(
            duration: CMTime(value: frameCount, timescale: CMTimeScale(buffer.format.sampleRate)),
            presentationTimeStamp: presentationTimeStamp,
            decodeTimeStamp: .invalid
        )

        var sampleBuffer: CMSampleBuffer?
        var status = CMSampleBufferCreate(
            allocator: kCFAllocatorDefault,
            dataBuffer: nil,
            dataReady: false,
            makeDataReadyCallback: nil,
            refcon: nil,
            formatDescription: formatDescription,
            sampleCount: CMItemCount(buffer.frameLength),
            sampleTimingEntryCount: 1,
            sampleTimingArray: &timing,
            sampleSizeEntryCount: 0,
            sampleSizeArray: nil,
            sampleBufferOut: &sampleBuffer
        )

        guard status == noErr, let sampleBuffer else {
            throw AssetWriterError.invalidAudioFormat
        }

        status = CMSampleBufferSetDataBufferFromAudioBufferList(
            sampleBuffer,
            blockBufferAllocator: kCFAllocatorDefault,
            blockBufferMemoryAllocator: kCFAllocatorDefault,
            flags: 0,
            bufferList: buffer.audioBufferList
        )
        guard status == noErr else {
            throw AssetWriterError.invalidAudioFormat
        }
        status = CMSampleBufferMakeDataReady(sampleBuffer)
        guard status == noErr else {
            throw AssetWriterError.invalidAudioFormat
        }

        return sampleBuffer
    }

    private func makeAudioFormatDescription(
        for buffer: AVAudioPCMBuffer
    ) throws -> CMAudioFormatDescription {
        let streamDescription = buffer.format.streamDescription
        var formatDescription: CMAudioFormatDescription?
        let status = CMAudioFormatDescriptionCreate(
            allocator: kCFAllocatorDefault,
            asbd: streamDescription,
            layoutSize: 0,
            layout: nil,
            magicCookieSize: 0,
            magicCookie: nil,
            extensions: nil,
            formatDescriptionOut: &formatDescription
        )
        guard status == noErr, let formatDescription else {
            throw AssetWriterError.invalidAudioFormat
        }
        return formatDescription
    }
}

extension AssetWriter {
    private func configureAudioInput(format: AVAudioFormat) throws {
        let settings: [String: Any] = [
            AVFormatIDKey: kAudioFormatMPEG4AAC,
            AVSampleRateKey: format.sampleRate,
            AVNumberOfChannelsKey: format.channelCount,
            AVEncoderBitRateKey: 192_000
        ]

        let input = AVAssetWriterInput(mediaType: .audio, outputSettings: settings)
        input.expectsMediaDataInRealTime = true
        guard writer.canAdd(input) else {
            throw AssetWriterError.cannotAddAudioInput
        }
        writer.add(input)
        audioInput = input
    }
}
