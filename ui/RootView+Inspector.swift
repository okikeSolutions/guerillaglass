import AppKit
import Export
import SwiftUI

extension RootView {
    var inspectorPane: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Inspector")
                .font(.headline)
                .foregroundStyle(.secondary)

            Form {
                switch navigatorSelection ?? .preview {
                case .preview:
                    Section("Capture Setup") {
                        inspectorRow("Source") {
                            Picker("", selection: $captureSource) {
                                ForEach(CaptureSource.allCases) { source in
                                    Text(source.title).tag(source)
                                }
                            }
                            .pickerStyle(.segmented)
                            .labelsHidden()
                            .accessibilityLabel(Text("Source"))
                            .frame(width: 180)
                            .disabled(captureEngine.isRunning)
                        }

                        if captureSource == .window, !usesSystemPicker {
                            inspectorRow("Window") {
                                HStack(spacing: 6) {
                                    Picker("", selection: $selectedWindowID) {
                                        if captureEngine.availableWindows.isEmpty {
                                            Text("No windows available").tag(CGWindowID(0))
                                        } else {
                                            ForEach(captureEngine.availableWindows) { window in
                                                Text(window.displayName).tag(window.id)
                                            }
                                        }
                                    }
                                    .labelsHidden()
                                    .accessibilityLabel(Text("Window"))
                                    .frame(width: 160)
                                    .disabled(captureEngine.isRunning)

                                    Button("Refresh") {
                                        Task {
                                            await captureEngine.refreshShareableContent()
                                        }
                                    }
                                    .disabled(captureEngine.isRunning)
                                }
                                .frame(maxWidth: .infinity, alignment: .trailing)
                            }
                        }

                        inspectorRow("Microphone") {
                            Toggle("", isOn: $micEnabled)
                                .toggleStyle(.switch)
                                .labelsHidden()
                                .accessibilityLabel(Text("Microphone"))
                                .disabled(captureEngine.isRunning)
                        }
                    }

                    Section("Recording") {
                        inspectorRow("Preset") {
                            Picker("", selection: $selectedPreset) {
                                ForEach(Presets.all) { preset in
                                    Text(preset.name).tag(preset)
                                }
                            }
                            .labelsHidden()
                            .accessibilityLabel(Text("Preset"))
                            .frame(width: 180)
                        }
                    }

                    if studioMode == .edit {
                        Section("Edit") {
                            trimControls
                        }
                    }

                case .clips:
                    Section("Clip Details") {
                        Text("Select a clip to view details.")
                            .foregroundStyle(.secondary)

                        if studioMode == .edit {
                            trimControls
                        }
                    }

                case .notes:
                    Section("Presenter Notes") {
                        Text("Notes will appear here.")
                            .foregroundStyle(.secondary)
                    }
                }

                Section {
                    DisclosureGroup("Diagnostics", isExpanded: $showDiagnostics) {
                        inspectorRow("Recording") {
                            let status: LocalizedStringKey = captureEngine.isRunning ? "Active" : "Idle"
                            Text(status)
                                .foregroundStyle(.secondary)
                        }

                        inspectorRow("Duration") {
                            Text(effectiveDuration, format: .number.precision(.fractionLength(1)))
                                .foregroundStyle(.secondary)
                        }

                        inspectorRow("Export") {
                            let status: LocalizedStringKey = isExporting ? "In Progress" : "Idle"
                            Text(status)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
            .formStyle(.grouped)
            .controlSize(.small)
            .scrollContentBackground(.hidden)
            .background(Color.clear)
            .frame(maxHeight: .infinity, alignment: .top)

            if studioMode == .edit {
                exportButton
            }

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
                .strokeBorder(inspectorBorderColor, lineWidth: inspectorBorderLineWidth)
        )
        .frame(minWidth: 260, idealWidth: 280, maxWidth: 320)
    }

    private func inspectorRow(
        _ title: LocalizedStringKey,
        @ViewBuilder content: () -> some View
    ) -> some View {
        LabeledContent(title) {
            content()
                .frame(maxWidth: .infinity, alignment: .trailing)
        }
        .frame(minHeight: 24)
    }

    private var trimControls: some View {
        Group {
            inspectorRow("Trim In") {
                trimField(value: $trimInSeconds, range: 0 ... effectiveDuration, label: "Trim In")
            }

            inspectorRow("Trim Out") {
                trimField(value: $trimOutSeconds, range: 0 ... effectiveDuration, label: "Trim Out")
            }
        }
    }

    private func trimField(
        value: Binding<Double>,
        range: ClosedRange<Double>,
        label: LocalizedStringKey
    ) -> some View {
        HStack(spacing: 6) {
            TextField(
                "",
                value: value,
                format: .number.precision(.fractionLength(2))
            )
            .multilineTextAlignment(.trailing)
            .frame(width: 64)
            .accessibilityLabel(Text(label))

            Stepper("", value: value, in: range, step: 0.1)
                .labelsHidden()
                .accessibilityLabel(Text(label))
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

    private var inspectorBorderColor: Color {
        highContrastEnabled ? Color(nsColor: .separatorColor) : Color.black.opacity(0.08)
    }

    private var inspectorBorderLineWidth: CGFloat {
        highContrastEnabled ? 2 : 1
    }
}
