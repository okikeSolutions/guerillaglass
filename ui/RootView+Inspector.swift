import AppKit
import Export
import Project
import SwiftUI

extension RootView {
    var inspectorPane: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Inspector")
                .font(.headline)
                .foregroundStyle(.secondary)

            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    switch navigatorSelection ?? .preview {
                    case .preview:
                        inspectorCard("Capture Setup") {
                            inspectorSection {
                                inspectorRow("Source") {
                                    Picker("", selection: $captureSource) {
                                        ForEach(CaptureSource.allCases) { source in
                                            Text(source.title).tag(source)
                                        }
                                    }
                                    .pickerStyle(.segmented)
                                    .labelsHidden()
                                    .accessibilityLabel(Text("Source"))
                                    .frame(maxWidth: .infinity)
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
                                            .frame(maxWidth: .infinity)
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

                                inspectorRow("Cursor + Clicks") {
                                    Toggle(
                                        "",
                                        isOn: Binding(
                                            get: { inputTrackingModel.isEnabled },
                                            set: { inputTrackingModel.setEnabled($0) }
                                        )
                                    )
                                    .toggleStyle(.switch)
                                    .labelsHidden()
                                    .accessibilityLabel(Text("Cursor + Clicks"))
                                    .disabled(captureEngine.isRecording)
                                }

                                if inputTrackingModel.permissionStatus == .denied {
                                    inspectorFootnote(
                                        "Input Monitoring permission is required to track cursor and clicks."
                                    )
                                }
                            }
                        }

                        inspectorCard("Recording") {
                            inspectorSection {
                                inspectorRow("Preset") {
                                    Picker("", selection: $selectedPreset) {
                                        ForEach(Presets.all) { preset in
                                            Text(preset.name).tag(preset)
                                        }
                                    }
                                    .labelsHidden()
                                    .accessibilityLabel(Text("Preset"))
                                    .frame(maxWidth: .infinity)
                                }
                            }
                        }

                        inspectorCard("Auto-Zoom") {
                            inspectorSection {
                                inspectorRow("Enabled") {
                                    Toggle("", isOn: autoZoomEnabledBinding)
                                        .toggleStyle(.switch)
                                        .labelsHidden()
                                        .accessibilityLabel(Text("Auto-Zoom"))
                                }

                                inspectorRow("Intensity") {
                                    HStack(spacing: 8) {
                                        Slider(
                                            value: autoZoomIntensityBinding,
                                            in: AutoZoomSettings.intensityRange
                                        )
                                        .frame(maxWidth: .infinity)
                                        .accessibilityLabel(Text("Auto-Zoom Intensity"))

                                        Text(autoZoomIntensityLabel)
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                            .frame(width: 44, alignment: .trailing)
                                            .lineLimit(1)
                                    }
                                }
                                .disabled(!autoZoomSettings.isEnabled)

                                inspectorRow("Keyframe Interval") {
                                    HStack(spacing: 8) {
                                        Slider(
                                            value: autoZoomKeyframeIntervalBinding,
                                            in: AutoZoomSettings.minimumKeyframeIntervalRange
                                        )
                                        .frame(maxWidth: .infinity)
                                        .accessibilityLabel(Text("Auto-Zoom Keyframe Interval"))

                                        Text(autoZoomKeyframeIntervalLabel)
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                            .frame(width: 44, alignment: .trailing)
                                            .lineLimit(1)
                                    }
                                }
                                .disabled(!autoZoomSettings.isEnabled)

                                if autoZoomSettings.isEnabled, inputTrackingModel.permissionStatus == .denied {
                                    inspectorFootnote(
                                        "Enable Input Monitoring to capture cursor and click events for Auto-Zoom."
                                    )
                                }
                            }
                        }

                        if studioMode == .edit {
                            inspectorCard("Edit") {
                                inspectorSection {
                                    trimControls
                                }
                            }
                        }

                    case .clips:
                        inspectorCard("Clip Details") {
                            inspectorSection {
                                Text("Select a clip to view details.")
                                    .foregroundStyle(.secondary)

                                if studioMode == .edit {
                                    trimControls
                                }
                            }
                        }

                    case .notes:
                        inspectorCard("Presenter Notes") {
                            inspectorSection {
                                Text("Notes will appear here.")
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }

                    inspectorDisclosureCard("Diagnostics", isExpanded: $showDiagnostics) {
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
                .frame(maxWidth: .infinity, alignment: .topLeading)
                .padding(.vertical, 4)
                .padding(.horizontal, 6)
            }
            .controlSize(.small)
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
        .padding(8)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .strokeBorder(inspectorBorderColor, lineWidth: inspectorBorderLineWidth)
        )
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .frame(minWidth: 260, idealWidth: 280, maxWidth: 320)
    }

    private func inspectorRow(
        _ title: LocalizedStringKey,
        @ViewBuilder content: @escaping () -> some View
    ) -> some View {
        GeometryReader { proxy in
            let spacing: CGFloat = 10
            let totalWidth = proxy.size.width
            let labelWidth = min(inspectorLabelWidth, totalWidth * 0.45)
            let contentWidth = max(0, totalWidth - labelWidth - spacing)
            HStack(alignment: .center, spacing: spacing) {
                Text(title)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .frame(width: labelWidth, alignment: .leading)
                content()
                    .frame(width: contentWidth, alignment: .trailing)
            }
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

    private func inspectorCard(
        _ title: LocalizedStringKey,
        @ViewBuilder content: () -> some View
    ) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            inspectorCardHeader(title)
            content()
        }
        .padding(10)
        .background(
            RoundedRectangle(cornerRadius: 10)
                .fill(cardBackgroundColor)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .strokeBorder(cardBorderColor, lineWidth: cardBorderLineWidth)
        )
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func inspectorDisclosureCard(
        _ title: LocalizedStringKey,
        isExpanded: Binding<Bool>,
        @ViewBuilder content: @escaping () -> some View
    ) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            DisclosureGroup(isExpanded: isExpanded) {
                VStack(alignment: .leading, spacing: 8) {
                    content()
                }
                .padding(.top, 4)
            } label: {
                inspectorCardHeader(title)
            }
        }
        .padding(10)
        .background(
            RoundedRectangle(cornerRadius: 10)
                .fill(cardBackgroundColor)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .strokeBorder(cardBorderColor, lineWidth: cardBorderLineWidth)
        )
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func inspectorCardHeader(_ title: LocalizedStringKey) -> some View {
        HStack {
            Text(title)
                .font(.subheadline.weight(.semibold))
            Spacer()
        }
    }

    private func inspectorSection(@ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 8, content: content)
    }

    private func inspectorFootnote(_ text: LocalizedStringKey) -> some View {
        Text(text)
            .font(.caption)
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var inspectorLabelWidth: CGFloat {
        90
    }

    private var cardBackgroundColor: Color {
        reduceTransparency ? Color(nsColor: .controlBackgroundColor) : Color.black.opacity(0.04)
    }

    private var cardBorderColor: Color {
        highContrastEnabled ? Color(nsColor: .separatorColor) : Color.black.opacity(0.08)
    }

    private var cardBorderLineWidth: CGFloat {
        highContrastEnabled ? 2 : 1
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
