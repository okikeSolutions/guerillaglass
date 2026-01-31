import AppKit
import SwiftUI

struct RecordingPlaybackView: View {
    @ObservedObject var model: RecordingPlaybackModel
    @Binding var trimInSeconds: Double
    @Binding var trimOutSeconds: Double
    @StateObject private var thumbnailProvider = FilmstripThumbnailProvider()
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @State private var highContrastEnabled = NSWorkspace.shared.accessibilityDisplayShouldIncreaseContrast

    var body: some View {
        VStack(spacing: 12) {
            PlayerView(player: model.player)
                .background(playerBackgroundColor)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .strokeBorder(playerBorderColor, lineWidth: playerBorderLineWidth)
                )

            timelinePanel
                .frame(minHeight: 120, idealHeight: 140, maxHeight: 180)
        }
        .padding(10)
        .onReceive(
            NotificationCenter.default.publisher(
                for: NSWorkspace.accessibilityDisplayOptionsDidChangeNotification
            )
        ) { _ in
            highContrastEnabled = NSWorkspace.shared.accessibilityDisplayShouldIncreaseContrast
        }
    }

    private var frameRate: Double {
        max(model.frameRate, 1)
    }

    private var frameStride: Int {
        2
    }

    private var totalFrames: Int {
        max(1, Int((model.duration * frameRate).rounded()))
    }

    private var currentFrame: Int {
        frameIndex(from: model.currentTime)
    }

    private func frameIndex(from seconds: Double) -> Int {
        Int((seconds * frameRate).rounded())
    }

    private func seconds(from frame: Int) -> Double {
        Double(frame) / frameRate
    }

    private func snapFrame(_ frame: Int) -> Int {
        let step = frameStride
        return Int((Double(frame) / Double(step)).rounded()) * step
    }

    private var timelinePanel: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(String(localized: "Timeline"))
                .font(.headline)
                .foregroundStyle(.secondary)

            if let assetURL = model.currentURL, model.duration > 0 {
                FilmstripTimelineView(
                    assetURL: assetURL,
                    duration: model.duration,
                    frameRate: frameRate,
                    frameStride: frameStride,
                    trimInSeconds: trimInSeconds,
                    trimOutSeconds: trimOutSeconds,
                    currentTime: model.currentTime,
                    highContrastEnabled: highContrastEnabled,
                    thumbnailProvider: thumbnailProvider,
                    onSeek: { seconds in
                        model.updateScrubbing(to: seconds)
                    },
                    onBeginScrub: {
                        model.beginScrubbing()
                    },
                    onEndScrub: {
                        model.endScrubbing(at: model.currentTime)
                    }
                )
            } else {
                RoundedRectangle(cornerRadius: 6)
                    .fill(placeholderColor)
                    .frame(height: 60)
            }

            HStack(spacing: 10) {
                Button {
                    model.togglePlayPause()
                } label: {
                    Image(systemName: model.isPlaying ? "pause.fill" : "play.fill")
                }
                .buttonStyle(.bordered)
                .accessibilityLabel(model.isPlaying ? Text("Pause") : Text("Play"))
                .disabled(model.duration <= 0)

                Slider(
                    value: Binding(
                        get: { Double(currentFrame) },
                        set: { value in
                            let frame = snapFrame(Int(value))
                            model.updateScrubbing(to: seconds(from: frame))
                        }
                    ),
                    in: 0 ... max(Double(totalFrames), 1),
                    step: Double(frameStride),
                    onEditingChanged: { isEditing in
                        if isEditing {
                            model.beginScrubbing()
                        } else {
                            model.endScrubbing(at: model.currentTime)
                        }
                    }
                )
                .disabled(model.duration <= 0)
                .accessibilityLabel(Text("Playback Position"))
                .accessibilityValue(Text("Frame \(currentFrame) of \(totalFrames)"))

                Text("Frame \(currentFrame) / \(totalFrames)")
                    .font(.system(.caption, design: .monospaced))
                    .foregroundStyle(.secondary)
            }
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 10)
                .fill(panelBackgroundColor)
        )
    }

    private var playerBackgroundColor: Color {
        reduceTransparency ? Color(nsColor: .controlBackgroundColor) : Color.black.opacity(0.12)
    }

    private var playerBorderColor: Color {
        highContrastEnabled ? Color(nsColor: .separatorColor) : Color.black.opacity(0.08)
    }

    private var playerBorderLineWidth: CGFloat {
        highContrastEnabled ? 2 : 1
    }

    private var panelBackgroundColor: Color {
        reduceTransparency ? Color(nsColor: .controlBackgroundColor) : Color.black.opacity(0.04)
    }

    private var placeholderColor: Color {
        reduceTransparency ? Color(nsColor: .controlBackgroundColor) : Color.black.opacity(0.06)
    }
}

private struct FilmstripTimelineView: View {
    let assetURL: URL
    let duration: Double
    let frameRate: Double
    let frameStride: Int
    let trimInSeconds: Double
    let trimOutSeconds: Double
    let currentTime: Double
    let highContrastEnabled: Bool
    @ObservedObject var thumbnailProvider: FilmstripThumbnailProvider
    let onSeek: (Double) -> Void
    let onBeginScrub: () -> Void
    let onEndScrub: () -> Void

    private let cellWidth: CGFloat = 48
    private let cellHeight: CGFloat = 54
    private let spacing: CGFloat = 2
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

