import AVFoundation
import Foundation

public struct ExportPreset: Identifiable, Hashable {
    public let id: String
    public let name: String
    public let width: Int
    public let height: Int
    public let fps: Int
    public let codec: AVVideoCodecType
    public let fileType: AVFileType
    public let exportPresetName: String

    public init(
        id: String,
        name: String,
        width: Int,
        height: Int,
        fps: Int,
        codec: AVVideoCodecType,
        fileType: AVFileType,
        exportPresetName: String
    ) {
        self.id = id
        self.name = name
        self.width = width
        self.height = height
        self.fps = fps
        self.codec = codec
        self.fileType = fileType
        self.exportPresetName = exportPresetName
    }
}

public enum Presets {
    public static let h2641080p30 = ExportPreset(
        id: "h264-1080p-30",
        name: "1080p 30fps (H.264)",
        width: 1920,
        height: 1080,
        fps: 30,
        codec: .h264,
        fileType: .mp4,
        exportPresetName: AVAssetExportPreset1920x1080
    )
    public static let h2641080p60 = ExportPreset(
        id: "h264-1080p-60",
        name: "1080p 60fps (H.264)",
        width: 1920,
        height: 1080,
        fps: 60,
        codec: .h264,
        fileType: .mp4,
        exportPresetName: AVAssetExportPreset1920x1080
    )
    public static let h2654k30 = ExportPreset(
        id: "h265-4k-30",
        name: "4K 30fps (H.265)",
        width: 3840,
        height: 2160,
        fps: 30,
        codec: .hevc,
        fileType: .mov,
        exportPresetName: AVAssetExportPreset3840x2160
    )
    public static let h264Vertical1080p30 = ExportPreset(
        id: "h264-vertical-1080p-30",
        name: "1080×1920 30fps (H.264)",
        width: 1080,
        height: 1920,
        fps: 30,
        codec: .h264,
        fileType: .mp4,
        exportPresetName: AVAssetExportPresetHighestQuality
    )

    public static let all: [ExportPreset] = [
        h2641080p30,
        h2641080p60,
        h2654k30,
        h264Vertical1080p30
    ]

    public static let `default` = h2641080p30
}
