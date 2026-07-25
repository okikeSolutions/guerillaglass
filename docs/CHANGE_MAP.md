# Change map

This guide maps common changes to their sources of truth, propagation path, and minimum validation. Read the nearest subsystem `AGENTS.md` as well.

## Engine endpoint or wire-schema change

```text
packages/engine-contract/src/domains/*
  -> packages/engine-contract/src/httpApi.ts
  -> generated OpenAPI
  -> generated Swift/Rust bindings
  -> packages/engine-client
  -> native handlers
  -> Bun host bridge
  -> renderer
```

Procedure:

1. Change the Effect schema/domain and `HttpApi` definition.
2. Add contract tests for encoding, decoding, and failure shapes.
3. Run `bun run protocol:generate-bindings`.
4. Format generated Rust with `cargo fmt --all`.
5. Implement client and native handlers using generated types.
6. Add native and parity tests.
7. Run `bun run protocol:check-determinism`; it hashes generated artifacts, regenerates them, and fails if the second generation changes those artifacts.

Minimum checks:

```bash
bun run repo:check
bun run protocol:typecheck
bun run protocol:generate-bindings
cargo fmt --all
bun run protocol:check-determinism
cargo test --workspace --all-targets
swift test
```

## Persisted project setting

```text
Effect project schema/default
  -> generated protocol
  -> Swift/Rust project model or handler
  -> project migration/store
  -> renderer controller
  -> inspector/preview
  -> export payload and renderer
```

Define constraints and defaults before UI. Existing projects must load. Add migration/round-trip tests and verify malformed values are sanitized or rejected consistently. If a visual setting affects final media, preview and export must share the same semantics.

## Timeline operation

```text
pure timeline command
  -> controller action
  -> timeline/inspector interaction
  -> selection and playhead result
  -> project persistence
  -> preview mapping
  -> export mapping
```

Start with deterministic command tests. Cover ripple and non-ripple behavior, edge gaps, source/program time mapping, undoable state boundaries where present, and browser interaction. Consult `docs/TIMELINE_EDITING_DESIGN.md`.

Minimum checks:

```bash
bun run desktop:typecheck
bun run desktop:test
bun run desktop:test:ui
bun run desktop:acceptance
swift test
bun run desktop:test:e2e
```

## Localized desktop UI

1. Add message keys to both `messages/en-US.json` and `messages/de-DE.json`.
2. Expose messages through the existing localization model rather than importing generated messages throughout components.
3. Compile with `bun run i18n:compile`.
4. Do not commit `src/paraglide` output.
5. Test keyboard operation, accessible names/state, focus visibility, and reduced motion.

## Electrobun host capability

```text
shared bridge contract
  -> scoped Bun service/AppLayer
  -> thin request handler or host command router
  -> renderer query/controller
  -> UI
```

Do not add application logic directly to bridge handlers. Acquire windows, menus, trays, servers, processes, and subscriptions through scoped services. Test lifecycle cleanup and recoverable host-dialog timeouts. For UI-facing host changes on macOS, run `bun run desktop:acceptance` so the packaged Electrobun host, renderer, and native engine are exercised together.

## Agent Mode operation

```text
packages/engine-contract/src/domains/agent.ts + src/httpApi.ts
  -> generated OpenAPI and native bindings
  -> packages/engine-client AgentService
  -> native preflight/run/status/apply and artifact storage
  -> cut-plan export
  -> desktop bridge/workspace when UI is in scope
```

Use `docs/AGENT_MODE_RUNBOOK.md` as the operational contract and keep `docs/AGENT_DISCOVERABILITY_AUDIT.md` dispositions current. Capabilities must identify unsupported foundation targets instead of inferring parity from generated endpoints. Verify project/run binding, token expiry, QA failure, persisted artifact recovery, destructive confirmation, exact apply results, and decoded cut-plan export media.

## Native capture or export behavior

- macOS production behavior belongs under `engines/macos-swift`.
- Shared HTTP/security/foundation behavior belongs under `engines/native-foundation` when genuinely portable.
- Windows/Linux shells must report only implemented capabilities.
- Add unit coverage at the native layer and parity coverage through the engine client.
- Capture work must consider permission denial, cancellation, static scenes, dropped frames, backpressure, and cleanup.
- Export work must consider invalid paths, symlinks, timeline gaps, trim time domains, and deterministic output settings.

## Hosted review/auth change

```text
packages/review-protocol
  -> apps/web/convex
  -> apps/web routes/components
```

Keep hosted identity and billing out of local engine contracts. Verify local desktop workflows remain independent of network/auth availability.

## Dependency upgrade

1. Upgrade direct manifests and regenerate lockfiles.
2. Keep all Effect package versions aligned with `vendor/effect/packages/effect/package.json`.
3. For generated Rust dependencies, edit `engines/protocol-rust/openapi-generator-templates/Cargo.mustache`, regenerate, and verify the generated manifest.
4. Check Swift direct pins and resolved transitive changes.
5. Run `bun outdated --recursive`, `cargo update --dry-run`, and `swift package show-dependencies`; use release metadata to check whether direct Cargo/Swift manifest pins are current and document intentional compatibility holds.
6. Run `bun install --frozen-lockfile`, `bun run repo:check`, and the full gate.

## Documentation or roadmap change

- Requirements belong in `docs/SPEC.md`.
- Execution status and ordering belong in `docs/ROADMAP.md`.
- Architecture boundaries belong in `docs/ARCHITECTURE.md`.
- Agent operations belong in `AGENTS.md` or the nearest nested agent guide.
- Review policy belongs in `REVIEW.md`.
- Historical migration documents should not become an alternate active backlog.

When a tracked feature merges, update its checkbox and implementation notes in the same PR.

`docs/doc_coverage_policy.json` records ratchet floors from the current documented public surface. Do not lower a floor to make a change pass; add API documentation and raise floors as coverage improves. Generated protocol surfaces currently remain measured so generator/template improvements can raise their baseline over time.
