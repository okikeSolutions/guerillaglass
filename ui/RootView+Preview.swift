import AppKit
import SwiftUI

extension RootView {
    var previewPanel: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 16)
                .fill(previewBackgroundColor)

            if studioMode == .edit {
                if let recordingURL = captureEngine.recordingURL {
                    RecordingPlaybackView(
                        model: playbackModel,
                        trimInSeconds: $trimInSeconds,
                        trimOutSeconds: $trimOutSeconds
                    )
                    .padding(10)
                    .onAppear {
                        if playbackModel.player.currentItem == nil {
                            playbackModel.load(url: recordingURL)
                        }
                    }
                } else {
                    editEmptyState
                }
            } else if let image = captureEngine.latestFrame {
                let size = NSSize(width: image.width, height: image.height)
                Image(nsImage: NSImage(cgImage: image, size: size))
                    .resizable()
                    .scaledToFit()
                    .padding(10)
            } else {
                VStack(spacing: 6) {
                    let statusText: LocalizedStringKey = captureEngine.isRunning ? "Waiting for frames…" : "Preview"
                    Text(statusText)
                        .foregroundStyle(.secondary)
                    if let errorMessage = captureEngine.lastError {
                        Text(errorMessage)
                            .foregroundStyle(.red)
                            .multilineTextAlignment(.center)
                    }
                }
            }

            if isPreviewDropTarget {
                RoundedRectangle(cornerRadius: 16)
                    .strokeBorder(
                        dropTargetStrokeColor,
                        style: StrokeStyle(lineWidth: dropTargetLineWidth, dash: [6])
                    )
                    .padding(8)
                Text("Drop media to add")
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .layoutPriority(1)
        .onDrop(of: [.fileURL], isTargeted: $isPreviewDropTarget) { _ in
            false
        }
    }

    private var editEmptyState: some View {
        VStack(spacing: 10) {
            let titleText: LocalizedStringKey =
                captureEngine.isRecording ? "Stop recording to edit." : "No recording yet."
            Text(titleText)
                .font(.headline)
            Text("Record a clip in Capture mode to preview and trim it here.")
                .foregroundStyle(.secondary)
            if let errorMessage = captureEngine.lastError {
                Text(errorMessage)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
            }
            Button("Go to Capture") {
                studioMode = .capture
                sidebarSelection = .capture
            }
        }
        .padding(20)
        .multilineTextAlignment(.center)
    }

    private var previewBackgroundColor: Color {
        reduceTransparency ? Color(nsColor: .controlBackgroundColor) : Color.black.opacity(0.08)
    }

    private var dropTargetStrokeColor: Color {
        highContrastEnabled ? Color.accentColor : Color.accentColor.opacity(0.7)
    }

    private var dropTargetLineWidth: CGFloat {
        highContrastEnabled ? 3 : 2
    }
}
