import SwiftUI

public struct ExportCommandHandler {
    public let canExport: Bool
    public let perform: () -> Void

    public init(canExport: Bool, perform: @escaping () -> Void) {
        self.canExport = canExport
        self.perform = perform
    }
}

private struct ExportCommandHandlerKey: FocusedValueKey {
    typealias Value = ExportCommandHandler
}

public extension FocusedValues {
    var exportCommandHandler: ExportCommandHandler? {
        get { self[ExportCommandHandlerKey.self] }
        set { self[ExportCommandHandlerKey.self] = newValue }
    }
}
