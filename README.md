# guerillaglass

Guerillaglass is an open-source, cross-platform creator recorder/editor with cinematic automation.

North star:

- Professional workflow: `Record -> Edit -> Deliver`
- Editor-first workstation UI: transport, viewer, timeline, inspector
- Beautiful-by-default motion design with manual control

The project now uses a hybrid architecture:

- Cross-platform desktop shell: Electrobun + React + Tailwind (`/apps/desktop-electrobun`)
- Native media engine: Swift (`/engines/macos-swift`) using ScreenCaptureKit/AVFoundation
- Shared typed protocol: Zod schemas (`/packages/engine-protocol`)
- Shared Rust protocol implementation: `/engines/protocol-rust`
- Parallel stubs for non-mac engine development: `/engines/windows-stub`, `/engines/linux-stub`
- Native engine foundations for non-mac platforms: `/engines/windows-native`, `/engines/linux-native`

## Requirements

- Bun 1.3+
- Rust toolchain (for `engines/windows-native`, `engines/linux-native`, and `engines/protocol-rust`)
- Swift 5.10+ (required for macOS native engine work)
- macOS 13+ (required for full macOS capture/export path and running `bun run gate`)

## Quick Start

```bash
# Install JS workspace dependencies
bun install

# Build native engine
bun run swift:build

# Run desktop shell (expects native engine binary)
bun run desktop:dev

# Use protocol stubs while native Windows/Linux engines are under development
GG_ENGINE_TARGET=windows-stub bun run desktop:dev
GG_ENGINE_TARGET=linux-stub bun run desktop:dev

# Prefer native Windows/Linux engines when binaries are available
GG_ENGINE_TARGET=windows-native bun run desktop:dev
GG_ENGINE_TARGET=linux-native bun run desktop:dev
```

## Verification

```bash
# Rust gate (fmt + clippy + tests)
bun run gate:rust

# JS/TS format + lint
bun run js:format:check
bun run js:lint

# TypeScript gate (oxfmt + oxlint + typecheck + desktop tests)
bun run gate:typescript

# Swift format/lint/test/build gate
bun run gate

# Desktop protocol + bridge tests
bun run desktop:test:coverage

# Desktop parity e2e flow tests (stub/native engine targets)
bun run desktop:test:e2e

# Desktop shell UI smoke + accessibility checks (Playwright)
bun run desktop:test:ui
```

## Editor Setup

- Recommended VS Code extension for Oxc tooling:
  - `code --install-extension oxc.oxc-vscode`

## Studio Shell State & i18n

- Creator Studio layout persists in `localStorage` (`gg.studio.layout.v1`):
  - left/right pane widths
  - pane collapse state
  - timeline height
  - last workspace route
  - selected locale
- Locale routing uses canonical BCP-47 codes:
  - `en-US`
  - `de-DE`
- Shell routes are locale-scoped (`/:locale/capture`, `/:locale/edit`, `/:locale/deliver`), and unknown locales are normalized to the default locale.

## Docs

- Product spec: `/docs/SPEC.md`
- Hybrid architecture: `/docs/ARCHITECTURE.md`
- Desktop accessibility + hotkey policy: `/docs/DESKTOP_ACCESSIBILITY.md`
- Agent repo conventions: `/AGENTS.md`
- Support channels: `/SUPPORT.md`
- Third-party notices: `/THIRD_PARTY_NOTICES.md`
