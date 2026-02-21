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
        try data.write(to: url, options: [.atomic])
    }

    public static func load(from url: URL, decoder: JSONDecoder = InputEventLog.makeDecoder()) throws -> InputEventLog {
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
