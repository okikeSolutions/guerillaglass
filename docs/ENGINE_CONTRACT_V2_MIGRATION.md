# Engine Contract v2 Migration

This document defines the from-scratch migration plan for the Guerillaglass engine boundary.

The goal is to replace the current mixed `packages/engine` + Effect RPC + custom socket bridge shape with an Effect-native HTTP/OpenAPI contract architecture that is easier to generate native bindings from, easier to audit, and cleaner to evolve.

This project is not yet used externally, so this migration intentionally avoids shims, barrels, and backward compatibility layers.

## Decision Summary

Use Effect `HttpApi` as the TypeScript source of truth for the local native engine API.

Generate OpenAPI 3.1 from that contract and use it as the cross-language contract for native Swift/Rust engines. TypeScript app code should call an Effect service client, not raw HTTP, raw RPC, or native protocol details.

The new direction is:

```txt
packages/engine-contract
  Effect Schema domain models
  Effect HttpApi contract
  OpenAPI generation

packages/engine-client
  TypeScript Effect services
  Effect HttpApiClient-based local engine client
  native process launcher/readiness/auth lifecycle

engines/protocol-rust
  Rust generated DTOs/server helpers from OpenAPI

engines/protocol-swift
  Swift generated DTOs/server helpers from OpenAPI

engines/*
  native engine implementations using generated protocol bindings
```

Runtime direction:

```txt
React renderer
  -> Electrobun bridge
  -> Bun HostBridgeService / domain services
  -> packages/engine-client Effect services
  -> localhost HTTP + bearer token
  -> native engine sidecar
```

## Non-Goals

- No compatibility with the existing socket wire protocol.
- No compatibility with existing `packages/engine` public exports.
- No broad barrels.
- No transitional shims.
- No native implementation of Effect RPC internals.
- No generic retry/restart policy for engine operations.
- No exposing the native engine URL or auth token to the renderer.

## Why This Direction

Research in `vendor/effect` shows:

- `HttpApi` is designed as a shared declarative API contract consumed by server builders, generated clients, URL builders, OpenAPI generation, and reflection tools.
- `HttpApiEndpoint` records method, path, payload, success, error, params, query, headers, and annotations.
- `HttpApiClient` derives a type-safe HTTP client from the same `HttpApi` contract.
- `OpenApi.fromApi(api)` generates OpenAPI 3.1 documents from the contract.
- `HttpApiSecurity` supports bearer/API-key/basic security declarations and OpenAPI security metadata.
- `HttpApiMiddleware` is the intended place for authentication, authorization, request logging, tracing, rate limiting, schema-error normalization, and client request decoration.

This matches our needs better than making Swift/Rust speak Effect RPC:

- Effect Schema remains the source of truth.
- OpenAPI becomes the native interoperability artifact.
- Native bindings can be generated from a standard format.
- TypeScript remains Effect-native.
- Rust/Swift avoid coupling to `effect/unstable/rpc` message details.

## Package Layout

### `packages/engine-contract`

Owns the contract only.

Suggested structure:

```txt
packages/engine-contract/
  package.json
  tsconfig.json
  src/
    domains/
      agent.ts
      capture.ts
      export.ts
      permissions.ts
      project.ts
      recording.ts
      sources.ts
      system.ts
      timeline.ts
    shared/
      helpers.ts
      valueObjects.ts
    errors.ts
    httpApi.ts
    openApi.ts
  scripts/
    generate-openapi.ts
  generated/
    engine.openapi.json
```

Rules:

- Export explicit subpaths only.
- No `src/index.ts` barrel.
- Domain schemas must be transport-safe or clearly encode to transport-safe JSON.
- Schema annotations should be added where OpenAPI component names/descriptions are useful.
- The generated OpenAPI file is committed if native generation depends on it in CI.

### `packages/engine-client`

Owns TypeScript runtime access to native engines.

Suggested structure:

```txt
packages/engine-client/
  package.json
  tsconfig.json
  src/
    process/
      launch.ts
      readiness.ts
      trust.ts
    http/
      auth.ts
      client.ts
      errors.ts
    services/
      EngineClient.ts
      CaptureService.ts
      ProjectService.ts
      ExportService.ts
      PermissionsService.ts
      SourcesService.ts
      AgentService.ts
      SystemService.ts
```

