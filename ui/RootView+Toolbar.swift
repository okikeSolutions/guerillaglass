import AppKit
import Capture
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
                            let eventsURL = await MainActor.run {
                                inputTrackingModel.stopAndPersist()
                            }
                            if let eventsURL {
                                await MainActor.run {
                                    document.updateEventsSource(eventsURL)
                                }
                            }
                        } else {
                            if !captureEngine.isRunning {
                                try await startCaptureFlow()
                            }
                            try await captureEngine.startRecording()
                            let referenceTime = CaptureClock().now().seconds
                            await MainActor.run {
                                inputTrackingModel.startIfPermitted(referenceTime: referenceTime)
                            }
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

                let statusLabel: LocalizedStringKey = captureEngine.isRecording ? "Recording" : "Ready"
                HStack(spacing: 8) {
                    Text(timecodeText)
                        .font(.system(.subheadline, design: .monospaced))
                    Text(statusLabel)
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
            .help(String(localized: "More"))
            .accessibilityLabel(Text("More"))
        }
    }

    private var statusBadge: some View {
        let title: LocalizedStringKey
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
            .background(color.opacity(statusBadgeOpacity))
            .clipShape(Capsule())
            .foregroundStyle(color)
    }

    private var statusBadgeOpacity: Double {
        if highContrastEnabled {
            return reduceTransparency ? 0.4 : 0.25
        }
        return reduceTransparency ? 0.3 : 0.15
    }

    private var timecodeText: String {
        let totalSeconds = max(0, Int(captureEngine.recordingDuration))
        let duration = Duration.seconds(Int64(totalSeconds))
        return duration.formatted(.time(pattern: .minuteSecond))
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
