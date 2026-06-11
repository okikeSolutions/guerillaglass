# Engine Contract v2 Phase 0 Generator Spike

Phase 0 validates whether OpenAPI-first native generation is practical before the broader engine contract migration.

## Spike Input

A representative OpenAPI 3.1 sample was created under a temporary workspace and included:

- bearer security scheme;
- command-shaped endpoint: `POST /v1/capture/start-window`;
- query/path endpoint: `GET /v1/exports/{jobId}`;
- simple endpoint: `GET /v1/system/ping`;
- enums/literals;
- branded/path-like strings represented as constrained strings;
- optional fields;
- nullable fields via `anyOf: [T, null]`;
- status-specific error responses;
- nested objects and arrays.

The temporary generated files were intentionally not committed.

## Tools Tested

### OpenAPI Generator CLI 7.23.0

Command used:

```txt
npx --yes @openapitools/openapi-generator-cli version
```

Result:

```txt
7.23.0
```

Available relevant generators included:

```txt
rust-axum
rust-server
rust
swift6
```

### Rust: `rust-axum`

Command shape:

```txt
npx --yes @openapitools/openapi-generator-cli generate \
  -g rust-axum \
  -i engine-spike.openapi.json \
  -o gen-rust-axum \
  --additional-properties=packageName=engine_spike
```

Result:

- Generation succeeded.
- `cargo check` succeeded after adding a temporary `[workspace]` table to keep the generated crate outside the repo workspace.
- Generated Axum server helpers include:
  - route registration;
  - bearer auth extraction hook;
  - request JSON decoding;
  - generated response enums by status;
  - response encoding;
  - validation via `validator`.

Notable generated shape:

- API trait methods receive `claims`, body, path params, method/host/cookies.
- Bearer auth is represented through an `ApiAuthBasic` trait using `BasicAuthKind::Bearer`.
- Nullable fields generate a Rust `Nullable<T>` wrapper for some shapes.

Concerns:

- The generated code is heavy.
- It includes generic XSS validation helpers that may not be useful for a local engine API.
- OpenAPI 3.1 support prints a beta warning.
- We need generator config/post-processing policy before adopting it.

Initial assessment: **viable Rust server helper candidate**.

### Rust: `rust-server`

Command shape:

```txt
npx --yes @openapitools/openapi-generator-cli generate \
  -g rust-server \
  -i engine-spike.openapi.json \
  -o gen-rust-server \
  --additional-properties=packageName=engine_spike_server
```

Result:

- Generation succeeded.
- `cargo check` failed on nullable fields generated from `anyOf: [T, null]`.
- Errors included incompatible `Option<String>` vs `Option<Nullable<_>>` and validation trait issues for `Nullable<String>`.

Initial assessment: **not viable for our contract unless nullable/null semantics are removed or heavily constrained**.

### Swift: OpenAPI Generator CLI `swift6`

Command shape:

```txt
npx --yes @openapitools/openapi-generator-cli generate \
  -g swift6 \
  -i engine-spike.openapi.json \
  -o gen-swift6 \
  --additional-properties=projectName=EngineSpike,responseAs=AsyncAwait
```

Result:

- Generation succeeded.
- `swift build` succeeded.
- Generated a Swift client package with Codable models.

Concerns:

- It generated client APIs, not server routing helpers.
- Nullable fields collapsed to ordinary optional properties; absent vs explicit `null` is not preserved.
- Generated API files contained awkward output for empty header dictionaries, though it compiled.

Initial assessment: **acceptable only as a client/model generator; not sufficient for native server helper needs**.

### Swift: Apple `swift-openapi-generator` 1.12.2

A temporary Swift package was created with:

```swift
.package(url: "https://github.com/apple/swift-openapi-generator", from: "1.8.0")
.package(url: "https://github.com/apple/swift-openapi-runtime", from: "1.8.0")
.package(url: "https://github.com/apple/swift-openapi-urlsession", from: "1.0.0")
```

Config:

```yaml
generate:
  - types
  - client
  - server
accessModifier: public
```

Resolved versions:

```txt
swift-openapi-generator 1.12.2
swift-openapi-runtime   1.12.0
swift-openapi-urlsession 1.3.0
```

Result with nullable sample:

- `swift build` succeeded.
- Generated `Types.swift`, `Client.swift`, and `Server.swift`.
- Generated server registration helpers through `APIProtocol.registerHandlers(...)` and `ServerTransport`.
- Warnings were emitted for `null` schemas:

```txt
Schema "null" is not supported, reason: "schema type", skipping
```

Important consequence:

- Properties using `anyOf: [T, null]` were skipped from generated Swift types.
- This is unacceptable if the contract relies on explicit JSON `null`.

Result with a no-null variant:

- `swift build` succeeded.
- No null-schema warnings were emitted.
- Server and client helpers generated cleanly.

Initial assessment: **best Swift candidate if the contract avoids explicit JSON null and uses omitted optional fields instead**.

## Key Finding: Avoid Explicit JSON `null`

The strongest cross-generator finding is that explicit JSON `null` is the main portability problem.

- `rust-axum` handled nullable fields acceptably.
- `rust-server` failed to compile with nullable fields.
- OpenAPI Generator `swift6` compiled but lost absent/null distinction.
- Apple `swift-openapi-generator` warned and skipped `null` fields entirely.

Recommendation:

```txt
Do not use explicit JSON null in Engine Contract v2 unless a generator-specific spike proves that exact shape works in both Swift and Rust.
```

Prefer:

```txt
optional key omitted = value absent
```

Instead of:

```json
"field": null
```

This affects current schemas that model absence with `null`. During migration, convert those fields to omitted optional keys where possible.

## Recommended Generator Direction

### Swift

Prefer Apple `swift-openapi-generator`.

Reasons:

- Native Swift ecosystem fit.
- Generates both client and server protocols/helpers.
- Uses `OpenAPIRuntime` abstractions.
- Clean server registration shape.
- Built through SwiftPM plugin.

Conditions:

- Avoid explicit JSON null.
- Lock package versions.
- Add CI build of generated package.
- Add tests around optional/omitted semantics.

### Rust

Prefer OpenAPI Generator CLI `rust-axum` as the first Rust candidate.

Reasons:

- Generates compiling Axum server helpers.
- Provides route registration and bearer auth hook.
- Generates response enums by HTTP status.
- Reasonable fit for local HTTP engine server.

Conditions:

- Lock OpenAPI Generator CLI version.
- Decide whether generated Axum dependency stack is acceptable.
- Add post-processing policy if generated code is too noisy.
- Evaluate body-size-limit integration and token auth implementation in generated hooks.
- Avoid or minimize nullable schemas.

Do not use `rust-server` unless a later spike resolves nullable compile failures and validates the generated server architecture.

## Contract Rules To Feed Back Into Migration

1. Avoid explicit JSON `null`; prefer omitted optional fields.
2. Avoid anonymous inline schemas for important response bodies; give them named component schemas to prevent generated names like `systemPing_200_response`.
3. Keep command-shaped endpoints when honest.
4. Use status-specific error schemas.
5. Require generated server helpers, not just DTOs.
6. Gate OpenAPI generation immediately.
7. Add Swift and Rust generated-package build checks early.

## Next Phase 0 Tasks

- Add these generator choices to the migration document.
- Create committed representative fixture OpenAPI for generator regression tests.
- Convert the planned contract semantics to no-null optional fields.
- Decide whether `rust-axum` generated server helpers are acceptable or whether custom Rust server helpers should be generated from OpenAPI instead.
- Add a second spike once `packages/engine-contract` emits real Effect `HttpApi` OpenAPI, not a hand-written sample.
