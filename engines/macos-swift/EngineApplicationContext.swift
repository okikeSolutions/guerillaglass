import AppKit

@MainActor
final class EngineApplicationDelegate: NSObject, NSApplicationDelegate {
    var window: NSWindow?
}

@MainActor
enum EngineApplicationContext {
    private static let delegate = EngineApplicationDelegate()

    static func prepareIfNeeded() {
        let application = NSApplication.shared
        if application.delegate !== delegate {
            application.setActivationPolicy(.accessory)
            application.delegate = delegate
        }

        guard delegate.window == nil else {
            return
        }

        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1, height: 1),
            styleMask: [.borderless],
            backing: .buffered,
            defer: false
        )
        window.isOpaque = false
        window.alphaValue = 0
        window.hasShadow = false
        window.ignoresMouseEvents = true
        window.collectionBehavior = [.ignoresCycle, .stationary]
        window.level = .normal
        window.orderFront(nil)
        delegate.window = window
    }
}
