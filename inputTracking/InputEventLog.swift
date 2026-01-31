import Foundation

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

    public static func makeEncoder() -> JSONEncoder {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        return encoder
    }
}
