# Engine Contract v2 Migration

This document defines the from-scratch migration plan for the Guerillaglass engine boundary.

The goal is to replace the old consolidated TypeScript engine package, RPC transport, and custom bridge shape with an Effect-native HTTP/OpenAPI contract architecture that is easier to generate native bindings from, easier to audit, and cleaner to evolve.

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

- No compatibility with the previous local transport protocol.
- No compatibility with existing old consolidated engine package public exports.
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
- Rust/Swift avoid coupling to Effect RPC message details.

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

Do not introduce push streaming in the first migration unless polling proves insufficient.

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
  "type": "guerillaglass.engine.http.ready",
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
- Moved/copied domain schemas from current the old consolidated engine package protocol sources into explicit files.
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

Phase 5 update: root `swift build` now resolves the generated Swift OpenAPI runtime/plugin dependencies and Hummingbird transport. Remaining macOS endpoint business handlers still need to be ported from their legacy JSON-value response helpers into generated `APIProtocol` operations.

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

Status: complete.

Completed scope:

- Implemented HTTP readiness parsing and loopback validation in `packages/engine-client/src/process/readiness.ts`.
- Implemented process trust checks in `packages/engine-client/src/process/trust.ts`.
- Implemented Bun-backed native HTTP process launcher in `packages/engine-client/src/process/launchBun.ts`.
- Generated per-process bearer tokens and passed v2 HTTP environment variables to native engines:
  - `GG_ENGINE_TRANSPORT=http`
  - `GG_ENGINE_HTTP_AUTH_TOKEN=...`
- Implemented `EngineClient` low-level service with `HttpApiClient.make(EngineHttpApi, ...)`.
- Implemented bearer-token request decoration with `HttpClient.mapRequest` + `HttpClientRequest.bearerToken`.
- Implemented Bun HTTP client layer with `@effect/platform-bun/BunHttpClient`.
- Implemented domain services:
  - `SystemService`
  - `PermissionsService`
  - `SourcesService`
  - `CaptureService`
  - `RecordingService`
  - `ProjectService`
  - `ExportService`
  - `AgentService`
- Updated desktop app composition to derive domain services from the low-level `engineClientLayer`.
- Updated desktop service logic to depend on domain services instead of raw transport or low-level `EngineClient`:
  - `HostBridgeService` uses the domain services directly.
  - `ProjectSessionElectrobun` uses `ProjectService`.
  - capture status publishing uses polling through `CaptureService.status`.
- Removed desktop app dependency on the legacy engine transport service, legacy RPC client usage, old connection concepts, and `capture.statusStream`.
- Replaced desktop imports from old engine protocol/client paths with `@guerillaglass/engine-contract` and `@guerillaglass/engine-client` paths.
- Updated desktop tests for polling, optional omission instead of explicit `null`, the `{ frame?: ... }` preview-frame shape, and `engineClientLayer`.
- Added/updated Phase 3 tests for:
  - bearer request decoration;
  - low-level generated-client wrapping;
  - domain service delegation;
  - desktop composition having no legacy transport service;
  - desktop service logic using domain services instead of low-level `EngineClient`.

Validation completed:

```sh
cd apps/desktop-electrobun && bun run typecheck
cd packages/engine-client && bun run test && bun run typecheck
bun run protocol:typecheck
cd apps/desktop-electrobun && bun run test:vitest
cd apps/desktop-electrobun && bun run test:bun
```

Phase 5 update: the desktop HTTP parity e2e coverage now launches the Rust native Windows/Linux engines directly. Legacy TypeScript Windows/Linux engines were removed instead of being ported to v2 HTTP.

### Audit: Phases 1-3 Against `vendor/effect`

Status: complete, no blocking Effect API mismatches found before Phase 4.

Audited Effect APIs:

- `vendor/effect/packages/effect/src/unstable/httpapi/HttpApi.ts`
- `vendor/effect/packages/effect/src/unstable/httpapi/HttpApiEndpoint.ts`
- `vendor/effect/packages/effect/src/unstable/httpapi/HttpApiGroup.ts`
- `vendor/effect/packages/effect/src/unstable/httpapi/HttpApiClient.ts`
- `vendor/effect/packages/effect/src/unstable/httpapi/HttpApiMiddleware.ts`
- `vendor/effect/packages/effect/src/unstable/httpapi/OpenApi.ts`
- `vendor/effect/packages/effect/src/unstable/http/HttpClient.ts`
- `vendor/effect/packages/effect/src/unstable/http/HttpClientRequest.ts`

Findings:

