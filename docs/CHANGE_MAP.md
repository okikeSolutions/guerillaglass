# Change map

This guide maps common changes to their sources of truth, propagation path, and minimum validation. Read the nearest subsystem `AGENTS.md` as well.

## Verification selection

Run commands from the repository root unless a command specifies another directory. Run `bun run repo:check` for every change, then select every applicable row below. Inspect the diff and the propagation paths in this document before narrowing the test selection. Execute resource-heavy checks sequentially.

### Local check selection

| Changed area | Local checks | Include when behavior crosses boundaries |
| --- | --- | --- |
| Documentation or agent guidance | `bun run docs:check`; `bun run repo:test` for verification automation changes | Check links and command names with `bun run repo:check`. |
| Verification scripts | `bun run repo:test`; `bun run js:format:check` | Use stubbed orchestration tests; an explicitly requested real full run can measure timing. |
| Desktop TypeScript host or renderer | `bun run desktop:typecheck`; focused unit tests below | Browser tests for interaction; packaged acceptance and Peekaboo for desktop/runtime work on macOS, as required by root `AGENTS.md`. |
| Hosted web TypeScript | `bun run i18n:compile:web`; `bun run web:typecheck`; focused web tests below | Include shared review-protocol consumers if DTOs change. |
| Rust native implementation | `bun run gate:rust:fast <crate>`; focused Rust tests below | For shared foundation changes, compile the workspace with `bun run gate:rust:fast` and test affected consumers. |
| Swift native implementation | `bun run gate:swift:fast <target>`; focused Swift tests below | For engine handlers or changes spanning modules, use `bun run gate:swift:fast` to compile the engine product; add renderer/native parity tests for editor semantics. |
| Engine contract or generated protocol | `bun run protocol:typecheck`; `bun run protocol:generate-bindings`; `bun run protocol:check-determinism`; `bun run gate:protocol:fast` | Run affected native and engine-client tests. Generated Rust and Swift consumers both need compilation, even for a TypeScript-only source edit. |
| Dependency manifests or lockfiles | `bun run repo:check` after resolving dependencies | Select all affected language/consumer rows. Broad compiler/runtime upgrades need wider affected suites; record full CI evidence before merge. |

`repo:check` validates the root package script names in this table. Keep table commands rooted here; package-specific test invocations belong below.

### Focused test selection and target discovery

Read existing tests and select the narrowest file, suite, or test filter that covers the changed behavior and its callers. A compile check does not execute tests. Fast Rust checks cover default library/binary targets; test, example, and benchmark code needs the relevant test/build command. Swift `--filter` narrows execution but may still build the package's test targets.

