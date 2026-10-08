# Guerilla Glass agent guide

This file is the operational entry point for coding agents. Read it before changing code, then read the nearest nested `AGENTS.md` for the subsystem you touch.

## Mission and current priority

Guerilla Glass is a local-first recorder and polished demo editor with a separate hosted review plane. The product workflow is `Record -> Edit -> Deliver`.

The current release-defining work is the **Phase 2 polished demo editor core** in `docs/ROADMAP.md`. Follow the ordered “Suggested Phase 2 PR slices”; do not let hosted delivery, Agent Mode, or broad platform expansion outrun the editor core unless the task explicitly targets those tracks.

Normative product requirements live in `docs/SPEC.md`. Execution status and sequencing live in `docs/ROADMAP.md`. Keep roadmap checkboxes synchronized with merged implementation.

## Start here

| Need                        | Source of truth                     |
| --------------------------- | ----------------------------------- |
| Product requirements        | `docs/SPEC.md`                      |
| Current work and PR order   | `docs/ROADMAP.md`                   |
| System boundaries           | `docs/ARCHITECTURE.md`              |
| Change propagation          | `docs/CHANGE_MAP.md`                |
| Review expectations         | `REVIEW.md`                         |
| Timeline semantics          | `docs/TIMELINE_EDITING_DESIGN.md`   |
| Background framing v1       | `docs/BACKGROUND_FRAMING_DESIGN.md` |
| Accessibility and shortcuts | `docs/DESKTOP_ACCESSIBILITY.md`     |
| Agent Mode operations       | `docs/AGENT_MODE_RUNBOOK.md`        |
| Agent discoverability audit | `docs/AGENT_DISCOVERABILITY_AUDIT.md` |
| Release hardening           | `docs/RELEASE_HARDENING.md`         |

Documents named `ENGINE_CONTRACT_V2_*` and `MIGRATION.md` preserve migration history. They are useful rationale, but are not the active backlog unless `docs/ROADMAP.md` references them.

## Repository map

- `apps/desktop-electrobun`: Electrobun Bun host and React Creator Studio.
- `apps/web`: TanStack Start and Convex hosted review/auth shell.
- `packages/engine-contract`: Effect Schema/`HttpApi` source of truth and generated OpenAPI.
- `packages/engine-client`: Effect-native engine client and process launcher.
- `packages/review-protocol`: hosted review DTOs and schemas.
- `packages/ui`: shared UI primitives and styles.
- `engines/macos-swift`: production macOS capture/export engine.
- `engines/native-foundation`: shared Rust HTTP/native behavior.
- `engines/linux-native`, `engines/windows-native`: parity shells; do not imply production media parity.
- `engines/protocol-rust`, `engines/protocol-swift`: generated protocol bindings plus explicitly owned helpers/templates.
- `messages` and `project.inlang`: localization sources.
- `Scripts`: canonical generation, quality, coverage, and benchmark automation.
- `vendor`: pinned upstream source; avoid editing unless the task explicitly updates or patches a vendor.

## Non-negotiable architecture rules

1. Local capture, editing, project IO, playback, and export must work without hosted services.
2. Hosted auth, review, presence, and billing failures must fail open to local-only behavior.
3. TypeScript Effect schemas and `HttpApi` own the engine wire contract.
4. Native sidecars consume generated OpenAPI bindings; do not introduce Effect RPC internals into native engines.
5. The Electrobun renderer does not receive raw local media paths. Playback uses tokenized loopback media URLs.
6. Keep one scoped Effect runtime in the Bun host. Bridge request handlers are thin adapters, not a second application layer.
7. Preview, persisted project state, and native export must agree on shipped timeline and visual-edit semantics. A contract-only slice may introduce backward-compatible fields before renderer support only when defaults preserve existing output and the immediately following roadmap slice owns the wiring.
8. User-visible strings must use the shared localization source. Do not hand-edit generated `src/paraglide` output.
9. Cross-platform shells must not claim capabilities that their native implementation does not provide.
10. Prefer enforcing repeated review feedback with schemas, generators, lint rules, tests, or CI rather than prose alone.
11. Bun is the only JavaScript package manager. The Electrobun host uses `@effect/platform-node` rather than `@effect/platform-bun` for runtime stability. Configure TypeScript 7 and `@effect/tsgo` through the official `bunx @effect/tsgo setup` flow and its `effect-tsgo patch` prepare command; do not restore the `@effect/language-service` dependency or import TypeScript's removed compiler API in repository scripts.
12. Application path, filesystem, and cryptographic operations use Effect's `Path`, `FileSystem`, and `Crypto` services with platform layers at composition roots; do not add direct `node:path`, `node:fs`, or `node:crypto` dependencies to domain/application services.

