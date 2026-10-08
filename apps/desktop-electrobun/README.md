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
- Media playback uses tokenized loopback URLs served by Effect HTTP routes and `NodeHttpServer.layer` under Electrobun's Bun executable.
- Localization is generated from root Paraglide/Inlang messages into ignored `src/paraglide` output.

## Prerequisites

- Bun `1.3+`
- Swift toolchain + macOS SDK for the macOS native engine
- Rust toolchain for Windows/Linux native foundations and protocol tests

## Setup

```bash
bun install
bun run i18n:compile

# Builds the macOS native engine used by desktop dev scripts.
bun run swift:build
```

## Development

From the repository root:

```bash
# Builds the native macOS engine and desktop bundle, launches through LaunchServices,
# and rebuilds sequentially when host, renderer, config, or native source changes.
bun run desktop:dev

# Runs Vite for renderer HMR and builds/launches the packaged desktop once.
bun run desktop:dev:hmr
```

From this package directory:

```bash
bun run dev
bun run dev:hmr
```

By default the desktop dev scripts launch the SwiftPM-built macOS engine at `.build/debug/guerillaglass-engine`. To use a custom sidecar executable, pass an absolute `GG_ENGINE_PATH`:

```bash
GG_ENGINE_PATH=/absolute/path/to/guerillaglass-engine bun run desktop:dev
GG_ENGINE_PATH=/absolute/path/to/guerillaglass-engine bun run desktop:dev:hmr
```

The macOS runner uses `/usr/bin/open` so macOS attributes Screen Recording access
to Guerillaglass. Directly executing `Contents/MacOS/launcher`, including through
Electrobun 2.0.1's CLI `run`/`dev`, can attribute the engine to the invoking terminal
instead. The runner passes `GG_ENGINE_PATH` explicitly to LaunchServices without
changing global `launchctl` environment settings. Custom engines skip the default
Swift build. Default native builds use two jobs.

The runner prints a temporary console-log path outside the repository volume.
Close an existing packaged app before starting another runner. Ctrl+C stops the
selected Bun host and its engine; the launcher-to-host registration change is
handled before recording the process identity.

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
bun run desktop:acceptance
```

`desktop:acceptance` combines browser interaction/screenshots with a real packaged-app
startup smoke on macOS. The runtime smoke launches the Electrobun app and Swift
engine, waits for host/renderer/engine milestones, verifies a visible window,
scans logs for fatal startup failures, verifies process cleanup, and writes its
report under `.tmp/runtime-acceptance/latest/`.
The runtime smoke uses the same LaunchServices adapter as development. Its
shutdown checks the bundle URL, PID, and launch time before signaling the app,
then waits for that app instance to exit.

For every desktop/runtime change, also validate the packaged app with Peekaboo through
the permissioned GUI bridge at
`~/Library/Application Support/Peekaboo/bridge.sock`: navigate the affected workflow
and retain native-window screenshots with the acceptance evidence. Check permissions
with `peekaboo permissions status --bridge-socket "$HOME/Library/Application Support/Peekaboo/bridge.sock"`.
Do not rely on Peekaboo's unpermissioned fallback daemon.

Use `bun run desktop:acceptance:screenshot` when the invoking terminal has macOS
Screen Recording permission. This additionally requires a screenshot of the real
Electrobun window; browser acceptance screenshots are written under
`apps/desktop-electrobun/test-results/screenshots/`.

The app-level `typecheck`, `build`, lint, and test scripts generate Paraglide output first, so fresh clones and CI do not need generated files committed.

`bun run js:lint` at the repo root runs Oxlint with `--type-aware --type-check --deny-warnings`, so JavaScript/TypeScript lint warnings are treated as gate failures.

## Build

```bash
bun run desktop:build
```

## Project File Registration (macOS)

- Guerilla Glass projects use the `.gglassproj` project directory format.
- Electrobun registers `.gglassproj` through `app.fileAssociations` in `electrobun.config.ts`.
- Finder package-directory behavior is left to the standard Electrobun file association behavior.

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
