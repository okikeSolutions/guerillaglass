import AppKit
import Capture
import CoreGraphics
import SwiftUI

public struct RootView: View {
    @StateObject private var captureEngine = CaptureEngine()
    @State private var micEnabled = false
    @State private var captureSource: CaptureSource = .display
    @State private var selectedWindowID: CGWindowID = 0

    public init() {}

    public var body: some View {
        VStack(spacing: 16) {
            HStack {
                Button(
                    captureEngine.isRunning ?
                        LocalizedStringKey("Stop Capture") :
                        LocalizedStringKey("Start Capture")
                ) {
                    if captureEngine.isRunning {
                        Task {
                            await captureEngine.stopCapture()
                        }
                    } else {
                        captureEngine.clearError()
                        Task {
                            do {
                                switch captureSource {
                                case .display:
                                    if #available(macOS 14.0, *) {
                                        try await captureEngine.startCaptureUsingPicker(
                                            style: .display,
                                            enableMic: micEnabled
                                        )
                                    } else {
                                        try await captureEngine.startDisplayCapture(enableMic: micEnabled)
                                    }
                                case .window:
                                    if #available(macOS 14.0, *) {
                                        try await captureEngine.startCaptureUsingPicker(
                                            style: .window,
                                            enableMic: micEnabled
                                        )
                                    } else {
                                        guard selectedWindowID != 0 else {
                                            captureEngine.setErrorMessage(
                                                String(localized: "Select a window to capture.")
                                            )
                                            return
                                        }
                                        try await captureEngine.startWindowCapture(
                                            windowID: selectedWindowID,
                                            enableMic: micEnabled
                                        )
                                    }
                                }
                            } catch {
                                captureEngine.setErrorMessage(error.localizedDescription)
                            }
                        }
                    }
                }
                .disabled(
                    !captureEngine.isRunning &&
                        captureSource == .window &&
                        !usesSystemPicker &&
                        selectedWindowID == 0
                )
                .keyboardShortcut(.space, modifiers: [])

                Toggle("Mic", isOn: $micEnabled)
                    .toggleStyle(.switch)
                    .disabled(captureEngine.isRunning)

                Picker("Source", selection: $captureSource) {
                    ForEach(CaptureSource.allCases) { source in
                        Text(source.title).tag(source)
                    }
                }
                .pickerStyle(.segmented)
                .frame(maxWidth: 220)
                .disabled(captureEngine.isRunning)

                if let errorMessage = captureEngine.lastError {
                    Text(errorMessage)
                        .foregroundStyle(.red)
                } else {
                    Text(
                        captureEngine.isRunning ?
                            LocalizedStringKey("Capturing") :
                            LocalizedStringKey("Idle")
                    )
                    .foregroundStyle(.secondary)
                }

                Spacer()
            }

            if captureSource == .window, !usesSystemPicker {
                HStack {
                    Picker("Window", selection: $selectedWindowID) {
                        if captureEngine.availableWindows.isEmpty {
                            Text("No windows available").tag(CGWindowID(0))
                        } else {
                            ForEach(captureEngine.availableWindows) { window in
                                Text(window.displayName).tag(window.id)
                            }
                        }
                    }
                    .frame(maxWidth: 520)
                    .disabled(captureEngine.isRunning)

                    Button("Refresh") {
                        Task {
                            await captureEngine.refreshShareableContent()
                        }
                    }
                    .disabled(captureEngine.isRunning)

                    Spacer()
                }
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
        .task {
            if captureSource == .window, !usesSystemPicker {
                await captureEngine.refreshShareableContent()
            }
        }
        .onChange(of: captureSource) { newValue in
            if newValue == .window, !usesSystemPicker {
                Task {
                    await captureEngine.refreshShareableContent()
                }
            }
        }
        .onChange(of: captureEngine.availableWindows) { windows in
            guard !usesSystemPicker else { return }
            if windows.isEmpty {
                selectedWindowID = 0
                return
            }
            if !windows.contains(where: { $0.id == selectedWindowID }) {
                selectedWindowID = windows[0].id
            }
        }
    }
}

private enum CaptureSource: String, CaseIterable, Identifiable {
    case display
    case window

    var id: String {
        rawValue
    }

    var title: LocalizedStringKey {
        LocalizedStringKey(rawValue.capitalized)
    }
}

private var usesSystemPicker: Bool {
    if #available(macOS 14.0, *) {
        return true
    }
    return false
}
