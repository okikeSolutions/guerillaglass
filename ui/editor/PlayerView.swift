import AVKit
import SwiftUI

struct PlayerView: NSViewRepresentable {
    let player: AVPlayer

    func makeNSView(context _: Context) -> AVPlayerView {
        let view = AVPlayerView()
        view.controlsStyle = .none
        view.videoGravity = .resizeAspect
        view.player = player
        view.setAccessibilityLabel(String(localized: "Recording Preview"))
        return view
    }

    func updateNSView(_ nsView: AVPlayerView, context _: Context) {
        nsView.player = player
    }
}