- `HttpApi`/`HttpApiGroup` composition is correct for the documented ordering rules: groups are added before `.middleware(EngineAuthMiddleware)`, so the middleware applies to every current endpoint.
- Endpoint declarations match `HttpApiEndpoint`'s model: method/path/payload/success/error/params/query schemas are declared at the contract layer and reflected into generated clients/OpenAPI.
- `EngineAuthMiddleware` correctly uses `HttpApiMiddleware.Service` with `HttpApiSecurity.bearer`; OpenAPI generation emits an `EngineBearer` HTTP bearer scheme and every operation includes the security requirement.
- `EngineAuthMiddleware` does not set `requiredForClient`, so `HttpApiMiddleware.layerClient` is not required by Effect's generated client type. Client-side auth is correctly implemented as a lower-level `HttpClient` transform.
- `HttpApiClient.make` usage is aligned with Effect's constructor: `baseUrl` is passed through the generated client options, and bearer auth is applied with `transformClient`.
- `HttpClient.mapRequest` + `HttpClientRequest.bearerToken` is aligned with Effect's HTTP client API; `bearerToken` sets the `Authorization: Bearer ...` header.
- `OpenApi.fromApi(EngineHttpApi)` is the intended Effect-native OpenAPI generation path. Generated output is OpenAPI 3.1, deterministic, and contains no explicit `"null"` or `nullable` schema markers.
- Desktop Phase 3 now depends on domain services derived from the low-level `EngineClient`; low-level `EngineClient` remains only at composition boundaries.
- No source imports use `.js` extensions, broad barrels, old RPC client/server modules, or old transport desktop composition paths.

Validation completed during audit:

```sh
cd packages/engine-contract && bun run check:contract:full
cd packages/engine-client && bun run test && bun run typecheck
cd apps/desktop-electrobun && bun run typecheck
cargo check --manifest-path engines/protocol-rust/Cargo.toml
swift build --package-path engines/protocol-swift
```

Additional audit checks:

- Generated OpenAPI reports 28 operations and zero operations missing `EngineBearer` security.
- Generated OpenAPI has no explicit `"null"` literal or `nullable` marker.
- Searches found no desktop source use of legacy transport composition, `capture.statusStream`, legacy Effect RPC imports, or old consolidated engine package client/protocol imports.

Non-blocking cleanup candidates after Phase 4:

- Tighten remaining `any` casts in `packages/engine-client/src/service.ts` around generated `HttpApiClient` call shapes.
- Either enforce `requestTimeoutMs` in the HTTP client layer or remove it from `EngineClientOptions` if timeout policy remains out of scope.

### Phase 4: Native Bindings and Server Helpers

Status: complete.

Completed scope:

- Generated Rust DTOs/server helpers in `engines/protocol-rust`:
  - `src/models.rs` for generated DTOs;
  - `src/apis/*` for status-specific response enums and implementation traits;
  - `src/server/mod.rs` for generated Axum route registration, request decoding, auth extraction hooks, and response encoding.
- Generated Swift DTOs/client/server helpers in `engines/protocol-swift` with Apple `swift-openapi-generator` configured for `types`, `client`, and `server` output.
- Treated server-helper generation as first-class by testing generated server dispatch instead of testing DTOs only.
- Added minimal policy-specific Swift middleware where the generator/runtime does not enforce local engine policy directly:
  - `EngineBearerAuthMiddleware` for per-process bearer token enforcement;
  - `EngineBodyLimitMiddleware` for known-size request body rejection.
- Added golden fixtures under `docs/fixtures/engine-contract-v2/golden`:
  - `capture-start-display.request.json`;
  - `capture-status.response.json`;
  - `engine-unauthorized.response.json`.
- Added TS golden fixture tests in `packages/engine-contract/tests/golden-fixtures.test.ts` proving Effect Schema encodes request bodies and decodes native response/error fixture shapes.
- Added Rust server-helper tests in `engines/protocol-rust/tests/server_helpers.rs` covering:
  - generated route dispatch;
  - unsupported method handling (`405`);
  - unsupported route handling (`404`);
  - bearer auth extraction/rejection;
  - Axum JSON request decoding;
  - Axum default request body limit behavior (`413` for oversized JSON);
  - malformed JSON rejection;
  - success response encoding;
  - declared status-specific bad-request response encoding;
  - golden fixture decode/encode hooks.
