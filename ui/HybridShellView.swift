import SwiftUI

public struct HybridShellView: View {
    public init() {}

    public var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Guerilla Glass")
                .font(.system(size: 24, weight: .semibold))

            Text("Desktop product surfaces now run in the Electrobun shell.")
                .foregroundStyle(.secondary)

            VStack(alignment: .leading, spacing: 8) {
                Text("Use these commands in the repository root:")
                    .font(.subheadline.weight(.semibold))
                Text("bun run desktop:dev")
                    .font(.system(.body, design: .monospaced))
                Text("bun run desktop:test:coverage")
                    .font(.system(.body, design: .monospaced))
            }
        }
        .padding(24)
        .frame(minWidth: 480, minHeight: 260, alignment: .topLeading)
    }
}
