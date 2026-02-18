import Automation
import AVFoundation
import Foundation
import Rendering

public final class ExportPipeline {
    private final class ExportSessionBox: @unchecked Sendable {
        let session: AVAssetExportSession

        init(_ session: AVAssetExportSession) {
            self.session = session
        }
    }

    private let renderer = ExportRenderer()

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
        outputURL: URL,
        cameraPlan: CameraPlan? = nil
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

        let renderSize = CGSize(width: preset.width, height: preset.height)
        if let composition = try await renderer.makeVideoComposition(
            asset: asset,
            renderSize: renderSize,
            frameRate: Double(preset.fps),
            plan: cameraPlan
        ) {
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
}
