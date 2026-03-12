import Foundation
import QuartzCore

/// Public value type exposed by the macOS engine module.
public struct InputClock {
    public let now: () -> TimeInterval

    public init(now: @escaping () -> TimeInterval) {
        self.now = now
    }

    public static let coreAnimation = InputClock {
        CACurrentMediaTime()
    }
}

/// Public class exposed by the macOS engine module.
public final class InputEventRecorder {
    private let queue = DispatchQueue(label: "gg.input.events")
    private let clock: InputClock
    private var startTime: TimeInterval?
    private var isActive = false
    private var events: [InputEvent] = []

    public init(clock: InputClock = .coreAnimation) {
        self.clock = clock
    }

    public func start(referenceTime: TimeInterval? = nil) {
        queue.sync {
            events.removeAll(keepingCapacity: true)
            startTime = referenceTime ?? clock.now()
            isActive = true
        }
    }

    public func record(
        type: InputEventType,
        position: CGPoint,
        button: MouseButton? = nil,
        eventTimestamp: TimeInterval? = nil
    ) {
        queue.async { [weak self] in
            guard let self, isActive, let startTime else { return }
            let now = eventTimestamp ?? clock.now()
            let timestamp = max(0, now - startTime)
            events.append(
                InputEvent(
                    type: type,
                    timestamp: timestamp,
                    position: position,
                    button: button
                )
            )
        }
    }

    public func stop() -> InputEventLog {
        queue.sync {
            isActive = false
            let log = InputEventLog(events: events)
            events.removeAll(keepingCapacity: false)
            startTime = nil
            return log
        }
    }
}

/// Public class exposed by the macOS engine module.
public final class InputEventSession {
    private static let cursorSamplingRateHz = 60.0

    public private(set) var isRunning = false

    private let recorder: InputEventRecorder
    private let cursorTracker: CursorTracker
    private let clickTracker: ClickTracker
    private let samplerQueue = DispatchQueue(label: "gg.input.cursor.sampler")
    private let stateLock = NSLock()
    private var cursorSampler: DispatchSourceTimer?
    private var latestCursorObservation: CursorObservation?
    private var lastEmittedCursorObservation: CursorObservation?
    private var metrics = InputTrackingMetrics()

    public init(clock: InputClock = .coreAnimation) {
        recorder = InputEventRecorder(clock: clock)
        cursorTracker = CursorTracker()
        clickTracker = ClickTracker()
    }

    @MainActor
    public func start(referenceTime: TimeInterval? = nil) {
        guard !isRunning else { return }
        recorder.start(referenceTime: referenceTime)
        resetTrackingState()
        cursorTracker.start { [weak self] position, timestamp in
            self?.observeCursor(position: position, timestamp: timestamp)
        }
        clickTracker.start { [weak self] position, timestamp, button, phase in
            let type: InputEventType = phase == .pressed ? .mouseDown : .mouseUp
            self?.recordClick(
                type: type,
                position: position,
                button: button,
                timestamp: timestamp
            )
        }
        startCursorSampler()
        isRunning = true
    }

    @MainActor
    public func stop() -> InputEventSessionResult {
        guard isRunning else {
            return InputEventSessionResult(log: InputEventLog(events: []), metrics: InputTrackingMetrics())
        }
        stopCursorSampler()
        cursorTracker.stop()
        clickTracker.stop()
        isRunning = false
        let metrics = consumeMetrics()
        return InputEventSessionResult(log: recorder.stop(), metrics: metrics)
    }
}

private extension InputEventSession {
    struct CursorObservation {
        let position: CGPoint
        let timestamp: TimeInterval
    }

    func resetTrackingState() {
        stateLock.lock()
        latestCursorObservation = nil
        lastEmittedCursorObservation = nil
        metrics = InputTrackingMetrics()
        stateLock.unlock()
    }

    func consumeMetrics() -> InputTrackingMetrics {
        stateLock.lock()
        defer { stateLock.unlock() }
        return metrics
    }

    func observeCursor(position: CGPoint, timestamp: TimeInterval) {
        stateLock.lock()
        latestCursorObservation = CursorObservation(position: position, timestamp: timestamp)
        metrics = InputTrackingMetrics(
            cursorEventsObserved: metrics.cursorEventsObserved + 1,
            cursorEventsEmitted: metrics.cursorEventsEmitted,
            clickEventsEmitted: metrics.clickEventsEmitted
        )
        stateLock.unlock()
    }

    func recordClick(
        type: InputEventType,
        position: CGPoint,
        button: MouseButton,
        timestamp: TimeInterval
    ) {
        stateLock.lock()
        metrics = InputTrackingMetrics(
            cursorEventsObserved: metrics.cursorEventsObserved,
            cursorEventsEmitted: metrics.cursorEventsEmitted,
            clickEventsEmitted: metrics.clickEventsEmitted + 1
        )
        stateLock.unlock()

        recorder.record(
            type: type,
            position: position,
            button: button,
            eventTimestamp: timestamp
        )
    }

    func startCursorSampler() {
        stopCursorSampler()
        let timer = DispatchSource.makeTimerSource(queue: samplerQueue)
        let intervalMs = Int((1.0 / Self.cursorSamplingRateHz) * 1000)
        timer.schedule(
            deadline: .now(),
            repeating: .milliseconds(max(1, intervalMs)),
            leeway: .milliseconds(2)
        )
        timer.setEventHandler { [weak self] in
            self?.emitLatestCursorObservation()
        }
        cursorSampler = timer
        timer.activate()
    }

    func stopCursorSampler() {
        cursorSampler?.setEventHandler {}
        cursorSampler?.cancel()
        cursorSampler = nil
    }

    func emitLatestCursorObservation() {
        stateLock.lock()
        guard let latestCursorObservation else {
            stateLock.unlock()
            return
        }

        if let lastEmittedCursorObservation, lastEmittedCursorObservation.position == latestCursorObservation.position {
            stateLock.unlock()
            return
        }

        lastEmittedCursorObservation = latestCursorObservation
        metrics = InputTrackingMetrics(
            cursorEventsObserved: metrics.cursorEventsObserved,
            cursorEventsEmitted: metrics.cursorEventsEmitted + 1,
            clickEventsEmitted: metrics.clickEventsEmitted
        )
        stateLock.unlock()

        recorder.record(
            type: .cursorMoved,
            position: latestCursorObservation.position,
            eventTimestamp: latestCursorObservation.timestamp
        )
    }
}
