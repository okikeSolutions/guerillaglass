import SwiftUI
import UI

@main
struct GuerillaglassApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    var body: some Scene {
        WindowGroup {
            RootView()
        }
        .windowStyle(.automatic)
    }
}
