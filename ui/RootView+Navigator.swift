import AppKit
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
                    .strokeBorder(navigatorBorderColor, lineWidth: navigatorBorderLineWidth)
            )

            if isNavigatorDropTarget {
                RoundedRectangle(cornerRadius: 10)
                    .strokeBorder(
                        dropTargetStrokeColor,
                        style: StrokeStyle(lineWidth: dropTargetLineWidth, dash: [6])
                    )
                    .padding(6)
                Text("Drop items here")
                    .foregroundStyle(.secondary)
            }
        }
        .onDrop(of: [.fileURL], isTargeted: $isNavigatorDropTarget) { _ in
            false
        }
    }

    private var navigatorBorderColor: Color {
        highContrastEnabled ? Color(nsColor: .separatorColor) : Color.black.opacity(0.08)
    }

    private var navigatorBorderLineWidth: CGFloat {
        highContrastEnabled ? 2 : 1
    }

    private var dropTargetStrokeColor: Color {
        highContrastEnabled ? Color.accentColor : Color.accentColor.opacity(0.6)
    }

    private var dropTargetLineWidth: CGFloat {
        highContrastEnabled ? 3 : 2
    }
}
