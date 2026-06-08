import Darwin
import Foundation

/// Public value type exposed by the macOS engine module.
public struct InputEventLog: Codable, Equatable {
    public static let schemaVersion = 1

    public let schemaVersion: Int
    public let events: [InputEvent]

    public init(events: [InputEvent], schemaVersion: Int = InputEventLog.schemaVersion) {
        self.schemaVersion = schemaVersion
        self.events = events
    }

    public func write(to url: URL, encoder: JSONEncoder = InputEventLog.makeEncoder()) throws {
        let data = try encoder.encode(self)
        try writeDataNoSymlink(data, to: url)
    }

    public static func load(from url: URL, decoder: JSONDecoder = InputEventLog.makeDecoder()) throws -> InputEventLog {
        try rejectSymlinkComponents(in: url)
        let data = try Data(contentsOf: url)
        return try decoder.decode(InputEventLog.self, from: data)
    }

    public static func makeEncoder() -> JSONEncoder {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        return encoder
    }

    public static func makeDecoder() -> JSONDecoder {
        JSONDecoder()
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
        if currentPath.isEmpty { currentPath = component }
        else if currentPath == "/" { currentPath += component }
        else { currentPath += "/\(component)" }
        try rejectSymlinkIfExists(atPath: currentPath)
    }
}

private func rejectSymlinkIfExists(atPath path: String) throws {
    var metadata = stat()
    let status = path.withCString { Darwin.lstat($0, &metadata) }
    if status != 0 {
        if errno == ENOENT { return }
        throw POSIXError(POSIXErrorCode(rawValue: errno) ?? .EIO)
    }
    if (metadata.st_mode & S_IFMT) == S_IFLNK {
        throw NSError(domain: "GuerillaglassInputTracking", code: Int(ELOOP), userInfo: [NSLocalizedDescriptionKey: "Symlink path component is not allowed: \(path)"])
    }
}
