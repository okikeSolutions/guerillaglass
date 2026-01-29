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
            let trimRange = makeTrimRange(duration: captureEngine.recordingDuration)
            _ = try await exportPipeline.export(
                recordingURL: recordingURL,
                preset: selectedPreset,
                trimRange: trimRange,
                outputURL: outputURL
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

    private func makeTrimRange(duration: Double) -> CMTimeRange? {
        guard duration > 0 else { return nil }
        let start = max(0, min(trimInSeconds, duration))
        var end = trimOutSeconds
        if end <= 0 || end > duration {
            end = duration
        }
        if end <= start {
            return nil
        }
        return CMTimeRange(
            start: CMTime(seconds: start, preferredTimescale: 600),
            duration: CMTime(seconds: end - start, preferredTimescale: 600)
        )
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