- Added Swift server-helper tests in `engines/protocol-swift/Tests/EngineProtocolTests/EngineProtocolTests.swift` covering:
  - generated DTO decode/encode against golden fixtures;
  - bearer middleware allow/reject behavior;
  - body limit middleware rejection;
  - generated `APIProtocol.registerHandlers(on:)` execution through a test `ServerTransport`;
  - JSON body decoding through the generated server helper;
  - success response encoding through the generated server helper;
  - declared bad-request response encoding through the generated server helper;
  - unsupported route/method behavior in the test transport.

Validation completed:

```sh
cd packages/engine-contract && bun run test
cargo test --manifest-path engines/protocol-rust/Cargo.toml
swift test --package-path engines/protocol-swift
```

Notes:

- Rust request body limits are covered through Axum's generated `Json` extractor path and Axum's default 2MB body limit.
- Swift bearer auth and body-size policy remain intentionally small hand-written middleware, not a broad helper layer, because Apple `swift-openapi-generator` provides route registration/decoding/encoding but does not automatically enforce OpenAPI bearer security.

### Phase 5: Native HTTP Servers

Status: complete.

Research and Hummingbird/Swift client-operation spike findings are recorded in `docs/ENGINE_CONTRACT_V2_PHASE5_HTTP_SERVER_RESEARCH.md`.

Completed so far:

- Implemented the Rust/native-foundation local HTTP server path for Linux/Windows native engines using generated `engines/protocol-rust` Axum server helpers.
- Removed the native-foundation legacy listener path; `GG_ENGINE_TRANSPORT` must be `http`.
- Bound the Rust native HTTP server to `127.0.0.1:0`.
- Enforced `Authorization: Bearer <GG_ENGINE_HTTP_AUTH_TOKEN>` through generated Rust bearer-auth hooks.
- Emitted the v2 HTTP readiness envelope: `guerillaglass.engine.http.ready`.
- Added Rust request hardening middleware for loopback `Host`, loopback/null/missing `Origin`, allowed `Sec-Fetch-Site`, and a 2 MiB request body limit.
- Verified a launched Linux native engine returns `401` without auth, `200` for authenticated `GET /v1/system/ping`, `403` for hostile origin, and `405` for unsupported method.
- Adopted Hummingbird for the macOS local HTTP server transport.
- Root `Package.swift` now wires generated Swift OpenAPI runtime/plugin dependencies plus `Hummingbird` and `OpenAPIHummingbird`, and raises the root macOS platform to macOS 14.
- macOS engine now requires `GG_ENGINE_TRANSPORT=http` and `GG_ENGINE_HTTP_AUTH_TOKEN`, binds to `127.0.0.1:0`, emits `guerillaglass.engine.http.ready`, registers the real `EngineService: APIProtocol` directly on a Hummingbird `Router`, and applies bearer/body-limit/Host-Origin middleware.
- macOS legacy listener startup was removed from `EngineMain.swift`.
- Removed the temporary `MacOSEngineHTTPAPI` adapter, fake in-memory HTTP state, generic JSON roundtrip helpers, and `Package.swift` exclusions for macOS `EngineService+*.swift` files.
- Refactored macOS endpoint files to generated `APIProtocol` operation methods returning generated `Components.Schemas.*` DTOs directly.
- Manually launched `.build/debug/guerillaglass-engine` and verified HTTP readiness, bearer rejection, authenticated `GET /v1/system/ping`, `GET /v1/engine/capabilities`, and `GET /v1/sources`.
- Removed legacy Windows/Linux TypeScript engine targets and their shared implementation.
- Updated desktop parity e2e coverage to build and launch `target/debug/guerillaglass-engine-windows` and `target/debug/guerillaglass-engine-linux`.
- Regenerated Rust/Swift protocol bindings after the native parity run exposed a stale `SourcesResult` shape.
- Fixed Rust native-foundation parity responses for export job status and project timeline state.
- Added committed real-process launch/security e2e coverage for Windows/Linux native engines covering readiness, bearer rejection, success response, body limit, hostile origin, unsupported route, and unsupported method.
- Completed the final stale legacy transport wording/import/test sweep for active docs/scripts/tests.
- Expanded macOS project/export handlers to use native project persistence/recents and real `ExportPipeline` execution when a recording asset is available.
- Expanded macOS agent handlers to enforce preflight tokens, runtime-budget validation, transcript-backed QA coverage, force gating, status polling, QA/destructive-intent apply gates, project agent metadata, and timeline application state.

### Phase 6: Desktop Integration

Status: complete.

Completed scope:

