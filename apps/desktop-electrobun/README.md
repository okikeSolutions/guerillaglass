# Guerillaglass Desktop (Electrobun)

This app is the new desktop shell for Guerillaglass using Electrobun + React + Tailwind + shadcn base components.

It talks to the native Swift engine (`guerillaglass-engine`) over stdio with a typed protocol defined in `/packages/engine-protocol`.

## Prerequisites

- Bun `1.3+`
- Swift toolchain + macOS SDK (to build the native engine)

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
```

## Test & Coverage

```bash
bun run desktop:test
bun run desktop:test:coverage
```

## Build

```bash
bun run desktop:build
```

## Key Paths

- UI shell: `/apps/desktop-electrobun/src/mainview`
- Bun main process bridge: `/apps/desktop-electrobun/src/bun`
- Shared Zod protocol: `/packages/engine-protocol/src/index.ts`
- Native engine target: `/engines/macos-swift`
