import AppKit
import Project
import SwiftUI

public struct LaunchView: View {
    @EnvironmentObject private var libraryModel: ProjectLibraryModel
    @Environment(\.newDocument) private var newDocument
    @Environment(\.openDocument) private var openDocument
    @Environment(\.dismiss) private var dismiss

    public init() {}

    public var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Guerilla Glass")
                .font(.system(size: 22, weight: .semibold))

            VStack(alignment: .leading, spacing: 10) {
                Button("New Project") {
                    newDocument(GuerillaglassDocument())
                    dismiss()
                }

                Button("Open Project…") {
                    openProjectPanel()
                }
            }

            Divider()

            Text("Open Recent")
                .font(.subheadline.weight(.semibold))

            if libraryModel.recentProjects.isEmpty {
                Text("No Recent Projects")
                    .foregroundStyle(.secondary)
            } else {
                ForEach(libraryModel.recentProjects) { item in
                    Button(item.displayName) {
                        openRecentProject(item)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(24)
        .frame(minWidth: 360, minHeight: 240)
        .task {
            libraryModel.refresh()
        }
    }

    private func openProjectPanel() {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = false
        panel.canChooseFiles = true
        panel.canChooseDirectories = false
        panel.allowedContentTypes = [.guerillaglassProject]
        panel.begin { response in
            guard response == .OK, let url = panel.url else { return }
            Task {
                try? await openDocument(at: url)
                dismiss()
            }
        }
    }

    private func openRecentProject(_ item: ProjectLibraryItem) {
        guard let url = libraryModel.resolveURL(for: item) else { return }
        Task {
            try? await openDocument(at: url)
            dismiss()
        }
    }
}
