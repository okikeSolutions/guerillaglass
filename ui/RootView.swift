import SwiftUI
import AppKit
import Capture

public struct RootView: View {
    @StateObject private var captureEngine = CaptureEngine()
    @State private var micEnabled = false

    public init() {}

    public var body: some View {
        VStack(spacing: 16) {
            HStack {
                Button(captureEngine.isRunning ? "Stop Capture" : "Start Capture") {
                    if captureEngine.isRunning {
                        Task {
                            await captureEngine.stopCapture()
                        }
                    } else {
                        captureEngine.clearError()
                        Task {
                            do {
                                try await captureEngine.startDisplayCapture(enableMic: micEnabled)
                            } catch {
                                captureEngine.setErrorMessage(error.localizedDescription)
                            }
                        }
                    }
                }
                .keyboardShortcut(.space, modifiers: [])

                Toggle("Mic", isOn: $micEnabled)
                    .toggleStyle(.switch)
                    .disabled(captureEngine.isRunning)

                if let errorMessage = captureEngine.lastError {
                    Text(errorMessage)
                        .foregroundStyle(.red)
                } else {
                    Text(captureEngine.isRunning ? "Capturing" : "Idle")
                        .foregroundStyle(.secondary)
                }

                Spacer()
            }

            ZStack {
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.black.opacity(0.08))

                if let image = captureEngine.latestFrame {
                    let size = NSSize(width: image.width, height: image.height)
                    Image(nsImage: NSImage(cgImage: image, size: size))
                        .resizable()
                        .scaledToFit()
                        .padding(8)
                } else {
                    Text("Preview")
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(20)
        .frame(minWidth: 900, minHeight: 520)
    }
}
