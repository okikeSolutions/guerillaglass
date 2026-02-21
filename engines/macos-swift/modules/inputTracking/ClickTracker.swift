import AppKit
import Foundation

/// Public class exposed by the macOS engine module.
public final class ClickTracker {
    public enum Phase {
        case pressed
        case released
    }

    public typealias Handler = (
        _ position: CGPoint,
        _ timestamp: TimeInterval,
        _ button: MouseButton,
        _ phase: Phase
    ) -> Void

    private let eventMask: NSEvent.EventTypeMask = [
        .leftMouseDown,
        .leftMouseUp,
        .rightMouseDown,
        .rightMouseUp,
        .otherMouseDown,
        .otherMouseUp
    ]
    private var globalMonitor: Any?
    private var localMonitor: Any?
    private var handler: Handler?

    public init() {}

    @MainActor
    public func start(handler: @escaping Handler) {
        guard globalMonitor == nil, localMonitor == nil else { return }
        self.handler = handler
        globalMonitor = NSEvent.addGlobalMonitorForEvents(matching: eventMask) { [weak self] event in
            self?.handle(event)
        }
        localMonitor = NSEvent.addLocalMonitorForEvents(matching: eventMask) { [weak self] event in
            self?.handle(event)
            return event
        }
    }

    @MainActor
    public func stop() {
        if let globalMonitor {
            NSEvent.removeMonitor(globalMonitor)
        }
        if let localMonitor {
            NSEvent.removeMonitor(localMonitor)
        }
        globalMonitor = nil
        localMonitor = nil
        handler = nil
    }

    private func handle(_ event: NSEvent) {
        guard let (button, phase) = Self.mapEvent(event) else { return }
        let position = NSEvent.mouseLocation
        handler?(position, event.timestamp, button, phase)
    }

    private static func mapEvent(_ event: NSEvent) -> (MouseButton, Phase)? {
        switch event.type {
        case .leftMouseDown:
            (.left, .pressed)
        case .leftMouseUp:
            (.left, .released)
        case .rightMouseDown:
            (.right, .pressed)
        case .rightMouseUp:
            (.right, .released)
        case .otherMouseDown:
            (.other, .pressed)
        case .otherMouseUp:
            (.other, .released)
        default:
            nil
        }
    }
}
