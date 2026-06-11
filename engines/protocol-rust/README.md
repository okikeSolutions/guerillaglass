# protocol-rust

Generated Rust server bindings for the GuerillaGlass Engine Contract v2 HTTP/OpenAPI API.

## Source of truth

- TypeScript/Effect contract: `packages/engine-contract/src/httpApi.ts`
- Generated OpenAPI: `packages/engine-contract/generated/engine.openapi.json`
- Rust generator config: `engines/protocol-rust/openapi-generator-config.json`

This package is intentionally v2-only. It only exposes generated HTTP/OpenAPI bindings and server helpers.

## Regenerate

```bash
bun run protocol:generate-bindings
```

## Check

```bash
cargo check --manifest-path engines/protocol-rust/Cargo.toml
```
