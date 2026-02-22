# Guerilla Glass Desktop (Electrobun)

This app is the new desktop shell for Guerilla Glass using Electrobun + React + Tailwind + shadcn base components.

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
bun run swift:build
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
# JS/TS format + lint (workspace-level Oxc tooling)
bun run js:format:check
bun run js:lint

# Desktop tests
bun run desktop:test
bun run desktop:test:coverage
bun run desktop:test:e2e

# Browser UI smoke tests (Playwright against Vite UI + mocked Electrobun bridge)
bun run desktop:test:ui
```

## Build

```bash
bun run desktop:build
```

## Project Package Registration (macOS)

- Guerilla Glass projects use the `.gglassproj` package format.
- During desktop build packaging, Electrobun hooks run `scripts/configure-macos-project-package.ts`.
- The hook updates and validates generated `Info.plist` entries:
  - `UTExportedTypeDeclarations` for `com.okikeSolutions.guerillaglass.project`
  - `CFBundleDocumentTypes` with `LSItemContentTypes` and `LSTypeIsPackage=true`
- Result: Finder treats `.gglassproj` as a package item (single project item by default, directory on disk).

## Key Paths

- UI shell: `/apps/desktop-electrobun/src/mainview`
- Bun main process bridge: `/apps/desktop-electrobun/src/bun`
- Shared Zod protocol: `/packages/engine-protocol/src/index.ts`
- Shared Rust protocol: `/engines/protocol-rust`
- Native engine target: `/engines/macos-swift`
- Native engine foundations: `/engines/windows-native`, `/engines/linux-native`
- Stub engines: `/engines/windows-stub`, `/engines/linux-stub`
