import Project
import SwiftUI
import UI

struct GuerillaglassCommands: Commands {
    @Environment(\.openDocument) private var openDocument
    @FocusedValue(\.exportCommandHandler) private var exportCommandHandler
    @ObservedObject var libraryModel: ProjectLibraryModel

    var body: some Commands {
        CommandGroup(after: .saveItem) {
            Button("Export…") {
                exportCommandHandler?.perform()
            }
            .keyboardShortcut("e", modifiers: [.command, .shift])
            .disabled(exportCommandHandler?.canExport != true)
        }
        CommandGroup(after: .newItem) {
            Menu("Open Recent") {
                if libraryModel.recentProjects.isEmpty {
                    Text("No Recent Projects")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(libraryModel.recentProjects) { item in
                        Button(item.displayName) {
                            openRecentProject(item)
                        }
                    }
                }
            }
        }
    }

    private func openRecentProject(_ item: ProjectLibraryItem) {
        guard let url = libraryModel.resolveURL(for: item) else { return }
        Task {
            try? await openDocument(at: url)
        }
    }
}
