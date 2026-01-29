import Export
import SwiftUI

extension RootView {
    var inspectorPane: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Inspector")
                .font(.headline)
                .foregroundStyle(.secondary)

            switch navigatorSelection ?? .preview {
            case .preview:
                inspectorSection("Capture Setup", isExpanded: $showCaptureSetup) {
                    Picker("Source", selection: $captureSource) {
                        ForEach(CaptureSource.allCases) { source in
                            Text(source.title).tag(source)
                        }
                    }
                    .pickerStyle(.segmented)
                    .disabled(captureEngine.isRunning)

                    if captureSource == .window, !usesSystemPicker {
                        Picker("Window", selection: $selectedWindowID) {
                            if captureEngine.availableWindows.isEmpty {
                                Text("No windows available").tag(CGWindowID(0))
                            } else {
                                ForEach(captureEngine.availableWindows) { window in
                                    Text(window.displayName).tag(window.id)
                                }
                            }
                        }
                        .disabled(captureEngine.isRunning)

                        Button("Refresh Windows") {
                            Task {
                                await captureEngine.refreshShareableContent()
                            }
                        }
                        .disabled(captureEngine.isRunning)
                    }

                    Toggle("Microphone", isOn: $micEnabled)
                        .toggleStyle(.switch)
                        .disabled(captureEngine.isRunning)
                }

                inspectorSection("Recording", isExpanded: $showRecording) {
                    Picker("Preset", selection: $selectedPreset) {
                        ForEach(Presets.all) { preset in
                            Text(preset.name).tag(preset)
                        }
                    }
                    .frame(maxWidth: .infinity)
                }

                inspectorSection("Edit & Export", isExpanded: $showEditExport) {
                    trimControls
                    exportButton
                }

            case .clips:
                inspectorSection("Clip Details", isExpanded: $showEditExport) {
                    Text("Select a clip to view details.")
                        .foregroundStyle(.secondary)
                    trimControls
                    exportButton
                }

            case .notes:
                inspectorSection("Presenter Notes", isExpanded: $showEditExport) {
                    Text("Notes will appear here.")
                        .foregroundStyle(.secondary)
                }
            }

            Spacer()

            if isExporting {
                Text("Exporting...")
                    .foregroundStyle(.secondary)
            } else if let exportStatus {
                Text(exportStatus)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.leading, 10)
        .padding(8)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .strokeBorder(Color.black.opacity(0.08))
        )
        .frame(minWidth: 260, idealWidth: 280, maxWidth: 320)
    }

    private func inspectorSection(
        _ title: String,
        isExpanded: Binding<Bool>,
        @ViewBuilder content: @escaping () -> some View
    ) -> some View {
        DisclosureGroup(title, isExpanded: isExpanded) {
            VStack(alignment: .leading, spacing: 10) {
                content()
            }
            .padding(.top, 6)
        }
        .padding(10)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(Color.black.opacity(0.04))
        )
    }

    private var trimControls: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Text("Trim In")
                TextField(
                    "",
                    value: $trimInSeconds,
                    format: .number.precision(.fractionLength(2))
                )
                .frame(width: 70)
            }

            HStack(spacing: 8) {
                Text("Trim Out")
                TextField(
                    "",
                    value: $trimOutSeconds,
                    format: .number.precision(.fractionLength(2))
                )
                .frame(width: 70)
            }
        }
    }

    private var exportButton: some View {
        Button("Export Recording") {
            Task {
                await exportRecording()
            }
        }
        .disabled(captureEngine.recordingURL == nil || isExporting)
    }
}
