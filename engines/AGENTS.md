# Native engines agent guide

Read the root `AGENTS.md` and `docs/CHANGE_MAP.md` first.

## Ownership

- `macos-swift`: production macOS capture, recording, project, and export behavior.
- `native-foundation`: portable Rust HTTP/security/state behavior.
- `linux-native`, `windows-native`: protocol/parity shells until production media milestones are implemented.
- `protocol-swift`, `protocol-rust`: generated OpenAPI bindings plus clearly separated project-owned middleware/helpers/templates.

## Rules

- Implement generated `APIProtocol`/Axum shapes; do not create a parallel wire protocol.
- Advertise capabilities only when the target implements them.
- Keep bearer authentication, loopback restrictions, request limits, path traversal, and symlink defenses intact.
- Capture resources must clean up on cancellation, failure, and restart.
- Export must match renderer program-time semantics, including clip order, gaps, trims, and camera transforms.
- A dependency change in generated `protocol-rust/Cargo.toml` must originate in `protocol-rust/openapi-generator-templates/Cargo.mustache`.
- Do not edit generated model/server files directly; regenerate from the TypeScript contract.

## Checks

Before running checks, use [Verification selection](../docs/CHANGE_MAP.md#verification-selection) for Rust/Swift target discovery, fast compile commands, focused tests, and generated-consumer coverage. Select both native consumers for protocol changes. CI runs the full native suites; the full local gate is explicitly requested.
