# guerillaglass

Guerillaglass is an open-source screen recording app with cinematic automation.

The project now uses a hybrid architecture:

- Cross-platform desktop shell: Electrobun + React + Tailwind (`/apps/desktop-electrobun`)
- Native media engine: Swift (`/engines/macos-swift`) using ScreenCaptureKit/AVFoundation
- Shared typed protocol: Zod schemas (`/packages/engine-protocol`)
- Parallel stubs for non-mac engine development: `/engines/windows-stub`, `/engines/linux-stub`

## Requirements

- macOS 13+
- Swift 5.10+
- Bun 1.3+

## Quick Start

```bash
# Install JS workspace dependencies
bun install

# Build native app + engine
swift build

# Run desktop shell (expects native engine binary)
bun run desktop:dev

# Use protocol stubs while native Windows/Linux engines are under development
GG_ENGINE_TARGET=windows-stub bun run desktop:dev
GG_ENGINE_TARGET=linux-stub bun run desktop:dev
```

## Verification

```bash
# Swift format/lint/test/build gate
Scripts/full_gate.sh

# Desktop protocol + bridge tests
bun run desktop:test:coverage
```

## Docs

- Product spec: `/docs/SPEC.md`
- Hybrid architecture: `/docs/ARCHITECTURE.md`
- Agent repo conventions: `/AGENTS.md`
