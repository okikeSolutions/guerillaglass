import AppKit
import SwiftUI

extension RootView {
    @ToolbarContentBuilder
    var rootToolbar: some ToolbarContent {
        ToolbarItem(placement: .principal) {
            Picker("Mode", selection: $studioMode) {
                ForEach(StudioMode.allCases) { mode in
                    Text(mode.title).tag(mode)
                }
            }
            .pickerStyle(.segmented)
            .frame(width: 200)
        }

        ToolbarItemGroup(placement: .primaryAction) {
            Button {
                Task {
                    captureEngine.clearError()
                    if captureEngine.isRunning {
                        await captureEngine.stopCapture()
                    } else {
                        do {
                            try await startCaptureFlow()
                        } catch {
                            captureEngine.setErrorMessage(error.localizedDescription)
                        }
                    }
                }
            } label: {
                Label(
                    captureEngine.isRunning ? String(localized: "Stop Preview") : String(localized: "Preview"),
                    systemImage: captureEngine.isRunning ? "stop.circle.fill" : "eye"
                )
            }
            .labelStyle(.titleAndIcon)
            .disabled(!captureEngine.isRunning && !canStartCapture || captureEngine.isRecording)

            Button {
                Task {
                    captureEngine.clearError()
                    do {
                        if captureEngine.isRecording {
                            await captureEngine.stopRecording()
                            await captureEngine.stopCapture()
                        } else {
                            if !captureEngine.isRunning {
                                try await startCaptureFlow()
                            }
                            try await captureEngine.startRecording()
                        }
                    } catch {
                        captureEngine.setErrorMessage(error.localizedDescription)
                        if captureEngine.isRunning, !captureEngine.isRecording {
                            await captureEngine.stopCapture()
                        }
                    }
                }
            } label: {
                Label(
                    captureEngine.isRecording ? String(localized: "Stop") : String(localized: "Record"),
                    systemImage: captureEngine.isRecording ? "stop.fill" : "record.circle"
                )
            }
            .labelStyle(.titleAndIcon)
            .disabled(!captureEngine.isRunning && !canStartCapture)
            .keyboardShortcut(.space, modifiers: [])

            Button {
                Task {
                    await exportRecording()
                }
            } label: {
                Label("Export", systemImage: "square.and.arrow.up")
            }
            .labelStyle(.titleAndIcon)
            .disabled(captureEngine.recordingURL == nil || isExporting)
        }

        ToolbarItemGroup(placement: .status) {
            HStack(spacing: 10) {
                statusBadge

                HStack(spacing: 8) {
                    Text(timecodeText)
                        .font(.system(.subheadline, design: .monospaced))
                    Text(captureEngine.isRecording ? "Recording" : "Ready")
                        .foregroundStyle(.secondary)
                }
            }
            .padding(.horizontal, 6)
        }

        ToolbarItem(placement: .automatic) {
            Menu {
                Button("Switch to Capture Mode") {
                    studioMode = .capture
                    sidebarSelection = .capture
                }
                Button("Switch to Edit Mode") {
                    studioMode = .edit
                    sidebarSelection = .edit
                }
            } label: {
                Image(systemName: "ellipsis.circle")
            }
            .help("More")
        }
    }

    private var statusBadge: some View {
        let title: String
        let color: Color

        if captureEngine.isRecording {
            title = "Recording"
            color = .red
        } else if captureEngine.isRunning {
            title = "Capturing"
            color = .green
        } else {
            title = "Idle"
            color = .secondary
        }

        return Text(title)
            .font(.subheadline.weight(.semibold))
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(color.opacity(0.15))
            .clipShape(Capsule())
            .foregroundStyle(color)
    }

    private var timecodeText: String {
        let totalSeconds = max(0, Int(captureEngine.recordingDuration))
        let minutes = totalSeconds / 60
        let seconds = totalSeconds % 60
        return String(format: "%02d:%02d", minutes, seconds)
    }

    private var canStartCapture: Bool {
        if captureSource == .window, !usesSystemPicker, selectedWindowID == 0 {
            return false
        }
        return true
    }

    private func startCaptureFlow() async throws {
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
    }
}