- Replaced old consolidated engine package Bun live layer usage with `@guerillaglass/engine-client` services.
  - `apps/desktop-electrobun/src/bun/app/index.ts` is the only desktop source composition root importing `layerEngineClientBun` from `@guerillaglass/engine-client/service`.
  - `packages/engine-client/src/services/domainServices.ts` now exposes `layerEngineDomainServices`, which derives all domain services from the low-level `EngineClient`.
  - `apps/desktop-electrobun/src/bun/app/AppLayer.ts` consumes an `engineDomainServicesLayer` instead of composing or exposing the low-level `EngineClient` directly.
- Updated `HostBridgeService` to call domain services.
  - Engine bridge requests resolve `SystemService`, `PermissionsService`, `SourcesService`, `CaptureService`, `RecordingService`, `ExportService`, and `AgentService` directly.
  - Project commands still route through `ProjectSession`, with `ProjectSessionElectrobun` using `ProjectService`, preserving desktop path grants/session policy.
- Removed old transport service dependencies from desktop source.
  - Search verified no desktop source references to legacy `EngineTransport`, `makeLayerEngineTransportBun`, or `capture.statusStream`.
  - Capture status publishing uses `CaptureService.status` polling through `makeCaptureStatusPollingEffect`.
- Kept Electrobun RPC only for the renderer/Bun boundary.
  - `requestHandlers.ts` remains a thin adapter that validates bridge envelopes, runs `HostBridgeService.handle(...)` inside the managed runtime, and redacts serialized errors.
  - Renderer code continues to use `electrobunRpcBridge.ts`/window bridge bindings rather than direct engine HTTP/client access.
- Tightened regression coverage.
  - `apps/desktop-electrobun/tests/desktop-engine-v2-composition.test.ts` now allows raw `EngineClient` usage only in `bun/app/index.ts` and rejects legacy transport/status-stream references.

Validation completed:

```sh
cd apps/desktop-electrobun && bunx vitest run tests/desktop-engine-v2-composition.test.ts -c vitest.config.ts
cd packages/engine-client && bun run typecheck
cd apps/desktop-electrobun && bun run typecheck
```

### Phase 7: Removal

Status: complete.

Completed scope:

- Deleted obsolete Swift line-protocol bridge tests.
  - Removed `Tests/engineProtocolTests/EngineProtocolTests.swift`.
  - Removed the root `EngineProtocolTests` test target from `Package.swift`.
  - The remaining Swift protocol tests live under `engines/protocol-swift/Tests/EngineProtocolTests` and cover generated OpenAPI types/server helpers, not the old line codec.
- Removed stale Rust legacy protocol dispatch.
  - Deleted `capture.statusStream` and `capture.previewFrameStream` method mappings from `engines/native-foundation/src/wire.rs`.
  - Removed the obsolete stream entries from `packages/engine-contract/src/endpointInventory.ts`.
  - Removed runtime string-method bridge construction from `engines/native-foundation/src/transport.rs`; generated HTTP handlers now dispatch through explicit `EngineMethod` variants.
  - Simplified `engines/native-foundation/src/handlers.rs` so status and preview are regular HTTP-polled operations only.
- Removed stale legacy readiness documentation.
  - Updated the startup readiness example to emit `guerillaglass.engine.http.ready` without the old protocol discriminator field.
- Verified no active source remains for the old consolidated engine package, legacy desktop transport layer, Swift line codec types, or native legacy stream methods.

No shims were added.

Validation completed:

```sh
bun run protocol:typecheck
cd apps/desktop-electrobun && bun run typecheck
cd apps/desktop-electrobun && bun run test:bun
cd apps/desktop-electrobun && bunx vitest run tests/desktop-engine-v2-composition.test.ts -c vitest.config.ts
cargo test --manifest-path engines/native-foundation/Cargo.toml
cargo test --manifest-path engines/protocol-rust/Cargo.toml
swift test
```

### Phase 8: Final Gates

Status: complete.

Completed scope:

- Verified active TypeScript, Rust, and Swift tests target the Engine Contract v2 HTTP/OpenAPI boundary where applicable.
  - Desktop composition tests reject legacy engine transport/status-stream imports and allow the raw low-level `EngineClient` only at the Bun app composition root.
  - Desktop protocol tests assert directly against `EngineOpenApi` instead of the removed endpoint inventory.
  - Native Rust/Swift protocol tests cover generated OpenAPI DTOs/server helpers and HTTP-style route behavior, not the removed line/RPC protocol.
- Migrated desktop TypeScript tests to Vitest conventions.
  - Desktop unit/e2e-style TypeScript tests now use Vitest imports and `.test.ts` / `.test.tsx` names.
  - Bun-specific test APIs were removed from desktop tests where they previously blocked Node/Vitest execution.
  - UI smoke coverage moved from Playwright Test Runner to Vitest Browser Mode using `@vitest/browser-playwright`.
