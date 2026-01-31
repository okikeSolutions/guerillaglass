import AppKit
import AVFoundation
import Foundation

final class FilmstripThumbnailProvider: ObservableObject {
    @Published var thumbnails: [Int: NSImage] = [:]

    private let queue = DispatchQueue(label: "gg.editor.filmstrip")
    private var generator: AVAssetImageGenerator?
    private var assetURL: URL?
    private var maximumSize = CGSize(width: 160, height: 90)
    private var generationToken = UUID()
    private var inFlight: Set<Int> = []

    func configure(url: URL, maximumSize: CGSize) {
        if assetURL == url {
            return
        }
        assetURL = url
        self.maximumSize = maximumSize
        thumbnails = [:]
        inFlight = []
        generationToken = UUID()
        let asset = AVAsset(url: url)
        let generator = AVAssetImageGenerator(asset: asset)
        generator.appliesPreferredTrackTransform = true
        generator.maximumSize = maximumSize
        self.generator = generator
    }

    func requestThumbnail(frameIndex: Int, frameRate: Double) {
        guard thumbnails[frameIndex] == nil else { return }
        guard !inFlight.contains(frameIndex) else { return }
        guard let generator, frameRate > 0 else { return }
        let token = generationToken
        inFlight.insert(frameIndex)
        queue.async { [weak self] in
            guard let self else { return }
            let seconds = Double(frameIndex) / frameRate
            let time = CMTime(seconds: seconds, preferredTimescale: 600)
            guard let cgImage = try? generator.copyCGImage(at: time, actualTime: nil) else {
                DispatchQueue.main.async {
                    self.inFlight.remove(frameIndex)
                }
                return
            }
            let image = NSImage(cgImage: cgImage, size: .zero)
            DispatchQueue.main.async {
                guard self.generationToken == token else {
                    self.inFlight.remove(frameIndex)
                    return
                }
                self.thumbnails[frameIndex] = image
                self.inFlight.remove(frameIndex)
            }
        }
    }
}