## Generated and owned files

| Artifact                                                     | Edit source instead                                                | Regenerate                                              |
| ------------------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------- |
| `packages/engine-contract/generated/engine.openapi.json`     | `packages/engine-contract/src/**`                                  | `bun run protocol:generate-bindings`                    |
| `engines/protocol-swift/Sources/EngineProtocol/openapi.json` | engine contract                                                    | `bun run protocol:generate-bindings`                    |
| generated Rust protocol sources                              | engine contract and generator config/templates                     | `bun run protocol:generate-bindings`                    |
| `engines/protocol-rust/Cargo.toml` dependency defaults       | `engines/protocol-rust/openapi-generator-templates/Cargo.mustache` | `bun run protocol:generate-bindings`                    |
| `apps/*/src/paraglide/**`                                    | `messages/*.json` and `project.inlang`                             | `bun run i18n:compile`                                  |
| `apps/web/src/routeTree.gen.ts`                              | `apps/web/src/routes/**`                                           | generated by TanStack Router during typecheck/build/dev |
| lockfiles                                                    | dependency manifests                                               | appropriate package manager resolver                    |

After generation, inspect `git diff`; generated output must be deterministic. Do not “fix” generated output without fixing its source.

## Change discipline

- Keep changes scoped to one roadmap slice or maintenance purpose.
- Read existing tests before changing semantics.
- Preserve schema migration and backward compatibility for persisted projects.
- Add the narrowest useful test at the layer where a regression originates, then add parity coverage when behavior crosses renderer/native boundaries.
- If a reviewer identifies a repeatable class of problem, automate its prevention where practical.
- Update `docs/ROADMAP.md` in the same change when a tracked item becomes complete or its sequencing changes.
- Do not update historical migration status as if it were the active roadmap.

See `docs/CHANGE_MAP.md` for change-specific paths and required checks.

## Canonical commands

```bash
bun run bootstrap
bun run repo:check
bun run gate
```

Focused commands:

```bash
bun run gate:typescript
bun run gate:rust
bun run swift:test
bun run desktop:typecheck
bun run desktop:test
bun run desktop:test:ui
bun run desktop:acceptance
bun run web:typecheck
bun run protocol:typecheck
bun run protocol:generate-bindings
bun run docs:check
```

The full gate requires macOS for the production Swift path. On another platform, run all supported focused gates and clearly report what was not run.

## Completion checklist

Before declaring work complete:

- Run `bun run repo:check` and relevant focused tests.
- Run `bun run gate` when the platform supports it.
- On macOS, validate desktop/runtime work in the packaged application with Peekaboo as well as `bun run desktop:acceptance`: verify Peekaboo permissions through its GUI bridge, navigate the affected workflow, and retain native-window screenshots. Static, browser, and runtime-smoke evidence do not replace Peekaboo interaction.
- For every PR touching UI, attach rendered screenshots directly in the PR summary before review/merge; local file paths and artifact-only links do not satisfy this requirement. Desktop UI evidence must include the affected packaged-app state.
- Confirm generated files are current and deterministic for contract changes.
- Confirm preview/export/persistence parity for editor-model changes.
- Confirm new UI is localized, keyboard accessible, and covered by reduced-motion/focus conventions.
- Check `git diff --check` and review the final diff for accidental generated or vendor changes.
- Before merging a PR, run `bun run pr:check-review-threads -- <PR number>` and require zero unresolved review threads. A passing Greptile check or 5/5 summary does not replace addressing, replying to, and resolving every concrete comment, including outdated threads.
- Reconcile the roadmap and documentation.
- Report validation commands and any platform checks that remain for CI.