- Standardized the JavaScript/TypeScript gate on Oxlint type-aware type checking.
  - Root `js:lint` now runs `oxlint --type-aware --type-check --deny-warnings` across `apps`, `packages`, and `Scripts`.
  - `oxlint.config.mjs` enables `options.typeAware` and `options.typeCheck` in the root config.
  - The gate no longer depends on separate package-level `tsc --noEmit` steps for routine CI coverage; package `typecheck` scripts remain available for focused debugging.
  - Oxlint-discovered gaps were fixed: `packages/ui` now uses bundler module resolution, `apps/web/convex/tsconfig.json` includes Node types, and `packages/ui` DayPicker v10 class keys are valid.
  - JS/Oxlint warnings are now fatal via `--deny-warnings`; current JS lint output is clean.
- Optimized local and CI gates without hiding errors.
  - `Scripts/typescript_gate.sh` compiles i18n once, then runs Oxlint type-check/lint, the custom React effect-state lint, contract checks/tests, and desktop Vitest tests.
  - `Scripts/full_gate.sh` runs independent Rust, TypeScript, SwiftFormat, SwiftLint, and Swift test checks concurrently while still waiting for every process and streaming warnings/errors.
  - SwiftLint no longer uses `--lenient`; existing warning-level SwiftLint findings remain visible while error-level findings fail the gate.
  - GitHub Actions now splits TypeScript, Rust, Swift, protocol-generation determinism, and coverage into independent jobs with concurrency cancellation.
- Coverage gates were updated for the Vitest migration.
  - Desktop TypeScript coverage uses Vitest V8 coverage instead of Bun coverage.
  - `Scripts/coverage_check.sh` consumes Vitest `coverage-summary.json`, package-level engine-client coverage, and Rust `cargo-llvm-cov` output.
  - Current aggregate coverage thresholds are intentionally baseline-oriented; Rust quality is backed by critical-path behavior tests rather than inflated aggregate generated-code percentages.
- Removed final migration scaffolding and legacy references without shims.
  - Endpoint inventory and legacy Swift line-protocol target were removed.
  - Legacy readiness strings, native stream method names, and old transport bridge names were swept from active source/tests.
- Added Effect/Bun-native observability for the v2 desktop integration path.
  - `apps/desktop-electrobun/src/bun/app/index.ts` now runs the Bun host through `BunRuntime.runMain(...)` with `BunServices.layer`, `layerAppLogging`, optional `layerEffectDevTools`, and `Metric.enableRuntimeMetrics`.
  - `apps/desktop-electrobun/src/bun/app/AppLogging.ts` centralizes console/file logging, process diagnostics, heartbeat logging, and optional DevTools wiring.
  - `apps/desktop-electrobun/src/bun/app/AppLogPaths.ts` resolves the primary system JSONL log and dev repo mirror using Effect `FileSystem`/`Path` through the Bun platform layer.
  - `apps/desktop-electrobun/src/bun/app/AppMetrics.ts` and `packages/engine-client/src/metrics.ts` define low-cardinality timers, counters, and gauges for desktop bootstrap, bridge requests, engine launch, capture operations, process memory, and Effect runtime fibers.
  - Engine launch, bridge requests, capture service operations, project session loading, desktop shell startup, and desktop bootstrap now use `Effect.annotateLogs(...)`, `Effect.withLogSpan(...)`, `Effect.withSpan(...)`, and `Effect.trackDuration(...)` where applicable.
  - Observability details are documented in `docs/OBSERVABILITY.md`, including regions/sectors/areas, log destinations, metrics, tracing spans, optional DevTools, and researched-but-not-wired OTLP/Prometheus exporters.

Validation completed:

```sh
bun run js:lint
bun run desktop:test
bun run desktop:typecheck
bun run protocol:typecheck
bun run protocol:generate-bindings
bun run coverage:check
bun run gate
cargo test --workspace --all-targets
swift test
```

Current local `bun run gate` behavior:

- Runs full Rust, TypeScript, SwiftFormat, SwiftLint, and Swift test checks in parallel.
- Fails on JS/Oxlint warnings or errors.
- Fails on SwiftLint errors; existing SwiftLint warnings remain visible for follow-up cleanup.
- Measured passing average after parallelization and Oxlint standardization: approximately 29 seconds on the local development machine.

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
- Should local HTTP later move to named pipes or another OS-native local transport while preserving OpenAPI-derived schemas?

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
