import CoreGraphics
import Foundation

struct WindowRecord: Codable {
    let id: Int
    let owner: String
    let title: String
    let width: Double
    let height: Double
    let layer: Int
}

let ownerNeedle = CommandLine.arguments.dropFirst().first?.lowercased() ?? "guerillaglass"
let options: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
let windowInfo = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]] ?? []
let windows = windowInfo.compactMap { window -> WindowRecord? in
    let owner = window[kCGWindowOwnerName as String] as? String ?? ""
    let title = window[kCGWindowName as String] as? String ?? ""
    guard owner.lowercased().contains(ownerNeedle) || title.lowercased().contains(ownerNeedle) else {
        return nil
    }
    guard let id = window[kCGWindowNumber as String] as? Int,
          let bounds = window[kCGWindowBounds as String] as? [String: Any],
          let width = bounds["Width"] as? Double,
          let height = bounds["Height"] as? Double
    else {
        return nil
    }
    return WindowRecord(
        id: id,
        owner: owner,
        title: title,
        width: width,
        height: height,
        layer: window[kCGWindowLayer as String] as? Int ?? 0
    )
}

let data = try JSONEncoder().encode(windows)
FileHandle.standardOutput.write(data)
FileHandle.standardOutput.write(Data("\n".utf8))
