import Darwin
import Foundation

/// Codable benchmark sidecar stored next to captured input events.
public struct InputTrackingMetricsStore: Codable, Equatable {
    public static let schemaVersion = 1

    public let schemaVersion: Int
    public let metrics: InputTrackingMetrics

    public init(
        metrics: InputTrackingMetrics,
        schemaVersion: Int = InputTrackingMetricsStore.schemaVersion
    ) {
        self.schemaVersion = schemaVersion
        self.metrics = metrics
    }

    public func write(
        to url: URL,
        encoder: JSONEncoder = InputEventLog.makeEncoder()
    ) throws {
        let data = try encoder.encode(self)
        try writeDataNoSymlink(data, to: url)
    }
}

private func writeDataNoSymlink(_ data: Data, to destinationURL: URL) throws {
    try rejectSymlinkComponents(in: destinationURL)
    try data.write(to: destinationURL, options: [.atomic])
    try rejectSymlinkComponents(in: destinationURL)
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
    let status = path.withCString { Darwin.lstat($0, &metadata) }
    if status != 0 {
        if errno == ENOENT {
            return
        }
        throw POSIXError(POSIXErrorCode(rawValue: errno) ?? .EIO)
    }
    if (metadata.st_mode & S_IFMT) == S_IFLNK {
        throw NSError(domain: "GuerillaglassInputTracking", code: Int(ELOOP), userInfo: [NSLocalizedDescriptionKey: "Symlink path component is not allowed: \(path)"])
    }
}
