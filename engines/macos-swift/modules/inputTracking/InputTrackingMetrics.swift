import Foundation

/// Benchmark-facing counters describing input tracking event coalescing.
public struct InputTrackingMetrics: Codable, Equatable {
    public let cursorEventsObserved: Int
    public let cursorEventsEmitted: Int
    public let clickEventsEmitted: Int

    public init(
        cursorEventsObserved: Int = 0,
        cursorEventsEmitted: Int = 0,
        clickEventsEmitted: Int = 0
    ) {
        self.cursorEventsObserved = cursorEventsObserved
        self.cursorEventsEmitted = cursorEventsEmitted
        self.clickEventsEmitted = clickEventsEmitted
    }
}

/// Result returned when an input recording session stops.
public struct InputEventSessionResult: Equatable {
    public let log: InputEventLog
    public let metrics: InputTrackingMetrics

    public init(log: InputEventLog, metrics: InputTrackingMetrics) {
        self.log = log
        self.metrics = metrics
    }
}