Rules:

- App code should depend on domain services where possible.
- Low-level HTTP client details stay internal to `engine-client` unless there is a specific need.
- No generic retries for mutating/non-idempotent engine operations.
- Process lifecycle is scoped with Effect layers.
- Readiness stdout is only readiness; stderr is logging only.

### `engines/protocol-rust`

Owns generated Rust contract bindings and server helpers.

Suggested structure:

```txt
engines/protocol-rust/
  Cargo.toml
  build.rs
  src/
    lib.rs
    generated/
      types.rs
      server.rs
    auth.rs
    errors.rs
```

This crate should be usable by `engines/windows-native`, `engines/linux-native`, and shared Rust native foundations.

### `engines/protocol-swift`

Owns generated Swift contract bindings and server helpers.

Suggested structure:

```txt
engines/protocol-swift/
  Package.swift
  Sources/
    EngineProtocol/
      Generated/
        Types.swift
        Server.swift
      Auth.swift
      Errors.swift
```

This Swift package/target should be usable by `engines/macos-swift`.

Native language packages stay under `engines/` rather than `packages/` so `packages/` remains TypeScript workspace territory.

## HTTP API Shape

Prefer stable, readable HTTP endpoints, but do not force fake REST purity. The local engine is command-heavy, so command-shaped endpoints are acceptable when they are honest and clearer than pretending every operation is a resource update.

Examples such as `POST /v1/capture/start-window`, `POST /v1/recording/stop`, and `POST /v1/permissions/input-monitoring/open-settings` are intentionally command-shaped.

Effect `HttpApiEndpoint` detail: methods with request bodies should use `payload`; `GET`/no-body inputs should use `query`, `params`, or `headers`, not JSON payloads. This keeps generated clients, OpenAPI, and native implementations aligned.

### System

```txt
GET /v1/system/ping
GET /v1/engine/capabilities
```

### Permissions

```txt
GET  /v1/permissions
POST /v1/permissions/screen-recording/request
POST /v1/permissions/microphone/request
POST /v1/permissions/input-monitoring/request
POST /v1/permissions/input-monitoring/open-settings
```

### Sources

```txt
GET /v1/sources
```

### Capture / Recording

```txt
GET  /v1/capture/status
POST /v1/capture/start-display
POST /v1/capture/start-current-window
POST /v1/capture/start-window
POST /v1/capture/stop
GET  /v1/capture/preview-frame

POST /v1/recording/start
POST /v1/recording/stop
```

### Project

```txt
GET  /v1/project/current
POST /v1/project/open
POST /v1/project/save
GET  /v1/project/recents?limit=10
```

### Export

Use job-style endpoints for long-running work.

```txt
GET    /v1/export/info
POST   /v1/exports
GET    /v1/exports/:jobId
DELETE /v1/exports/:jobId
```

For cut-plan export:

```txt
POST /v1/exports/from-cut-plan
```

### Agent

Use job-style endpoints.

```txt
POST /v1/agent/preflight
POST /v1/agent/runs
GET  /v1/agent/runs/:jobId
POST /v1/agent/runs/:jobId/apply
```

## Streaming Strategy

Start boring and explicit.

Initial migration should use:

- normal request/response HTTP endpoints;
- polling with Effect `Schedule` for capture status and job status;
- job IDs for long-running export/agent work.

Do not introduce SSE/WebSocket in the first migration unless polling proves insufficient.

Later, if needed:

```txt
GET /v1/events
Accept: text/event-stream
```

or NDJSON:

```txt
GET /v1/events.ndjson
```

Typed events should still be represented in `engine-contract`, and documented in OpenAPI using content-type metadata or explicit schema components.

## Security Model

Use loopback HTTP with a per-process high-entropy bearer token.

Effect `HttpApiSecurity` should be used to describe bearer auth in the contract/OpenAPI, but it does not authenticate by itself. Authentication must be enforced by native server code, and by any TypeScript `HttpApiBuilder` test/dev server through `HttpApiMiddleware`.

### Startup

The Bun host:

1. Generates a random 256-bit token.
2. Starts the native engine with the token in environment.
3. Waits for a readiness line from stdout.
4. Builds the HTTP client with `Authorization: Bearer <token>`.

