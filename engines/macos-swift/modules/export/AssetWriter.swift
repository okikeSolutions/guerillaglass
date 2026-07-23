import AVFoundation
import Darwin
import Foundation

/// Public class exposed by the macOS engine module.
public final class AssetWriter {
    public enum VideoAppendOutcome {
        case appended
        case droppedBackpressure
        case droppedWriterState
        case failed
    }

    public struct VideoAppendSample {
        public let outcome: VideoAppendOutcome
        public let appendDurationMs: Double

        public init(outcome: VideoAppendOutcome, appendDurationMs: Double) {
            self.outcome = outcome
            self.appendDurationMs = appendDurationMs
        }
    }

    public typealias VideoAppendOutcomeHandler = @Sendable (VideoAppendSample) -> Void

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

        try rejectSymlinkComponents(in: outputURL)
        if FileManager.default.fileExists(atPath: outputURL.path) {
            try FileManager.default.removeItem(at: outputURL)
        }
        try rejectSymlinkComponents(in: outputURL.deletingLastPathComponent())

        do {
            writer = try AVAssetWriter(outputURL: outputURL, fileType: configuration.fileType)
            writer.shouldOptimizeForNetworkUse = true
        } catch {
            throw AssetWriterError.cannotCreateWriter
        }
    }

    public func appendVideo(
        sampleBuffer: CMSampleBuffer,
        onOutcome: VideoAppendOutcomeHandler? = nil
    ) {
        queue.async {
            onOutcome?(self.appendVideoSample(sampleBuffer))
        }
    }

    @discardableResult
    func appendVideoSample(_ sampleBuffer: CMSampleBuffer) -> VideoAppendSample {
        let startedAt = DispatchTime.now().uptimeNanoseconds
        let outcome = appendVideoSynchronously(sampleBuffer)
        let appendDurationMs = Double(DispatchTime.now().uptimeNanoseconds - startedAt) / 1_000_000
        return VideoAppendSample(outcome: outcome, appendDurationMs: appendDurationMs)
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

private func rejectSymlinkComponents(in url: URL) throws {
    let rawPath = url.path
    let isAbsolute = rawPath.hasPrefix("/")
    let components = rawPath.split(separator: "/").map(String.init)
    var currentPath = isAbsolute ? "/" : ""

    for component in components {
        if currentPath.isEmpty {
            currentPath = component
        } else if currentPath == "/" {
            currentPath += component
        } else {
            currentPath += "/\(component)"
        }
        try rejectSymlinkIfExists(atPath: currentPath)
    }
}

private func rejectSymlinkIfExists(atPath path: String) throws {
    var metadata = stat()
    let status = path.withCString { fileSystemPath in
        Darwin.lstat(fileSystemPath, &metadata)
    }
    if status != 0 {
        if errno == ENOENT {
            return
        }
        throw POSIXError(POSIXErrorCode(rawValue: errno) ?? .EIO)
    }
    if (metadata.st_mode & S_IFMT) == S_IFLNK {
        throw AssetWriter.AssetWriterError.writerFailed(
            NSError(domain: "GuerillaglassExport", code: Int(ELOOP), userInfo: [NSLocalizedDescriptionKey: "Symlink output path component is not allowed: \(path)"])
        )
    }
}
