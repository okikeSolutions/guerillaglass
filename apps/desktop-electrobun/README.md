# Guerilla Glass Desktop (Electrobun)

Desktop creator studio shell built with Electrobun, React, Tailwind, shadcn/base-ui components, and an Effect-native Bun backend.

The desktop host talks to native sidecars through `@guerillaglass/engine` using a stable loopback socket wire protocol. Stdio/native JSON-RPC paths were removed.

## Runtime Architecture

```txt
React renderer
  -> Electrobun RPC bridge
    -> thin request adapter
      -> AppRuntime / AppLayer
        -> DesktopShell service
        -> ProjectSession service
        -> EngineTransport service
        -> MediaSourceService + Effect HTTP media routes
```

Key points:

- One Bun process owns one Effect app runtime.
- Electrobun shell resources are scoped behind `DesktopShell`.
- Bridge handlers delegate to `HostBridgeService` / `ProjectSession`; they do not own business logic.
- Engine sidecars are spawned with Effect process primitives and connected over Bun socket services.
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
bun run swift:build
```

## Development

```bash
bun run desktop:dev
bun run desktop:dev:hmr

GG_ENGINE_TARGET=windows-stub bun run desktop:dev
GG_ENGINE_TARGET=linux-stub bun run desktop:dev
GG_ENGINE_TARGET=windows-native bun run desktop:dev
GG_ENGINE_TARGET=linux-native bun run desktop:dev
```

## Test & Coverage

```bash
bun run desktop:typecheck
bun run desktop:test
bun run desktop:test:coverage
bun run desktop:test:e2e
bun run desktop:test:ui
```

The app-level `typecheck`, `build`, and test scripts generate Paraglide output first, so fresh clones and CI do not need generated files committed.

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
- Engine protocol/client: `../../packages/engine`
- Native sidecars/foundations: `../../engines`
