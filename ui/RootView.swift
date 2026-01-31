import AppKit
import Capture
import CoreGraphics
import Export
import Project
import SwiftUI

public struct RootView: View {
    @EnvironmentObject var libraryModel: ProjectLibraryModel
    @Environment(\.openDocument) private var openDocument
    @Environment(\.accessibilityReduceTransparency) var reduceTransparency
    @Binding var document: GuerillaglassDocument
    @StateObject var captureEngine = CaptureEngine()
    @StateObject var playbackModel = RecordingPlaybackModel()
    @StateObject var inputTrackingModel = InputTrackingModel()
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
    @State var highContrastEnabled = NSWorkspace.shared.accessibilityDisplayShouldIncreaseContrast
    @State private var splitPaneFrames: [SplitPane: CGRect] = [:]
    let fileURL: URL?
    let exportPipeline = ExportPipeline()

    public init(document: Binding<GuerillaglassDocument>, fileURL: URL?) {
        _document = document
        self.fileURL = fileURL
    }

    public init() {
        self.init(document: .constant(GuerillaglassDocument()), fileURL: nil)
    }

    public var body: some View {
        NavigationSplitView {
            studioSidebar
        } detail: {
            VStack(spacing: 0) {
                HSplitView {
                    navigatorPane
                        .frame(minWidth: 180, idealWidth: 220, maxWidth: 260)
                        .padding(.trailing, 12)
                        .background(GeometryReader { proxy in
                            Color.clear.preference(
                                key: SplitPaneFramePreferenceKey.self,
                                value: [.navigator: proxy.frame(in: .named("RootSplitView"))]
                            )
                        })

                    previewPanel
                        .frame(minWidth: 520)
                        .padding(.leading, 12)
                        .padding(.trailing, 12)
                        .background(GeometryReader { proxy in
                            Color.clear.preference(
                                key: SplitPaneFramePreferenceKey.self,
                                value: [.preview: proxy.frame(in: .named("RootSplitView"))]
                            )
                        })

                    inspectorPane
                        .padding(.leading, 12)
                        .background(GeometryReader { proxy in
                            Color.clear.preference(
                                key: SplitPaneFramePreferenceKey.self,
                                value: [.inspector: proxy.frame(in: .named("RootSplitView"))]
                            )
                        })
                }
                .coordinateSpace(name: "RootSplitView")
                .onPreferenceChange(SplitPaneFramePreferenceKey.self) { splitPaneFrames = $0 }
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
        .toolbarBackground(.hidden, for: .windowToolbar)
        .focusedValue(
            \.exportCommandHandler,
            ExportCommandHandler(canExport: canExport) { [self] in
                Task {
                    await exportRecording()
                }
            }
        )
        .frame(minWidth: 900, minHeight: 520)
        .task {
            libraryModel.refresh()
            syncDocumentURL(fileURL)
            inputTrackingModel.refreshPermissionStatus()
            if captureSource == .window, !usesSystemPicker {
                await captureEngine.refreshShareableContent()
            }
        }
        .onReceive(
            NotificationCenter.default.publisher(
                for: NSWorkspace.accessibilityDisplayOptionsDidChangeNotification
            )
        ) { _ in
            highContrastEnabled = NSWorkspace.shared.accessibilityDisplayShouldIncreaseContrast
        }
        .onReceive(NotificationCenter.default.publisher(for: NSApplication.didBecomeActiveNotification)) { _ in
            inputTrackingModel.refreshPermissionStatus()
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
            document.updateRecordingSource(newValue)
        }
        .onChange(of: captureEngine.isRunning) { isRunning in
            guard !isRunning else { return }
            do {
                let eventsURL = try inputTrackingModel.stopAndPersist()
                if let eventsURL {
                    document.updateEventsSource(eventsURL)
                }
            } catch {
                captureEngine.setErrorMessage(error.localizedDescription)
            }
        }
        .onChange(of: fileURL) { newValue in
            syncDocumentURL(newValue)
        }
        .onChange(of: playbackModel.duration) { _ in
            clampTrimValues()
        }
        .onChange(of: studioMode) { newValue in
            if newValue == .capture {
                playbackModel.pause()
            }
        }
        .onChange(of: document.projectDocument) { _ in
            syncDocumentURL(fileURL)
        }
        .alert(
            "Input Monitoring Required",
            isPresented: $inputTrackingModel.showPermissionAlert
        ) {
            Button("Open System Settings") {
                inputTrackingModel.openSystemSettings()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Enable Input Monitoring to capture cursor and click events.")
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

    var canExport: Bool {
        captureEngine.recordingURL != nil && !isExporting
    }

    private func syncDocumentURL(_ url: URL?) {
        document.updateProjectURL(url)
        guard let url else { return }
        libraryModel.recordRecent(url: url)

        let recordingURL = url.appendingPathComponent(document.projectDocument.recordingFileName)
        if FileManager.default.fileExists(atPath: recordingURL.path) {
            captureEngine.loadRecording(from: recordingURL)
        } else {
            captureEngine.clearRecording()
        }
    }

    func openRecentProject(_ item: ProjectLibraryItem) {
        guard let url = libraryModel.resolveURL(for: item) else { return }
        Task {
            try? await openDocument(at: url)
        }
    }
}

private enum SplitPane: Hashable {
    case navigator
    case preview
    case inspector
}

private struct SplitPaneFramePreferenceKey: PreferenceKey {
    static var defaultValue: [SplitPane: CGRect] = [:]

    static func reduce(value: inout [SplitPane: CGRect], nextValue: () -> [SplitPane: CGRect]) {
        value.merge(nextValue(), uniquingKeysWith: { _, new in new })
    }
}
