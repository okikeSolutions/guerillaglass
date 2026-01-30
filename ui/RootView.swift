import Capture
import CoreGraphics
import Export
import SwiftUI

public struct RootView: View {
    @StateObject var captureEngine = CaptureEngine()
    @StateObject var playbackModel = RecordingPlaybackModel()
    @State var micEnabled = false
    @State var captureSource: CaptureSource = .display
    @State var selectedWindowID: CGWindowID = 0
    @State var studioMode: StudioMode = .capture
    @State var sidebarSelection: SidebarItem = .capture
    @State var navigatorSelection: NavigatorItem? = .preview
    @State var selectedPreset: ExportPreset = Presets.default
    @State var trimInSeconds: Double = 0
    @State var trimOutSeconds: Double = 0
    @State var exportStatus: String?
    @State var isExporting = false
    @State var showDiagnostics = false
    @State var isNavigatorDropTarget = false
    @State var isPreviewDropTarget = false
    let exportPipeline = ExportPipeline()

    public init() {}

    public var body: some View {
        NavigationSplitView {
            studioSidebar
        } detail: {
            VStack(spacing: 0) {
                HSplitView {
                    navigatorPane
                        .frame(minWidth: 180, idealWidth: 220, maxWidth: 260)
                        .padding(.trailing, 12)

                    previewPanel
                        .frame(minWidth: 520)
                        .padding(.leading, 12)
                        .padding(.trailing, 12)

                    inspectorPane
                        .padding(.leading, 12)
                }
                .padding(20)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .background(Color(nsColor: .windowBackgroundColor))
            .navigationTitle("Guerilla Glass")
            .applyToolbarTitleDisplayModeInline()
        }
        .navigationSplitViewStyle(.balanced)
        .toolbar {
            rootToolbar
        }
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
        .onChange(of: captureEngine.recordingDuration) { duration in
            if duration > 0 {
                trimInSeconds = 0
                trimOutSeconds = duration
            }
        }
        .onChange(of: captureEngine.recordingURL) { newValue in
            playbackModel.load(url: newValue)
        }
        .onChange(of: playbackModel.duration) { _ in
            clampTrimValues()
        }
        .onChange(of: trimInSeconds) { _ in
            clampTrimValues()
        }
        .onChange(of: trimOutSeconds) { _ in
            clampTrimValues()
        }
        .onChange(of: studioMode) { newValue in
            if newValue == .capture {
                playbackModel.pause()
            }
        }
    }

    private func clampTrimValues() {
        let duration = effectiveDuration
        guard let clamped = TrimRangeCalculator.clamped(
            start: trimInSeconds,
            end: trimOutSeconds,
            duration: duration
        ) else { return }

        if trimInSeconds != clamped.start {
            trimInSeconds = clamped.start
        }

        if trimOutSeconds != clamped.end {
            trimOutSeconds = clamped.end
        }
    }

    var effectiveDuration: Double {
        let playbackDuration = playbackModel.duration
        return playbackDuration > 0 ? playbackDuration : captureEngine.recordingDuration
    }
}