Readiness line:

```json
{
  "type": "guerillaglass.engine.ready",
  "protocol": "http",
  "host": "127.0.0.1",
  "port": 54231
}
```

Native engine:

- binds only to `127.0.0.1`;
- uses port `0` / ephemeral port;
- requires bearer auth for every API endpoint;
- may expose unauthenticated `/healthz` only if it leaks no sensitive data;
- never logs the token.

### HTTP Security Rules

- Do not bind to `0.0.0.0`.
- Do not use cookies.
- Do not put tokens in URLs or query strings.
- Do not enable permissive CORS.
- Reject unexpected `Origin` headers.
- Limit request body size.
- Validate every request payload.
- Encode all declared errors through the API error schema.
- Disable or authenticate OpenAPI docs in production.
- Redact local file paths and tokens from logs.

### Renderer Boundary

The renderer must never receive:

- engine base URL;
- engine bearer token;
- direct native process handles.

Renderer access stays through Electrobun bridge handlers and Bun-side services.

## Encoded JSON Semantics

Define encoded JSON semantics before native generation. Native DTO drift usually starts when TypeScript decoded types are assumed to be the wire format.

The contract must document and test OpenAPI output for:

- `Schema.Option` / nullable fields: the default v2 policy is omitted optional keys, not explicit JSON `null`.
- Optional keys and defaults: whether defaults are decode-only or emitted in JSON Schema.
- Branded values: branded strings/numbers encode as their primitive JSON type plus validation constraints.
- Literals and enums: emitted as OpenAPI-compatible `enum` values.
- Unions: expected `anyOf`/`oneOf` output and discriminator policy if needed.
- Path-like strings and URLs: whether they are plain strings, URI strings, file URLs, or app-specific strings.
- Date/time strings: exact format expectations.
- `undefined`/`void`: no request body vs JSON value must be explicit per endpoint; do not use JSON `null` as a stand-in for no body.

Add fixture tests for these semantics before depending on generated native code.

## Contract Error Model

Define stable engine error schemas in `packages/engine-contract/src/errors.ts`.

Important Effect `HttpApi` detail: response status is schema metadata. `HttpApiSchema.status(...)` only stores an annotation; unannotated success responses default to `200`, and unannotated error responses default to `500`. Therefore the contract must not rely on one unannotated `EngineError` schema plus prose mapping. Define status-specific error schemas and attach them to endpoints.

Suggested base shape:

```ts
EngineErrorBody = {
  code: string;
  message: string;
}
```

Suggested status-specific schemas:

```ts
EngineBadRequestError        // status 400, invalid_request | invalid_params
EngineUnauthorizedError      // status 401, permission_denied auth missing/invalid
EngineForbiddenError         // status 403, permission_denied authenticated but not allowed
EngineNotFoundError          // status 404, unknown resource/job
EngineConflictError          // status 409, needs_confirmation | invalid state
EngineUnprocessableError     // status 422, domain validation failure
EngineRuntimeError           // status 500, runtime_error
```

Each endpoint should declare the exact error schemas it can emit. Native server implementations must return the matching HTTP status and body shape.

Do not expose native stack traces to the renderer.

## Effect Implementation Sketch

Contract:

```ts
import { HttpApi, HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi";
import { Schema } from "effect";

export const SystemGroup = HttpApiGroup.make("system").add(
  HttpApiEndpoint.get("ping", "/v1/system/ping", {
    success: PingResult,
    error: EngineRuntimeError,
  }),
  HttpApiEndpoint.get("capabilities", "/v1/engine/capabilities", {
    success: CapabilitiesResult,
    error: EngineRuntimeError,
  }),
);

export const EngineApi = HttpApi.make("EngineApi").add(SystemGroup);
export const EngineOpenApi = OpenApi.fromApi(EngineApi);
```

Client:

