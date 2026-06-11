# protocol-swift

Generated Swift bindings for the GuerillaGlass Engine Contract v2 HTTP/OpenAPI API.

## Source of truth

- TypeScript/Effect contract: `packages/engine-contract/src/httpApi.ts`
- Generated OpenAPI: `packages/engine-contract/generated/engine.openapi.json`
- Swift generator config: `engines/protocol-swift/Sources/EngineProtocol/openapi-generator-config.yaml`

This package is intentionally v2-only. It only exposes generated HTTP/OpenAPI bindings and server helpers.

## Regenerate input

The Apple generator runs as a SwiftPM plugin at build time. Refresh the checked-in OpenAPI input after contract changes:

```bash
cp packages/engine-contract/generated/engine.openapi.json \
  engines/protocol-swift/Sources/EngineProtocol/openapi.json
```

## Check

```bash
swift build --package-path engines/protocol-swift
```
