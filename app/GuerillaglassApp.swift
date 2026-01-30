import SwiftUI
import UI

@main
struct GuerillaglassApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var libraryModel = ProjectLibraryModel()

    var body: some Scene {
        WindowGroup("Guerilla Glass") {
            LaunchView()
                .environmentObject(libraryModel)
        }
        DocumentGroup(newDocument: GuerillaglassDocument()) { configuration in
            RootView(document: configuration.$document, fileURL: configuration.fileURL)
                .environmentObject(libraryModel)
        }
        .commands {
            GuerillaglassCommands(libraryModel: libraryModel)
        }
        .windowStyle(.automatic)
    }
}
