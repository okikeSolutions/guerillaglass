import Automation
import AVFoundation
import Darwin
import Foundation
import Project
import Rendering

/// Public class exposed by the macOS engine module.
public final class ExportPipeline {
    private let renderer = ExportRenderer()

    public enum ExportError: LocalizedError {
        case missingVideoTrack
        case cannotCreateSession
        case invalidTimeline(String)
        case failed(Error?)

        public var errorDescription: String? {
            switch self {
            case .missingVideoTrack:
                String(localized: "No video track available for export.")
            case .cannotCreateSession:
                String(localized: "Unable to start export.")
            case let .invalidTimeline(message):
                message
            case let .failed(error):
                error?.localizedDescription ?? String(localized: "Export failed.")
            }
        }
    }

    public init() {}

    public func export(
        recordingURL: URL,
        preset: ExportPreset,
        trimRange: CMTimeRange?,
        outputURL: URL,
        cameraPlan: CameraPlan? = nil,
        timeline: ExportTimelineDocument? = nil,
        backgroundFraming: BackgroundFramingSettings = .defaults
    ) async throws -> URL {
        let asset = AVAsset(url: recordingURL)
        return try await export(
            asset: asset,
            preset: preset,
            trimRange: trimRange,
            outputURL: outputURL,
            cameraPlan: cameraPlan,
            timeline: timeline,
            backgroundFraming: backgroundFraming
        )
    }

    public func export(
        asset: AVAsset,
        preset: ExportPreset,
        trimRange: CMTimeRange?,
        outputURL: URL,
        cameraPlan: CameraPlan? = nil,
        timeline: ExportTimelineDocument? = nil,
        backgroundFraming: BackgroundFramingSettings = .defaults
    ) async throws -> URL {
        let videoTracks = try await asset.loadTracks(withMediaType: .video)
        guard videoTracks.first != nil else {
            throw ExportError.missingVideoTrack
        }

        let timelineComposition: ExportTimelineComposition?
        if let timeline, !timeline.isEmpty {
            let result = try await TimelineCompositionBuilder.makeComposition(asset: asset, timeline: timeline)
            guard !result.items.isEmpty else {
                throw ExportError.invalidTimeline("Timeline does not contain any exportable clips or gaps.")
            }
            timelineComposition = result
        } else {
            timelineComposition = nil
        }
        let exportAsset: AVAsset = timelineComposition?.composition ?? asset

        guard let session = AVAssetExportSession(
            asset: exportAsset,
            presetName: preset.exportPresetName
        ) else {
            throw ExportError.cannotCreateSession
        }
        let replacementDirectoryURL = try makeExportReplacementDirectory(appropriateFor: outputURL)
        defer { try? FileManager.default.removeItem(at: replacementDirectoryURL) }
        let temporaryOutputURL = replacementDirectoryURL
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension(outputURL.pathExtension)

        try rejectSymlinkComponents(in: outputURL)

        if let trimRange {
            session.timeRange = trimRange
        }

        let renderSize = CGSize(width: preset.width, height: preset.height)
        if let timelineComposition {
            session.videoComposition = TimelineVideoCompositionBuilder.makeComposition(
                timelineComposition: timelineComposition,
                renderSize: renderSize,
                frameRate: Double(preset.fps),
                plan: cameraPlan,
                backgroundFraming: backgroundFraming
            )
        } else if let composition = try await renderer.makeVideoComposition(
            asset: asset,
            renderSize: renderSize,
            frameRate: Double(preset.fps),
            plan: cameraPlan,
            backgroundFraming: backgroundFraming
        ) {
            session.videoComposition = composition
        }

        do {
            try await session.export(to: temporaryOutputURL, as: preset.fileType)
        } catch is CancellationError {
            throw CancellationError()
        } catch {
            throw ExportError.failed(error)
        }

        try Task.checkCancellation()
        try installExportFileNoSymlink(from: temporaryOutputURL, to: outputURL)
        try rejectSymlinkComponents(in: outputURL)
        return outputURL
    }
}

private func makeExportReplacementDirectory(appropriateFor outputURL: URL) throws -> URL {
    try FileManager.default.url(
        for: .itemReplacementDirectory,
        in: .userDomainMask,
        appropriateFor: outputURL,
        create: true
    ).resolvingSymlinksInPath()
}

private func installExportFileNoSymlink(from sourceURL: URL, to destinationURL: URL) throws {
    let parentURL = destinationURL.deletingLastPathComponent()
    try rejectSymlinkComponents(in: parentURL)
    try validateReplaceableDestinationNoSymlink(at: destinationURL)

    let installCandidateURL = parentURL.appendingPathComponent(".gg-export-install-\(UUID().uuidString)")
    defer { try? FileManager.default.removeItem(at: installCandidateURL) }
    try copyRegularFileNoFollow(from: sourceURL, to: installCandidateURL)
    try Task.checkCancellation()
    try rejectSymlinkComponents(in: parentURL)
    try validateReplaceableDestinationNoSymlink(at: destinationURL)
    try atomicRename(from: installCandidateURL, to: destinationURL)
}

