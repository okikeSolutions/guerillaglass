# Guerillaglass Desktop (Electrobun)

This app is the new desktop shell for Guerillaglass using Electrobun + React + Tailwind + shadcn base components.

It talks to the native Swift engine (`guerillaglass-engine`) over stdio with a typed protocol defined in `/packages/engine-protocol`.

## Prerequisites

- Bun `1.3+`
- Swift toolchain + macOS SDK (to build the native engine)
- Rust toolchain (to build/test `windows-native`, `linux-native`, and `protocol-rust`)

## Setup

```bash
# Workspace dependencies
bun install

# Build native engine once (required for runtime wiring)
swift build --product guerillaglass-engine
```

## Development

```bash
# Desktop shell (no HMR)
bun run desktop:dev

# Desktop shell with Vite HMR
bun run desktop:dev:hmr

# Force Windows/Linux protocol stubs (for parallel engine development)
GG_ENGINE_TARGET=windows-stub bun run desktop:dev
GG_ENGINE_TARGET=linux-stub bun run desktop:dev

# Prefer native Windows/Linux engines when their binaries exist
GG_ENGINE_TARGET=windows-native bun run desktop:dev
GG_ENGINE_TARGET=linux-native bun run desktop:dev
```

## Test & Coverage

```bash
bun run desktop:test
bun run desktop:test:coverage
bun run desktop:test:e2e
```

## Build

```bash
bun run desktop:build
```

## Key Paths

- UI shell: `/apps/desktop-electrobun/src/mainview`
- Bun main process bridge: `/apps/desktop-electrobun/src/bun`
- Shared Zod protocol: `/packages/engine-protocol/src/index.ts`
- Shared Rust protocol: `/engines/protocol-rust`
- Native engine target: `/engines/macos-swift`
- Native engine foundations: `/engines/windows-native`, `/engines/linux-native`
- Stub engines: `/engines/windows-stub`, `/engines/linux-stub`
