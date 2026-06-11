# Migration Record

This document previously described the pre-v2 TypeScript engine package and legacy RPC transport. That architecture has been superseded.

Current engine architecture:

- `packages/engine-contract` owns the Effect Schema domain model, Effect `HttpApi`, endpoint inventory, OpenAPI generation, and contract tests.
- `packages/engine-client` owns the Effect-native HTTP client, Bun process launcher, readiness parsing, trust checks, bearer auth, and domain service layers.
- Native Swift/Rust engines use generated OpenAPI bindings/server helpers under `engines/protocol-swift` and `engines/protocol-rust`.
- Desktop backend code depends on `@guerillaglass/engine-client` services and `@guerillaglass/engine-contract` schemas/types.

The obsolete consolidated TypeScript engine package was removed. See `docs/ENGINE_CONTRACT_V2_MIGRATION.md` for the active Engine Contract v2 migration record.