private func validateReplaceableDestinationNoSymlink(at destinationURL: URL) throws {
    var metadata = stat()
    let status = destinationURL.withUnsafeFileSystemRepresentation { fileSystemPath in
        guard let fileSystemPath else {
            return Int32(-1)
        }
        return Darwin.lstat(fileSystemPath, &metadata)
    }

    if status != 0 {
        if errno == ENOENT {
            return
        }
        throw POSIXError(POSIXErrorCode(rawValue: errno) ?? .EIO)
    }

    let fileType = metadata.st_mode & S_IFMT
    guard fileType == S_IFREG else {
        throw ExportPipeline.ExportError.failed(
            NSError(domain: "GuerillaglassExport", code: Int(EFTYPE), userInfo: [NSLocalizedDescriptionKey: "Export destination already exists and is not a regular file"])
        )
    }
}

private func atomicRename(from sourceURL: URL, to destinationURL: URL) throws {
    let status = sourceURL.withUnsafeFileSystemRepresentation { sourcePath in
        destinationURL.withUnsafeFileSystemRepresentation { destinationPath in
            guard let sourcePath, let destinationPath else { return Int32(-1) }
            return Darwin.rename(sourcePath, destinationPath)
        }
    }
    guard status == 0 else {
        throw POSIXError(POSIXErrorCode(rawValue: errno) ?? .EIO)
    }
}

private func copyRegularFileNoFollow(from sourceURL: URL, to destinationURL: URL) throws {
    let sourceFd = try openNoFollow(sourceURL, flags: O_RDONLY)
    defer { close(sourceFd) }

    var sourceStat = stat()
    guard fstat(sourceFd, &sourceStat) == 0, (sourceStat.st_mode & S_IFMT) == S_IFREG else {
        throw ExportPipeline.ExportError.failed(
            NSError(domain: "GuerillaglassExport", code: Int(EFTYPE), userInfo: [NSLocalizedDescriptionKey: "Export source is not a regular file"])
        )
    }

    let destinationFd = try openNoFollow(destinationURL, flags: O_WRONLY | O_CREAT | O_EXCL, mode: 0o644)
    defer { close(destinationFd) }

    var buffer = [UInt8](repeating: 0, count: 1024 * 1024)
    while true {
        try Task.checkCancellation()
        let bytesRead = buffer.withUnsafeMutableBytes { rawBuffer in
            Darwin.read(sourceFd, rawBuffer.baseAddress, rawBuffer.count)
        }
        if bytesRead == 0 {
            break
        }
        if bytesRead < 0 {
            if errno == EINTR {
                continue
            }
            throw POSIXError(POSIXErrorCode(rawValue: errno) ?? .EIO)
        }

        var written = 0
        while written < bytesRead {
            try Task.checkCancellation()
            let bytesWritten = buffer.withUnsafeBytes { rawBuffer in
                Darwin.write(
                    destinationFd,
                    rawBuffer.baseAddress!.advanced(by: written),
                    bytesRead - written
                )
            }
            if bytesWritten < 0 {
                if errno == EINTR {
                    continue
                }
                throw POSIXError(POSIXErrorCode(rawValue: errno) ?? .EIO)
            }
            written += bytesWritten
        }
    }

    if fsync(destinationFd) != 0 {
        throw POSIXError(POSIXErrorCode(rawValue: errno) ?? .EIO)
    }
}

private func openNoFollow(_ url: URL, flags: Int32, mode: mode_t = 0) throws -> Int32 {
    try url.withUnsafeFileSystemRepresentation { fileSystemPath in
        guard let fileSystemPath else {
            throw ExportPipeline.ExportError.failed(
                NSError(domain: "GuerillaglassExport", code: Int(EINVAL), userInfo: [NSLocalizedDescriptionKey: "Invalid export path"])
            )
        }
        let fd = Darwin.open(fileSystemPath, flags | O_NOFOLLOW | O_CLOEXEC, mode)
        if fd < 0 {
            throw POSIXError(POSIXErrorCode(rawValue: errno) ?? .EIO)
        }
        return fd
    }
}

private func rejectSymlinkComponents(in url: URL) throws {
    let rawPath = url.path
    let isAbsolute = rawPath.hasPrefix("/")
    let components = rawPath.split(separator: "/").map(String.init)
    var currentPath = isAbsolute ? "/" : ""

    for component in components {
        if currentPath.isEmpty {
            currentPath = component
        } else if currentPath == "/" {
            currentPath += component
        } else {
            currentPath += "/\(component)"
        }
        try rejectSymlinkIfExists(atPath: currentPath)
    }
}

private func rejectSymlinkIfExists(atPath path: String) throws {
    var metadata = stat()
    let status = path.withCString { fileSystemPath in
        Darwin.lstat(fileSystemPath, &metadata)
    }
    if status != 0 {
        if errno == ENOENT {
            return
        }
        throw POSIXError(POSIXErrorCode(rawValue: errno) ?? .EIO)
    }
    if (metadata.st_mode & S_IFMT) == S_IFLNK {
        throw ExportPipeline.ExportError.failed(
            NSError(domain: "GuerillaglassExport", code: Int(ELOOP), userInfo: [NSLocalizedDescriptionKey: "Symlink output path component is not allowed: \(path)"])
        )
    }
}
