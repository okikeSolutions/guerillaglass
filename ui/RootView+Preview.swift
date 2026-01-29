import AppKit
import SwiftUI

extension RootView {
    var previewPanel: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.black.opacity(0.08))

            if let image = captureEngine.latestFrame {
                let size = NSSize(width: image.width, height: image.height)
                Image(nsImage: NSImage(cgImage: image, size: size))
                    .resizable()
                    .scaledToFit()
                    .padding(10)
            } else {
                VStack(spacing: 6) {
                    Text(captureEngine.isRunning ? "Waiting for frames…" : "Preview")
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
                    .strokeBorder(Color.accentColor.opacity(0.7), style: StrokeStyle(lineWidth: 2, dash: [6]))
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
}
