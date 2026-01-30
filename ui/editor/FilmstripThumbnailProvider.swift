import AppKit
import AVFoundation
import Foundation

final class FilmstripThumbnailProvider: ObservableObject {
    @Published var thumbnails: [Int: NSImage] = [:]

    private let queue = DispatchQueue(label: "gg.editor.filmstrip")
    private var generator: AVAssetImageGenerator?
    private var assetURL: URL?
    private var maximumSize = CGSize(width: 160, height: 90)

    func configure(url: URL, maximumSize: CGSize) {
        if assetURL == url {
            return
        }
        assetURL = url
        self.maximumSize = maximumSize
        thumbnails = [:]
        let asset = AVAsset(url: url)
        let generator = AVAssetImageGenerator(asset: asset)
        generator.appliesPreferredTrackTransform = true
        generator.maximumSize = maximumSize
        self.generator = generator
    }

    func requestThumbnail(frameIndex: Int, frameRate: Double) {
        guard thumbnails[frameIndex] == nil else { return }
        guard let generator, frameRate > 0 else { return }
        queue.async { [weak self] in
            guard let self else { return }
            let seconds = Double(frameIndex) / frameRate
            let time = CMTime(seconds: seconds, preferredTimescale: 600)
            guard let cgImage = try? generator.copyCGImage(at: time, actualTime: nil) else { return }
            let image = NSImage(cgImage: cgImage, size: .zero)
            DispatchQueue.main.async {
                self.thumbnails[frameIndex] = image
            }
        }
    }
}
