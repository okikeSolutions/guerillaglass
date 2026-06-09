# Guerilla Glass Desktop (Electrobun)

Desktop creator studio shell built with Electrobun, React, Tailwind, shadcn/base-ui components, and an Effect-native Bun backend.

The desktop host talks to native sidecars through `@guerillaglass/engine-client` using the v2 loopback HTTP/OpenAPI engine contract from `@guerillaglass/engine-contract`.

## Runtime Architecture

```txt
React renderer
  -> Electrobun RPC bridge
    -> thin request adapter
      -> AppRuntime / AppLayer
        -> DesktopShell service
        -> ProjectSession service
        -> EngineClient + domain engine services
        -> MediaSourceService + Effect HTTP media routes
```

Key points:

- One Bun process owns one Effect app runtime.
- Electrobun shell resources are scoped behind `DesktopShell`.
- Bridge handlers delegate to `HostBridgeService` / `ProjectSession`; they do not own business logic.
- Engine sidecars are spawned with Effect process primitives and connected through authenticated loopback HTTP.
- Media playback uses tokenized loopback URLs served by Effect HTTP routes and `BunHttpServer.layer`.
- Localization is generated from root Paraglide/Inlang messages into ignored `src/paraglide` output.

## Prerequisites

- Bun `1.3+`
- Swift toolchain + macOS SDK for the macOS native engine
- Rust toolchain for Windows/Linux native foundations and protocol tests

## Setup

```bash
bun install
bun run i18n:compile

# Builds .build/debug/guerillaglass-engine, the default engine used by desktop dev scripts.
bun run swift:build
```

## Development

From the repository root:

```bash
# Builds the desktop bundle and launches Electrobun.
# Defaults GG_ENGINE_PATH to .build/debug/guerillaglass-engine when unset.
bun run desktop:dev

# Runs Vite for renderer HMR and launches the Electrobun dev shell.
# Also defaults GG_ENGINE_PATH to .build/debug/guerillaglass-engine when unset.
bun run desktop:dev:hmr
```

From this package directory:

```bash
bun run dev
bun run dev:hmr
```

To use a custom sidecar executable, pass an absolute `GG_ENGINE_PATH`:

```bash
GG_ENGINE_PATH=/absolute/path/to/guerillaglass-engine bun run desktop:dev
GG_ENGINE_PATH=/absolute/path/to/guerillaglass-engine bun run desktop:dev:hmr
```

Focused Rust native parity builds can be launched the same way:

```bash
cargo build --workspace
GG_ENGINE_PATH="$PWD/target/debug/guerillaglass-engine-linux" bun run desktop:dev
```

## Test & Coverage

```bash
bun run desktop:typecheck
bun run desktop:test
bun run desktop:test:coverage
bun run desktop:test:e2e
bun run desktop:test:ui
```

The app-level `typecheck`, `build`, lint, and test scripts generate Paraglide output first, so fresh clones and CI do not need generated files committed.

`bun run js:lint` at the repo root runs Oxlint with `--type-aware --type-check --deny-warnings`, so JavaScript/TypeScript lint warnings are treated as gate failures.

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
- Finder treats `.gglassproj` as a single package item by default.

## Key Paths

- React renderer: `src/mainview`
- Bun backend/effect services: `src/bun`
- App composition root: `src/bun/app`
- Desktop shell service: `src/bun/shell`
- Bridge adapter/service: `src/bun/bridge`
- Session service: `src/bun/session`
- Media registry/routes/source service: `src/bun/media`
- App-local localization adapter: `src/shared/localization.ts`
- Generated Paraglide output: `src/paraglide` (ignored)
- Engine contract: `../../packages/engine-contract`
- Engine client: `../../packages/engine-client`
- Native sidecars/foundations: `../../engines`
