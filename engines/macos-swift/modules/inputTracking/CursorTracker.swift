import AppKit
import Foundation

/// Public class exposed by the macOS engine module.
public final class CursorTracker {
    public typealias Handler = (_ position: CGPoint, _ timestamp: TimeInterval) -> Void

    private let eventMask: NSEvent.EventTypeMask = [
        .mouseMoved,
        .leftMouseDragged,
        .rightMouseDragged,
        .otherMouseDragged
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
        let position = NSEvent.mouseLocation
        handler?(position, event.timestamp)
    }
}
