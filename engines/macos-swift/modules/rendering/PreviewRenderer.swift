import Automation
import AVFoundation
import Foundation
import Project

/// Public class exposed by the macOS engine module.
public final class PreviewRenderer {
    public init() {}

    public func makeVideoComposition(
        asset: AVAsset,
        plan: CameraPlan?,
        backgroundFraming: BackgroundFramingSettings = .defaults
    ) async throws -> AVVideoComposition? {
        let tracks = try await asset.loadTracks(withMediaType: .video)
        guard let track = tracks.first else { return nil }
        let naturalSize = try await track.load(.naturalSize)
        let preferredTransform = try await track.load(.preferredTransform)
        let orientedSize = VideoGeometryTransforms.orientedBounds(
            naturalSize: naturalSize,
            preferredTransform: preferredTransform
        ).size
        let nominalFrameRate = try await track.load(.nominalFrameRate)
        let frameRate = nominalFrameRate > 0 ? Double(nominalFrameRate) : 30

        return try await CameraPlanVideoCompositionBuilder.makeComposition(
            asset: asset,
            track: track,
            renderSize: orientedSize,
            frameRate: frameRate,
            plan: plan,
            backgroundFraming: backgroundFraming
        )
    }
}
