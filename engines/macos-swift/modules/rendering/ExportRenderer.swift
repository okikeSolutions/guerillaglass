import Automation
import AVFoundation
import Foundation

/// Public class exposed by the macOS engine module.
public final class ExportRenderer {
    public init() {}

    public func makeVideoComposition(
        asset: AVAsset,
        renderSize: CGSize,
        frameRate: Double,
        plan: CameraPlan?
    ) async throws -> AVVideoComposition? {
        let tracks = try await asset.loadTracks(withMediaType: .video)
        guard let track = tracks.first else { return nil }

        return try await CameraPlanVideoCompositionBuilder.makeComposition(
            asset: asset,
            track: track,
            renderSize: renderSize,
            frameRate: frameRate,
            plan: plan
        )
    }
}
