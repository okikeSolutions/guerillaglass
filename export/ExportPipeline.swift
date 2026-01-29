import AVFoundation
import Foundation

public final class ExportPipeline {
    private final class ExportSessionBox: @unchecked Sendable {
        let session: AVAssetExportSession

        init(_ session: AVAssetExportSession) {
            self.session = session
        }
    }

    public enum ExportError: LocalizedError {
        case missingVideoTrack
        case cannotCreateSession
        case failed(Error?)

        public var errorDescription: String? {
            switch self {
            case .missingVideoTrack:
                String(localized: "No video track available for export.")
            case .cannotCreateSession:
                String(localized: "Unable to start export.")
            case let .failed(error):
                error?.localizedDescription ?? String(localized: "Export failed.")
            }
        }
    }

    public init() {}

    public func export(
        recordingURL: URL,
        preset: ExportPreset,
        trimRange: CMTimeRange?,
        outputURL: URL
    ) async throws -> URL {
        let asset = AVAsset(url: recordingURL)
        let videoTracks = try await asset.loadTracks(withMediaType: .video)
        guard videoTracks.first != nil else {
            throw ExportError.missingVideoTrack
        }

        guard let session = AVAssetExportSession(
            asset: asset,
            presetName: preset.exportPresetName
        ) else {
            throw ExportError.cannotCreateSession
        }
        let sessionBox = ExportSessionBox(session)

        if FileManager.default.fileExists(atPath: outputURL.path) {
            try FileManager.default.removeItem(at: outputURL)
        }

        session.outputURL = outputURL
        session.outputFileType = preset.fileType
        if let trimRange {
            session.timeRange = trimRange
        }

        if let composition = try await makeVideoComposition(asset: asset, preset: preset) {
            session.videoComposition = composition
        }

        try await withCheckedThrowingContinuation { continuation in
            sessionBox.session.exportAsynchronously {
                switch sessionBox.session.status {
                case .completed:
                    continuation.resume()
                case .failed, .cancelled:
                    continuation.resume(throwing: ExportError.failed(sessionBox.session.error))
                default:
                    continuation.resume(throwing: ExportError.failed(sessionBox.session.error))
                }
            }
        }

        return outputURL
    }

    private func makeVideoComposition(
        asset: AVAsset,
        preset: ExportPreset
    ) async throws -> AVVideoComposition? {
        let tracks = try await asset.loadTracks(withMediaType: .video)
        guard let track = tracks.first else {
            return nil
        }

        let targetSize = CGSize(width: preset.width, height: preset.height)
        let naturalSize = try await track.load(.naturalSize)
        if naturalSize.width == targetSize.width, naturalSize.height == targetSize.height {
            return nil
        }

        let scale = min(targetSize.width / naturalSize.width, targetSize.height / naturalSize.height)
        let scaledSize = CGSize(width: naturalSize.width * scale, height: naturalSize.height * scale)
        let translateX = (targetSize.width - scaledSize.width) / 2
        let translateY = (targetSize.height - scaledSize.height) / 2

        var transform = try await track.load(.preferredTransform)
        transform = transform.scaledBy(x: scale, y: scale)
        transform = transform.translatedBy(x: translateX, y: translateY)

        let layerInstruction = AVMutableVideoCompositionLayerInstruction(assetTrack: track)
        layerInstruction.setTransform(transform, at: .zero)

        let instruction = AVMutableVideoCompositionInstruction()
        let duration = try await asset.load(.duration)
        instruction.timeRange = CMTimeRange(start: .zero, duration: duration)
        instruction.layerInstructions = [layerInstruction]

        let composition = AVMutableVideoComposition()
        composition.renderSize = targetSize
        composition.frameDuration = CMTime(value: 1, timescale: CMTimeScale(preset.fps))
        composition.instructions = [instruction]

        return composition
    }
}
