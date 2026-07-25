# Guerilla Glass

Guerilla Glass is an open-source, cross-platform creator recorder/editor with cinematic automation.

North star:

- Professional workflow: `Record -> Edit -> Deliver`
- Editor-first workstation UI: transport, viewer, timeline, inspector
- Beautiful-by-default motion design with manual control
- Local-first capture/edit/export, with hosted review/collaboration kept in a separate cloud plane

## Current Architecture

The repository now uses the completed Engine Contract v2 architecture:

- Desktop shell: Electrobun + React + Tailwind (`apps/desktop-electrobun`)
- Desktop backend: one Effect app runtime composed from scoped services (`src/bun/app`)
- Engine contract/client packages: Effect `HttpApi` + generated OpenAPI (`packages/engine-contract`) and Effect-native HTTP client/process launcher (`packages/engine-client`)
- Native engines: Swift and Rust sidecars under `engines/`, serving the v2 loopback HTTP/OpenAPI API
- Media serving: Effect HTTP routes + scoped Bun HTTP server with tokenized loopback URLs
- Web app/auth shell: TanStack Start + Convex (`apps/web`)
- Localization: shared Paraglide/Inlang source messages at `project.inlang` + `messages/*.json`; each app generates ignored `src/paraglide` output in CI/build scripts

Important boundaries:

- Native sidecars depend on generated OpenAPI bindings/helpers, not Effect RPC internals.
- TypeScript owns the Effect `HttpApi` contract and generated OpenAPI artifact.
- Desktop bridge handlers are thin adapters into the Effect runtime.
- Generated Paraglide output is not committed.

## Requirements

- Bun 1.3+
- Rust toolchain for Rust sidecars/protocol crates
- Swift 5.10+ for macOS native engine work
- SwiftFormat 0.62.1 and SwiftLint for the full local gate
- Java for OpenAPI binding generation
- macOS 13+ for the full macOS capture/export path and `bun run gate`

## Quick Start

```bash
# Initialize submodules, install frozen dependencies, compile localization,
# and verify repository invariants.
bun run bootstrap

# Skip Playwright Chromium only when browser-backed desktop tests are not needed.
bun run bootstrap --without-browser

# Build native macOS engine. Desktop dev scripts launch this engine via GG_ENGINE_PATH.
bun run swift:build

# Run desktop shell. The desktop scripts build the native macOS engine first
# and pass GG_ENGINE_PATH to Electrobun.
bun run desktop:dev

# Run desktop shell with Vite HMR for the renderer
bun run desktop:dev:hmr

# Run web app
bun run web:dev
```

Native engine path overrides:

```bash
# Use a custom native engine executable. The path must be absolute.
GG_ENGINE_PATH=/absolute/path/to/guerillaglass-engine bun run desktop:dev
GG_ENGINE_PATH=/absolute/path/to/guerillaglass-engine bun run desktop:dev:hmr

# Rust sidecars can be built/launched explicitly for focused native parity work.
cargo build --workspace
GG_ENGINE_PATH="$PWD/target/debug/guerillaglass-engine-linux" bun run desktop:dev
```

## Verification

```bash
bun run repo:check
bun run js:lint
bun run gate:typescript
bun run gate:rust
bun run desktop:test:e2e
bun run desktop:test:ui
bun run docs:check
```

Useful focused checks:

```bash
cd apps/desktop-electrobun && bun run typecheck
cd apps/desktop-electrobun && bun run test
cd apps/web && bun run typecheck
cd packages/engine-contract && bun run check:contract:full
cd packages/engine-client && bun run typecheck
cargo check
```

## Localization

Source-of-truth localization files:

```txt
project.inlang/
messages/en-US.json
messages/de-DE.json
```

Generated output is intentionally ignored:

```txt
apps/desktop-electrobun/src/paraglide/
apps/web/src/paraglide/
```

Forks and CI should run:

```bash
bun run i18n:compile
```

## Docs

- Product spec: `docs/SPEC.md`
- Hybrid architecture: `docs/ARCHITECTURE.md`
- Completed migration notes: `docs/MIGRATION.md`
- Docs coverage thresholds: `docs/doc_coverage_policy.json`
- Desktop accessibility + hotkey policy: `docs/DESKTOP_ACCESSIBILITY.md`
- Local Agent Mode runbook: [`docs/AGENT_MODE_RUNBOOK.md`](docs/AGENT_MODE_RUNBOOK.md)
- Agent discoverability audit: [`docs/AGENT_DISCOVERABILITY_AUDIT.md`](docs/AGENT_DISCOVERABILITY_AUDIT.md)
- Agent repo conventions: [`AGENTS.md`](AGENTS.md)
- Change propagation guide: [`docs/CHANGE_MAP.md`](docs/CHANGE_MAP.md)
- Review rubric: [`REVIEW.md`](REVIEW.md)
