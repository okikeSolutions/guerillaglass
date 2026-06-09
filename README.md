# Guerilla Glass

Guerilla Glass is an open-source, cross-platform creator recorder/editor with cinematic automation.

North star:

- Professional workflow: `Record -> Edit -> Deliver`
- Editor-first workstation UI: transport, viewer, timeline, inspector
- Beautiful-by-default motion design with manual control
- Local-first capture/edit/export, with hosted review/collaboration kept in a separate cloud plane

## Current Architecture

The repository now uses the completed Phase 1–7 architecture:

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
- macOS 13+ for the full macOS capture/export path and `bun run gate`

## Quick Start

```bash
bun install

# Generate app-local Paraglide output used by typecheck/build/test
bun run i18n:compile

# Build native macOS engine
bun run swift:build

# Run desktop shell
bun run desktop:dev

# Run web app
bun run web:dev
```

Engine targets:

```bash
GG_ENGINE_TARGET=windows-native bun run desktop:dev
GG_ENGINE_TARGET=linux-native bun run desktop:dev
```

## Verification

```bash
bun run i18n:compile
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
- Agent repo conventions: `AGENTS.md`