- Rust crate names come from each workspace member's `Cargo.toml`, starting with the members in root `Cargo.toml`. Example: `cargo test -p native-foundation -j 2 <test-filter> -- --test-threads=2`. Omit the filter to test the whole affected crate. Use `cargo clippy -p native-foundation --all-targets -j 2 -- -D warnings` for affected lint feedback.
- Swift module paths, target names, and test-target dependencies come from root `Package.swift`. Example: capture module edits use `bun run gate:swift:fast Capture`, then `swift test -j 2 --no-parallel --filter CaptureTests`. Engine handlers use the default engine-product fast check. Fast checks require a current `Package.resolved` and disable automatic dependency resolution; resolve intentional dependency changes separately.
- Desktop unit tests: `bun run --cwd apps/desktop-electrobun test:vitest -- --run tests/<file>.test.ts --maxWorkers 2`. Browser tests: `bun run --cwd apps/desktop-electrobun test:ui -- --run tests/ui/<file>.browser.test.tsx --maxWorkers 2`. These wrappers compile localization. Confirm filenames in `tests` and the Vitest include patterns before selecting them.
- Web tests: compile localization as listed in the table, then `bun run --cwd apps/web test:ci -- --run <test-file> --maxWorkers 2`. If no relevant tests exist, report that and typecheck the affected app.
- Engine-client tests: `bun run --cwd packages/engine-client test -- <test-file> --maxWorkers 2`. Contract tests: `bun run --cwd packages/engine-contract test -- <test-file> --maxWorkers 2`. Inspect each package manifest for its runner and argument syntax.
- For changes spanning preview, persistence, and export, select their unit tests and the relevant parity tests together. `bun run desktop:test:e2e` exercises the Rust Windows/Linux shells. Production macOS export parity requires Swift tests and packaged workflow evidence comparing preview, saved/reopened project state, and exported output. Desktop UI/runtime work retains packaged acceptance and Peekaboo requirements from root `AGENTS.md`; bridge setup is in the desktop [Test & Coverage guide](../apps/desktop-electrobun/README.md#test--coverage).

### CI, full local validation, and failure logs

Routine local completion uses the selected checks above. Run `bun run gate:local`, also available as `bun run gate`, when the user explicitly requests the full local gate. It requires macOS for production Swift checks. On another platform, run supported focused checks and report the unavailable Swift path.

The full local gate runs repository, documentation, and formatting checks first, then TypeScript, Rust, and Swift suites sequentially. The first failure stops the run. `GG_GATE_JOBS` defaults to two and controls Vitest workers, Cargo build jobs and test threads, and Swift build jobs. The full and TypeScript gates also export `CARGO_BUILD_JOBS` so Cargo builds launched by desktop tests inherit the limit. Swift tests run without parallel test execution. Native fast checks use the separate `GG_NATIVE_FAST_JOBS` setting, also defaulting to two. Direct focused commands need their own worker flags, as shown above; desktop parity/security tests that launch Cargo also need `CARGO_BUILD_JOBS=2`. Keep `target` and `.build` between runs to reuse compiler artifacts. Two workers are a conservative resource default, not a measured speed optimum.

The runner prints its `.tmp/gate-logs/run.*/` directory. Open that run's `summary.tsv` for stage status and duration, then the failing stage's `.log` for complete output. Read the failure excerpt and full log before rerunning; rerun the smallest failing check after fixing it.

[CI](../.github/workflows/full_gate.yml) runs separate TypeScript, Rust, Swift, and protocol-generation jobs, including coverage thresholds, desktop browser tests, packaged runtime smoke, and generated-file freshness. Passing the full local gate does not establish that all CI-only checks passed. Report actual commands run, selected test scope, and checks still pending in CI; reviewers assess whether that scope covers the change.

Swift coverage uses the native SwiftPM build system to aggregate all test targets consistently. Its historical repository thresholds measure owned engine and test sources, excluding generated build output and dependencies. Product-only totals are reported separately; critical production-file thresholds remain enforced. `target/coverage/swift-owned-summary.json` records the weighted counts alongside the original `swift-summary.json`.

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
   The Rust OpenAPI generator requires Java on `PATH`; the script checks for a JDK before generation. CLI configuration lives in root `openapitools.json`.
4. Format generated Rust with `cargo fmt --all`.
5. Implement client and native handlers using generated types.
6. Add native and parity tests.
7. Run `bun run protocol:check-determinism`; it hashes generated artifacts, regenerates them, and fails if the second generation changes those artifacts.

Local checks: use the engine-contract/generated-protocol row in [Verification selection](#verification-selection), then select tests for the affected handlers and engine client. CI runs the full native suites.

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

Local checks: select desktop tests for the command, controller, and interaction, plus Swift and engine-client parity tests when native semantics change. Follow [Verification selection](#verification-selection) and retain packaged-app evidence for desktop/runtime changes.

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

Active compatibility holds:

- Better Auth stays on `1.6.33` while `@convex-dev/better-auth@0.12.5` requires `better-auth >=1.6.11 <1.7.0`.
- The repository and CI use Bun `1.4.1`. Electrobun `2.0.1` controls its packaged Bun runtime and currently embeds Bun `1.4.0`; Electrobun v2 no longer supports an independent `bunVersion` setting. Remove this note when an Electrobun release embeds Bun `1.4.1` or newer.

1. Upgrade direct manifests and regenerate lockfiles.
2. Keep all Effect package versions aligned with `vendor/effect/packages/effect/package.json`.
3. For generated Rust dependencies, edit `engines/protocol-rust/openapi-generator-templates/Cargo.mustache`, regenerate, and verify the generated manifest.
4. Check Swift direct pins and resolved transitive changes.
5. Run `bun outdated --recursive`, `cargo update --dry-run`, and `swift package show-dependencies`; use release metadata to check whether direct Cargo/Swift manifest pins are current and document intentional compatibility holds.
6. Run `bun install --frozen-lockfile`, `bun run repo:check`, and the affected rows in [Verification selection](#verification-selection). Full CI validation remains required before merge; run the full local gate when explicitly requested.

## Documentation or roadmap change

- Requirements belong in `docs/SPEC.md`.
- Execution status and ordering belong in `docs/ROADMAP.md`.
- Architecture boundaries belong in `docs/ARCHITECTURE.md`.
- Agent operations belong in `AGENTS.md` or the nearest nested agent guide.
- Review policy belongs in `REVIEW.md`.
- Historical migration documents should not become an alternate active backlog.

When a tracked feature merges, update its checkbox and implementation notes in the same PR.

`docs/doc_coverage_policy.json` records ratchet floors from the current documented public surface. Do not lower a floor to make a change pass; add API documentation and raise floors as coverage improves. Generated protocol surfaces currently remain measured so generator/template improvements can raise their baseline over time.
