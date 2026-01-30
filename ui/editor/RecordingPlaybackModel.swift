import AVFoundation
import Foundation

final class RecordingPlaybackModel: ObservableObject {
    @Published var duration: Double = 0
    @Published var currentTime: Double = 0
    @Published var isPlaying: Bool = false
    @Published var frameRate: Double = 30
    @Published var currentURL: URL?

    let player = AVPlayer()

    private var timeObserverToken: Any?
    private var endObserver: NSObjectProtocol?
    private var wasPlayingBeforeScrub = false
    private var isScrubbing = false
    private var loadToken = UUID()

    init() {
        player.actionAtItemEnd = .pause
        addTimeObserver()
    }

    deinit {
        removeTimeObserver()
        removeEndObserver()
    }

    func load(url: URL?) {
        loadToken = UUID()
        player.pause()
        isPlaying = false
        currentTime = 0
        duration = 0
        currentURL = url
        removeEndObserver()

        guard let url else {
            player.replaceCurrentItem(with: nil)
            return
        }

        let asset = AVAsset(url: url)
        let item = AVPlayerItem(asset: asset)
        player.replaceCurrentItem(with: item)
        let token = loadToken
        endObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime,
            object: item,
            queue: .main
        ) { [weak self] _ in
            self?.isPlaying = false
        }

        Task { @MainActor [weak self] in
            guard let self else { return }
            let loadedDuration = await (try? asset.load(.duration)) ?? .zero
            let tracks = try? await asset.loadTracks(withMediaType: .video)
            if let track = tracks?.first {
                let nominal = await (try? track.load(.nominalFrameRate)) ?? 0
                frameRate = nominal > 0 ? Double(nominal) : 30
            } else {
                frameRate = 30
            }
            guard loadToken == token else { return }
            guard player.currentItem === item else { return }
            if loadedDuration.isNumeric {
                duration = loadedDuration.seconds
            }
            currentTime = 0
            await player.seek(to: .zero, toleranceBefore: .zero, toleranceAfter: .zero)
        }
    }

    func togglePlayPause() {
        if isPlaying {
            player.pause()
            isPlaying = false
        } else {
            if duration > 0, currentTime >= max(0, duration - 0.05) {
                seek(to: 0)
            }
            player.play()
            isPlaying = true
        }
    }

    func pause() {
        player.pause()
        isPlaying = false
    }

    func beginScrubbing() {
        guard !isScrubbing else { return }
        wasPlayingBeforeScrub = isPlaying
        isScrubbing = true
        player.pause()
        isPlaying = false
    }

    func endScrubbing(at seconds: Double) {
        seek(to: seconds)
        isScrubbing = false
        if wasPlayingBeforeScrub {
            player.play()
            isPlaying = true
        }
    }

    func seek(to seconds: Double) {
        let time = CMTime(seconds: max(0, seconds), preferredTimescale: 600)
        player.currentItem?.cancelPendingSeeks()
        player.seek(to: time, toleranceBefore: .zero, toleranceAfter: .zero)
    }

    func updateScrubbing(to seconds: Double) {
        let clamped = max(0, seconds)
        currentTime = clamped
        seek(to: clamped)
    }

    private func addTimeObserver() {
        let interval = CMTime(seconds: 0.1, preferredTimescale: 600)
        timeObserverToken = player.addPeriodicTimeObserver(
            forInterval: interval,
            queue: .main
        ) { [weak self] time in
            guard let self else { return }
            guard !isScrubbing else { return }
            currentTime = max(0, time.seconds)
        }
    }

    private func removeTimeObserver() {
        if let timeObserverToken {
            player.removeTimeObserver(timeObserverToken)
            self.timeObserverToken = nil
        }
    }

    private func removeEndObserver() {
        if let endObserver {
            NotificationCenter.default.removeObserver(endObserver)
            self.endObserver = nil
        }
    }
}