    var body: some View {
        let frames = frameIndices
        let totalWidth = max(0, CGFloat(frames.count)) * (cellWidth + spacing) - spacing

        ScrollView(.horizontal) {
            ZStack(alignment: .leading) {
                LazyHStack(spacing: spacing) {
                    ForEach(frames, id: \.self) { frameIndex in
                        thumbnailView(frameIndex: frameIndex)
                            .onAppear {
                                thumbnailProvider.requestThumbnail(
                                    frameIndex: frameIndex,
                                    frameRate: frameRate
                                )
                            }
                    }
                }

                trimOverlay()
                playheadOverlay()
            }
            .frame(width: totalWidth, height: cellHeight)
            .padding(.vertical, 6)
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { value in
                        onBeginScrub()
                        let seconds = seconds(at: value.location.x, totalWidth: totalWidth)
                        onSeek(seconds)
                    }
                    .onEnded { value in
                        let seconds = seconds(at: value.location.x, totalWidth: totalWidth)
                        onSeek(seconds)
                        onEndScrub()
                    }
            )
        }
        .frame(height: cellHeight + 12)
        .onAppear {
            thumbnailProvider.configure(
                url: assetURL,
                maximumSize: CGSize(width: cellWidth * 2, height: cellHeight * 2)
            )
        }
        .onChange(of: assetURL) { newValue in
            thumbnailProvider.configure(
                url: newValue,
                maximumSize: CGSize(width: cellWidth * 2, height: cellHeight * 2)
            )
        }
    }

    private var frameIndices: [Int] {
        guard frameRate > 0, duration > 0 else { return [] }
        let totalFrames = max(1, Int((duration * frameRate).rounded()))
        return Array(stride(from: 0, through: totalFrames, by: frameStride))
    }

    private func frameIndex(from seconds: Double) -> Int {
        Int((seconds * frameRate).rounded())
    }

    private func seconds(from frameIndex: Int) -> Double {
        Double(frameIndex) / frameRate
    }

    private func slotIndex(for frameIndex: Int, maxIndex: Int) -> Int {
        guard maxIndex > 0 else { return 0 }
        return min(max(frameIndex / frameStride, 0), maxIndex)
    }

    private func position(for slotIndex: Int) -> CGFloat {
        CGFloat(slotIndex) * (cellWidth + spacing)
    }

    private func seconds(at locationX: CGFloat, totalWidth: CGFloat) -> Double {
        let clampedX = min(max(0, locationX), max(totalWidth, 1))
        let slotWidth = cellWidth + spacing
        let slot = Int((clampedX / slotWidth).rounded())
        let frameIndex = slot * frameStride
        return seconds(from: frameIndex)
    }

    private func thumbnailView(frameIndex: Int) -> some View {
        ZStack {
            RoundedRectangle(cornerRadius: 4)
                .fill(thumbnailBackgroundColor)
            if let image = thumbnailProvider.thumbnails[frameIndex] {
                Image(nsImage: image)
                    .resizable()
                    .scaledToFill()
                    .frame(width: cellWidth, height: cellHeight)
                    .clipped()
            }
        }
        .frame(width: cellWidth, height: cellHeight)
        .overlay(
            RoundedRectangle(cornerRadius: 4)
                .strokeBorder(thumbnailBorderColor, lineWidth: thumbnailBorderLineWidth)
        )
    }

    @ViewBuilder
    private func trimOverlay() -> some View {
        let frameCount = frameIndices.count
        if frameCount > 0 {
            let maxSlot = max(0, frameCount - 1)
            let trimInFrame = frameIndex(from: trimInSeconds)
            let trimOutFrame = frameIndex(from: trimOutSeconds)
            let startSlot = slotIndex(for: trimInFrame, maxIndex: maxSlot)
            let endSlot = max(startSlot, slotIndex(for: trimOutFrame, maxIndex: maxSlot))
            let startX = position(for: startSlot)
            let width = CGFloat(endSlot - startSlot + 1) * (cellWidth + spacing) - spacing

            RoundedRectangle(cornerRadius: 4)
                .fill(trimOverlayColor)
                .frame(width: width, height: cellHeight)
                .offset(x: startX)
        }
    }

    @ViewBuilder
    private func playheadOverlay() -> some View {
        let frameCount = frameIndices.count
        if frameCount > 0 {
            let maxSlot = max(0, frameCount - 1)
            let playheadFrame = frameIndex(from: currentTime)
            let slot = slotIndex(for: playheadFrame, maxIndex: maxSlot)
            let playheadX = position(for: slot) + (cellWidth / 2)

            Rectangle()
                .fill(Color.accentColor)
                .frame(width: playheadWidth, height: cellHeight)
                .offset(x: playheadX)
        }
    }

    private var thumbnailBackgroundColor: Color {
        reduceTransparency ? Color(nsColor: .controlBackgroundColor) : Color.black.opacity(0.08)
    }

    private var thumbnailBorderColor: Color {
        highContrastEnabled ? Color(nsColor: .separatorColor) : Color.black.opacity(0.1)
    }

    private var thumbnailBorderLineWidth: CGFloat {
        highContrastEnabled ? 2 : 1
    }

    private var trimOverlayColor: Color {
        highContrastEnabled ? Color.accentColor.opacity(0.4) : Color.accentColor.opacity(0.2)
    }

    private var playheadWidth: CGFloat {
        highContrastEnabled ? 3 : 2
    }
}
