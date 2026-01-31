import Foundation
import QuartzCore

public struct InputClock {
    public let now: () -> TimeInterval

    public init(now: @escaping () -> TimeInterval) {
        self.now = now
    }

    public static let coreAnimation = InputClock {
        CACurrentMediaTime()
    }
}

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

public final class InputEventSession {
    public private(set) var isRunning = false

    private let recorder: InputEventRecorder
    private let cursorTracker: CursorTracker
    private let clickTracker: ClickTracker

    public init(clock: InputClock = .coreAnimation) {
        recorder = InputEventRecorder(clock: clock)
        cursorTracker = CursorTracker()
        clickTracker = ClickTracker()
    }

    @MainActor
    public func start(referenceTime: TimeInterval? = nil) {
        guard !isRunning else { return }
        recorder.start(referenceTime: referenceTime)
        cursorTracker.start { [weak self] position, timestamp in
            self?.recorder.record(
                type: .cursorMoved,
                position: position,
                eventTimestamp: timestamp
            )
        }
        clickTracker.start { [weak self] position, timestamp, button, phase in
            let type: InputEventType = phase == .pressed ? .mouseDown : .mouseUp
            self?.recorder.record(
                type: type,
                position: position,
                button: button,
                eventTimestamp: timestamp
            )
        }
        isRunning = true
    }

    @MainActor
    public func stop() -> InputEventLog {
        guard isRunning else { return InputEventLog(events: []) }
        cursorTracker.stop()
        clickTracker.stop()
        isRunning = false
        return recorder.stop()
    }
}
