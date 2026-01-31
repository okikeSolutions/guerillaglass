import AVFoundation
import Export
import SwiftUI
import UniformTypeIdentifiers

extension RootView {
    @MainActor
    func exportRecording() async {
        guard let recordingURL = captureEngine.recordingURL else { return }
        guard let outputURL = presentExportPanel(preset: selectedPreset) else { return }

        isExporting = true
        exportStatus = nil

        do {
            let duration = playbackModel.duration > 0 ? playbackModel.duration : captureEngine.recordingDuration
            let trimRange = TrimRangeCalculator.timeRange(
                start: trimInSeconds,
                end: trimOutSeconds,
                duration: duration
            )
            let asset = AVAsset(url: recordingURL)
            let cameraPlan = await makeCameraPlan(for: asset)
            _ = try await exportPipeline.export(
                recordingURL: recordingURL,
                preset: selectedPreset,
                trimRange: trimRange,
                outputURL: outputURL,
                cameraPlan: cameraPlan
            )
            exportStatus = String(localized: "Export complete.")
        } catch {
            exportStatus = error.localizedDescription
        }

        isExporting = false
    }

    @MainActor
    private func presentExportPanel(preset: ExportPreset) -> URL? {
        let panel = NSSavePanel()
        panel.title = String(localized: "Save Export")
        panel.nameFieldStringValue = "guerillaglass-export"
        panel.canCreateDirectories = true
        panel.allowedContentTypes = [fileType(for: preset.fileType)]

        let result = panel.runModal()
        guard result == .OK else { return nil }
        return panel.url
    }

    private func fileType(for fileType: AVFileType) -> UTType {
        switch fileType {
        case .mp4:
            .mpeg4Movie
        default:
            .quickTimeMovie
        }
    }
}
