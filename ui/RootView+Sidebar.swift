import SwiftUI

extension RootView {
    var studioSidebar: some View {
        List(selection: $sidebarSelection) {
            Section("Studio") {
                Label("Capture", systemImage: "record.circle")
                    .tag(SidebarItem.capture)
                Label("Edit", systemImage: "scissors")
                    .tag(SidebarItem.edit)
                Label("Exports", systemImage: "square.and.arrow.up")
                    .tag(SidebarItem.exports)
            }

            Section("Library") {
                Label("Presets", systemImage: "slider.horizontal.3")
                    .tag(SidebarItem.presets)
                Label("Devices", systemImage: "display")
                    .tag(SidebarItem.devices)
            }
        }
        .listStyle(.sidebar)
        .frame(width: 200)
        .onChange(of: sidebarSelection) { selection in
            switch selection {
            case .capture:
                studioMode = .capture
            case .edit:
                studioMode = .edit
            case .exports:
                studioMode = .edit
            case .presets, .devices:
                break
            }
        }
    }
}
