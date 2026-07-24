# Guerilla Glass review guide

Use this rubric for human and agent review. Report concrete defects with file/line evidence; distinguish blockers from optional improvements. A passing build is necessary but not sufficient when behavior crosses architectural boundaries.

## Universal review

- **Scope:** The change has one coherent purpose and does not silently expand product scope.
- **Correctness:** Invalid, empty, interrupted, and boundary states are handled, not only the happy path.
- **Architecture:** Ownership follows `AGENTS.md` and `docs/ARCHITECTURE.md`; no convenience bypass creates a second source of truth.
- **Automation:** Recurring failure classes are prevented by a type, schema, lint, test, generator, or CI check when practical.
- **Tests:** Tests assert externally meaningful behavior and would fail before the fix.
- **Documentation:** Active roadmap state and operational guidance match the implementation.
- **Security:** File paths, bearer tokens, loopback origins, symlinks, and untrusted payloads retain defensive validation.
- **Dependencies:** Manifest, lockfile, generated templates, and vendor pins remain aligned. Bun remains the only JavaScript package manager, and Effect runtime integrations use `@effect/platform-node` rather than `@effect/platform-bun`.

## Desktop and UI

- Host/renderer bridge handlers remain typed and thin.
- Long-lived host resources are scoped through the existing Effect runtime and Node platform layer.
- Application path, filesystem, and cryptographic operations depend on Effect `Path`, `FileSystem`, and `Crypto` services rather than direct Node core imports.
- User-visible text comes from `messages/*.json`; both `en-US` and `de-DE` are updated.
- Controls are keyboard reachable, have visible focus, expose names/state, and respect reduced motion.
- Shortcuts use the shared registry and honor user overrides/conflict validation.
- Loading, degraded, permission-denied, timeout, and unavailable-engine states remain actionable.
- Browser tests cover interaction semantics that DOM-only unit tests cannot validate.

## Timeline and editor semantics

- Pure timeline commands remain deterministic and independently tested.
- Ripple and non-ripple behavior preserve documented clip/gap invariants.
- Selection and playhead outcomes are explicit after destructive edits.
- Preview maps program time to source time correctly, including gaps and media-end transitions.
- Project save/load and migrations preserve the model.
- Native export matches preview duration, ordering, gaps, trims, and camera transforms.

## Engine contract and native code

- Effect Schema/`HttpApi` changes are the wire-contract source of truth.
- Domain IDs, tokens, paths, and URL/path handles retain `Schema.brand` types through engine-client and bridge internals; raw primitives are converted at boundaries.
- OpenAPI and Swift/Rust bindings regenerate without unexplained diffs.
- `engines/protocol-rust/Cargo.toml` dependency changes originate in `openapi-generator-templates/Cargo.mustache`.
- Swift and Rust handlers use generated request/response types rather than parallel DTOs.
- New capabilities are advertised only where implemented.
- Cross-platform parity tests distinguish protocol parity from production media parity.
- Capture/export changes consider cancellation, cleanup, backpressure, and resource lifetime.

## Project persistence

- New persisted fields have stable defaults and explicit validation constraints.
- Existing project versions still load or receive a tested migration.
- Paths cannot escape the project package through traversal or symlinks.
- Persisted settings flow through contract, renderer, native engine, and export where applicable.
- Unknown or malformed values fail predictably rather than being partially applied.

## Hosted plane

- Hosted services do not become prerequisites for local capture/edit/export.
- Authentication and billing apply only to hosted collaboration capabilities.
- Shared review DTO changes remain versionable and do not leak local media paths.
- Failure and offline behavior degrades to local-only operation.

## Release and maintenance

- Dependency versions are compatible across workspaces and pinned vendor sources.
- Package/release metadata carries the intended version and channel semantics.
- Signing/notarization secrets are not required for documented unsigned dry runs.
- Build artifacts are reproducible from committed manifests, templates, and lockfiles.

## Required evidence

The author should list commands actually run and identify checks deferred to CI or another platform. For desktop/runtime changes on macOS, code-level tests alone are insufficient: include browser-test evidence where applicable, a real packaged-app runtime report, and Peekaboo navigation of the affected workflow with native-window screenshots. Peekaboo evidence is required even when the invoking terminal lacks Screen Recording permission because the permissioned GUI bridge can capture the app. For generated changes, include the generation command and a clean determinism check.

Before merge, every actionable review comment must be addressed with a code/docs change or an evidence-backed reply, and every review thread must be explicitly resolved. This includes outdated threads: outdated is not equivalent to addressed. Run `bun run pr:check-review-threads -- <PR number>` and require zero unresolved threads. Greptile confidence and summary status are additional signals, not substitutes for this gate.
