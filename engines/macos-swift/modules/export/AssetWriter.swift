import AVFoundation
import Foundation

public final class AssetWriter {
    public enum VideoAppendOutcome {
        case appended
        case droppedBackpressure
        case droppedWriterState
        case failed
    }

    public typealias VideoAppendOutcomeHandler = @Sendable (VideoAppendOutcome) -> Void

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

    let outputURL: URL
    let configuration: Configuration
    let queue = DispatchQueue(label: "gg.export.assetwriter")
    let writer: AVAssetWriter
    var videoInput: AVAssetWriterInput?
    var audioInput: AVAssetWriterInput?
    var videoBaseTime: CMTime?
    var audioBaseSampleTime: AVAudioFramePosition?
    var isFinishing = false

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

    public func appendVideo(
        sampleBuffer: CMSampleBuffer,
        onOutcome: VideoAppendOutcomeHandler? = nil
    ) {
        queue.async {
            onOutcome?(self.appendVideoSynchronously(sampleBuffer))
        }
    }

    public func appendAudio(buffer: AVAudioPCMBuffer, time: AVAudioTime) {
        queue.async {
            self.appendAudioSynchronously(buffer: buffer, time: time)
        }
    }

    public func finish(completion: @escaping (Result<URL, Error>) -> Void) {
        queue.async {
            self.finishSynchronously(completion: completion)
        }
    }
}
