import SwiftUI

enum CaptureSource: String, CaseIterable, Identifiable {
    case display
    case window

    var id: String {
        rawValue
    }

    var title: LocalizedStringKey {
        LocalizedStringKey(rawValue.capitalized)
    }
}

enum StudioMode: String, CaseIterable, Identifiable {
    case capture
    case edit

    var id: String {
        rawValue
    }

    var title: String {
        switch self {
        case .capture:
            "Capture"
        case .edit:
            "Edit"
        }
    }
}

enum SidebarItem: String, CaseIterable, Identifiable {
    case capture
    case edit
    case exports
    case presets
    case devices

    var id: String {
        rawValue
    }
}

enum NavigatorItem: String, CaseIterable, Identifiable {
    case preview
    case clips
    case notes

    var id: String {
        rawValue
    }
}

var usesSystemPicker: Bool {
    if #available(macOS 14.0, *) {
        return true
    }
    return false
}

extension View {
    @ViewBuilder
    func applyToolbarTitleDisplayModeInline() -> some View {
        if #available(macOS 14.0, *) {
            toolbarTitleDisplayMode(.inline)
        } else {
            self
        }
    }
}
