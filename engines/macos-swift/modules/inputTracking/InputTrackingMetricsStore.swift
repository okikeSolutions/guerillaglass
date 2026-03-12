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
        try data.write(to: url, options: [.atomic])
    }
}