```ts
import { HttpApiClient } from "effect/unstable/httpapi";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";

const rawClient = yield* HttpApiClient.make(EngineApi, {
  baseUrl: `http://${host}:${port}`,
  transformClient: (client) =>
    HttpClient.mapRequest(client, HttpClientRequest.bearerToken(engineToken)),
});
```

Wrap raw client access in domain services instead of exposing generated endpoint methods throughout the app.

## Migration Phases

### Phase 0: Generator Spike

Before building the migration, select and test OpenAPI generators for Swift and Rust.

This is the main architectural dependency. If generated native code is noisy, unsafe, incomplete, or awkward to route through, the contract shape should be adjusted before the rest of the migration is built.

Spike requirements:

- Generate Swift DTOs from a representative OpenAPI sample.
- Generate Rust DTOs from the same sample.
- Include representative schemas: optional fields, nullable fields, enums, unions, branded strings, nested objects, arrays, path strings, and status-specific errors.
- Verify generated DTOs are idiomatic enough to use in native code.
- Verify generated code can be formatted and linted in CI.
- Verify server-side use, not only client-side use.
- Lock generator names, versions, config files, and post-processing policy.

Do not proceed to broad implementation until this spike has a clear result.

Current Phase 0 spike findings are recorded in `docs/ENGINE_CONTRACT_V2_PHASE0_GENERATOR_SPIKE.md`.

Initial generator direction:

- Swift: prefer Apple `swift-openapi-generator` because it generates types, client, and server helpers through SwiftPM.
- Rust: prefer OpenAPI Generator CLI `rust-axum` as the first Rust server-helper candidate.
- Avoid OpenAPI Generator CLI `rust-server` unless a later spike resolves nullable compile failures.
- Avoid OpenAPI Generator CLI `swift6` for server implementation because it is client/model oriented for our needs.

Important contract constraint from the spike: avoid explicit JSON `null`; prefer omitted optional fields. Apple `swift-openapi-generator` currently warns on `null` schemas and skipped nullable fields in the sample. `rust-server` failed to compile with nullable fields. Nullable shapes must not enter the v2 contract unless both Swift and Rust generators are proven to handle them.

### Phase 1: Create New Packages

Status: complete.

Completed scope:

- Added `packages/engine-contract`.
- Moved/copied domain schemas from current `packages/engine/src/protocol` into explicit files.
- Added `httpApi.ts` with the new endpoint model.
- Added OpenAPI generation script.
- Added deterministic OpenAPI generation check immediately; generated output is committed and checked.
- Added `packages/engine-client` with Effect-native empty service shells.
- Updated `engines/protocol-rust` as a generated `rust-axum` binding/server-helper package for the new HTTP/OpenAPI contract.
- Updated `engines/protocol-swift` as an Apple `swift-openapi-generator` binding/server-helper package for the new HTTP/OpenAPI contract.
- Deleted/disconnected old exports rather than keeping compatibility.

Validation completed:

```sh
bun run protocol:generate-bindings
bun run protocol:typecheck
cargo check --manifest-path engines/protocol-rust/Cargo.toml
swift build --package-path engines/protocol-swift
```

Known follow-up: root `swift build` fails until the macOS engine implementation is migrated off the deleted legacy socket/RPC protocol types. That belongs to later implementation phases, not Phase 1 package creation.

### Phase 2: Contract Generation

Status: complete.

Completed scope:

- Generated `engine.openapi.json` from `EngineHttpApi`.
- Kept contract checks verifying generated OpenAPI is deterministic/current.
- Added OpenAPI snapshot/currentness tests in `packages/engine-contract/tests/openapi-snapshot.test.ts`.
- Added reflected `HttpApi` coverage tests in `packages/engine-contract/tests/http-api-coverage.test.ts` for every endpoint payload/success/error/params/query schema.
- Added encoded JSON semantics fixtures and tests in `packages/engine-contract/tests/fixtures/encoded-json` and `packages/engine-contract/tests/encoded-json-semantics.test.ts` for optional omission vs `null`, literals, refined path-like strings, and void/no-body endpoints.
- Wired `packages/engine-contract` full contract gate through `bun run check:contract:full`.
- Updated root `protocol:typecheck` to run the full engine-contract gate.
- Continued using the selected native generators and locked versions from Phase 0 via `bun run protocol:generate-bindings`.

Validation completed:

```sh
cd packages/engine-contract && bun run check:contract:full
bun run protocol:typecheck
```

Note: current schemas use refined primitive values more than TypeScript-only brands, so Phase 2 tests cover refined/branded wire semantics where applicable.

### Phase 3: TypeScript Client

- Implement native process launcher for HTTP readiness.
- Implement bearer-token request decoration with `HttpClient.mapRequest` + `HttpClientRequest.bearerToken`, or an explicit `HttpApiMiddleware.layerClient` if the contract requires client middleware.
- Implement `EngineClient` low-level service with `HttpApiClient`.
- Implement domain services:
  - `SystemService`
  - `PermissionsService`
  - `SourcesService`
  - `CaptureService`
  - `RecordingService`
  - `ProjectService`
  - `ExportService`
  - `AgentService`
- Update desktop app services to depend on domain services, not raw transport.

### Phase 4: Native Bindings and Server Helpers

- Generate Rust DTOs/server helpers in `engines/protocol-rust`.
- Generate Swift DTOs/server helpers in `engines/protocol-swift`.
- Treat server-helper generation as first-class, not optional. Types alone are insufficient.
- Server helpers should cover:
  - route/method dispatch;
  - bearer auth extraction and rejection;
  - request body size limits;
  - JSON body decoding;
  - status-specific error encoding;
  - success response encoding;
  - unsupported route/method handling;
  - fixture test hooks.
- Add golden fixtures:
  - TS encodes request body;
  - Rust/Swift decode it;
  - Rust/Swift encode response;
  - TS decodes it.

### Phase 5: Native HTTP Servers

- Replace socket server implementations with local HTTP servers.
- Bind to `127.0.0.1:0`.
- Enforce bearer auth.
- Emit HTTP readiness envelope.
- Implement endpoint handlers.
- Add request-size limits and origin/CORS hardening.

### Phase 6: Desktop Integration

- Replace `@guerillaglass/engine/client/liveBun` usage with `@guerillaglass/engine-client` services.
- Update `HostBridgeService` to call domain services.
- Remove old `EngineTransport` dependencies.
- Keep Electrobun RPC only for renderer/Bun boundary.

### Phase 7: Removal

Delete obsolete implementation:

- old `packages/engine` RPC group/client/wire protocol;
- old Rust socket protocol crate code;
- old Swift socket protocol code;
- old socket readiness env vars;
- old wire protocol tests.

No shims.

### Phase 8: Gates

Required checks:

```txt
bun run protocol:typecheck
bun run desktop:typecheck
bun run desktop:test
cargo test ...
swift test
OpenAPI generation check
native binding generation check
golden fixture parity tests
```

## Testing Strategy

### Contract Tests

- OpenAPI generation is deterministic.
- Every endpoint has declared success and error schemas.
- Every API endpoint requires bearer auth unless explicitly documented as public, such as a minimal `/healthz`.
- No production OpenAPI route is exposed unauthenticated.

### Client Tests

- Client attaches bearer token through `HttpClientRequest.bearerToken` / `HttpClient.mapRequest` or an explicit `HttpApiMiddleware.layerClient`.
- Client decodes declared errors.
- Client fails unknown HTTP statuses clearly.
- Client does not retry mutating operations by default.
- Client redacts token in logs/errors.

### Native Tests

- Server rejects missing token.
- Server rejects invalid token.
- Server accepts valid token.
- Server binds only loopback.
- Server enforces body-size limits.
- DTO fixture parity with TypeScript.

### Desktop Tests

- Renderer cannot access engine URL/token.
- Electrobun bridge remains thin.
- Host services enforce path grants/capabilities before engine operations.

## Open Questions

- Which OpenAPI generator should be used for Rust and Swift? This must be answered by Phase 0 before broad implementation.
- Should generated native bindings be committed or generated in CI?
- Should `/healthz` require auth?
- Should OpenAPI docs be generated only as a file, or also served in dev?
- How much polling is acceptable for capture status before SSE is needed?
- Should local HTTP later move to Unix sockets / named pipes while preserving OpenAPI-derived schemas?

## Preferred End State

The final architecture should be boring and explicit:

```txt
Effect Schema + HttpApi contract
  -> OpenAPI 3.1
  -> generated native bindings
  -> localhost HTTP sidecars
  -> TypeScript Effect domain services
```

Effect remains the TypeScript application model. OpenAPI is the cross-language native contract. The renderer stays behind Electrobun. Native engines stay isolated sidecars. Security is enforced at the Bun bridge and native HTTP boundary.
