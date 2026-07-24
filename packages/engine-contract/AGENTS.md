# Engine contract agent guide

Read the root `AGENTS.md` and `docs/CHANGE_MAP.md` first.

This package is the source of truth for the native engine wire protocol. Domain models use Effect Schema and operations are assembled in `src/httpApi.ts`. Generated OpenAPI and native bindings are derivatives.

## Rules

- Define reusable constrained values in domain/shared schema modules rather than duplicating validation.
- Keep transport errors explicit and serializable.
- Add encoding/decoding and operation-shape tests for contract changes.
- Do not hand-edit `generated/engine.openapi.json`.
- After a contract change, run root `bun run protocol:generate-bindings`; this also updates native OpenAPI inputs and Rust bindings.
- Native handlers and `packages/engine-client` should consume generated/contract types rather than parallel DTOs.
- Persisted project changes require defaults, compatibility/migration consideration, and preview/export parity.

## Checks

```bash
(cd packages/engine-contract && bun run check:contract:full)
bun run protocol:generate-bindings
cargo fmt --all
bun run protocol:check-determinism
```
