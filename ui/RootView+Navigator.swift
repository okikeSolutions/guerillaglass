import SwiftUI

extension RootView {
    var navigatorPane: some View {
        ZStack {
            List(selection: $navigatorSelection) {
                Section("Timeline") {
                    Label("Preview", systemImage: "play.rectangle")
                        .tag(NavigatorItem.preview)
                    Label("Recorded Clips", systemImage: "film")
                        .tag(NavigatorItem.clips)
                }

                Section("Notes") {
                    Label("Presenter Notes", systemImage: "note.text")
                        .tag(NavigatorItem.notes)
                }
            }
            .listStyle(.sidebar)
            .scrollContentBackground(.hidden)
            .background(Color.clear)
            .padding(8)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .strokeBorder(Color.black.opacity(0.08))
            )

            if isNavigatorDropTarget {
                RoundedRectangle(cornerRadius: 10)
                    .strokeBorder(Color.accentColor.opacity(0.6), style: StrokeStyle(lineWidth: 2, dash: [6]))
                    .padding(6)
                Text("Drop items here")
                    .foregroundStyle(.secondary)
            }
        }
        .onDrop(of: [.fileURL], isTargeted: $isNavigatorDropTarget) { _ in
            false
        }
    }
}
