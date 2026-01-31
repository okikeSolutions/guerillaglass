import Automation
import AVFoundation
import Foundation

public final class PreviewRenderer {
    public init() {}

    public func makeVideoComposition(
        asset: AVAsset,
        plan: CameraPlan?
    ) async throws -> AVVideoComposition? {
        let tracks = try await asset.loadTracks(withMediaType: .video)
        guard let track = tracks.first else { return nil }
        let naturalSize = try await track.load(.naturalSize)
        let nominalFrameRate = try await track.load(.nominalFrameRate)
        let frameRate = nominalFrameRate > 0 ? Double(nominalFrameRate) : 30

        return try await CameraPlanVideoCompositionBuilder.makeComposition(
            asset: asset,
            track: track,
            renderSize: naturalSize,
            frameRate: frameRate,
            plan: plan
        )
    }
}
