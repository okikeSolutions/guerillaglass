# Engine Contract v2 Phase 5 HTTP Server Research

## Goal

Research the native local HTTP server migration while preserving the Phase 4 generated OpenAPI server-helper strategy.

Phase 5 requirements:

- bind to `127.0.0.1:0`;
- enforce per-process bearer auth from `GG_ENGINE_HTTP_AUTH_TOKEN`;
- emit the v2 HTTP readiness envelope on stdout;
- implement endpoint handlers behind generated server helpers;
- enforce request-size limits and loopback/origin hardening.

## Current launcher contract

`packages/engine-client/src/process/launchBun.ts` already launches engines with:

```txt
GG_ENGINE_TRANSPORT=http
GG_ENGINE_HTTP_AUTH_TOKEN=<random per-process token>
```

and waits for a stdout readiness line shaped as:

```json
{
  "type": "guerillaglass.engine.http.ready",
  "host": "127.0.0.1",
  "port": 49152
}
```

The native servers should emit exactly that envelope after binding their listener.

## Rust findings

`engines/protocol-rust` is ready for Phase 5 HTTP servers:

- `src/models.rs` contains generated DTOs.
- `src/apis/*` contains generated implementation traits and status-specific response enums.
- `src/server/mod.rs` contains generated Axum route registration, method dispatch, JSON extraction, bearer-auth hook usage, and status-specific response encoding.

The generated Rust entrypoint is:

```rust
let router = protocol_rust::server::new(api_impl);
```

The implementation type must implement:

- `apis::ApiAuthBasic` for bearer extraction/rejection;
- `apis::system::System`;
- `apis::agent::Agent`;
- `apis::permissions::Permissions`;
- `apis::sources::Sources`;
- `apis::capture::Capture`;
- `apis::recording::Recording`;
- `apis::export::Export`;
- `apis::project::Project`.

`engines/protocol-rust/tests/server_helpers.rs` now proves the generated server helpers cover route dispatch, unsupported method/route behavior, JSON decode, status-specific response encoding, success response encoding, bearer rejection, malformed JSON rejection, and Axum's default request body limit path.

Recommended Rust implementation:

1. Implement `engines/native-foundation/src/transport.rs` as an HTTP transport selected by `GG_ENGINE_TRANSPORT=http`.
2. Add an implementation wrapper similar to:

   ```rust
   struct NativeFoundationApi {
       platform: &'static str,
       state: Arc<Mutex<State>>,
       bearer_token: String,
   }
   ```

3. Implement `apis::ApiAuthBasic` by requiring `Authorization: Bearer <GG_ENGINE_HTTP_AUTH_TOKEN>`.
4. Implement generated traits directly, returning generated response enums. Do not route through old line-codec JSON-RPC types.
5. Bind:

   ```rust
   let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await?;
   ```

6. Emit:

   ```rust
   println!(
       r#"{{"type":"guerillaglass.engine.http.ready","host":"127.0.0.1","port":{}}}"#,
       listener.local_addr()?.port()
   );
   ```

7. Serve with `axum::serve(listener, router).await`.
8. Add explicit middleware for loopback `Host`, allowed `Origin`, allowed `Sec-Fetch-Site`, and optional global `tower_http::limit::RequestBodyLimitLayer` if we want a policy stricter/more explicit than Axum's JSON extractor default.

## Swift/Hummingbird spike

### Packages tested

A temporary package was created at `.tmp/hummingbird-spike` with:

- `hummingbird-project/hummingbird` exact `2.25.0`;
- `swift-server/swift-openapi-hummingbird` exact `2.0.1`;
- `swift-server/swift-openapi-async-http-client` exact `1.5.0`;
- local `engines/protocol-swift` package.

The correct package names are under `swift-server`, not `apple`:

```txt
https://github.com/swift-server/swift-openapi-hummingbird.git
https://github.com/swift-server/swift-openapi-async-http-client.git
```

The incorrect/absent repositories checked during research were:

```txt
https://github.com/apple/swift-openapi-hummingbird.git
https://github.com/apple/swift-openapi-async-http-client.git
https://github.com/hummingbird-project/hummingbird-openapi.git
```

### Server transport finding

`swift-openapi-hummingbird` directly conforms Hummingbird's `Router`, `RouterGroup`, and `RouteCollection` to `OpenAPIRuntime.ServerTransport`.

The package source shows:

```swift
extension RouterMethods {
    public func register(
        _ handler: @escaping @Sendable (HTTPRequest, HTTPBody?, ServerRequestMetadata) async throws -> (HTTPResponse, HTTPBody?),
        method: HTTPRequest.Method,
        path: String
    ) throws {
        self.on(.init(path), method: method) { request, context in
            let (openAPIRequest, openAPIRequestBody) = try request.makeOpenAPIRequest(context: context)
            let openAPIRequestMetadata = context.makeOpenAPIRequestMetadata()
            let (openAPIResponse, openAPIResponseBody) = try await handler(openAPIRequest, openAPIRequestBody, openAPIRequestMetadata)
            return Response(openAPIResponse, body: openAPIResponseBody)
        }
    }
}

extension Router: ServerTransport {}
extension RouterGroup: ServerTransport {}
extension RouteCollection: ServerTransport {}
```

Hummingbird's `RouterPath` understands OpenAPI-style `{param}` segments, so generated routes such as `/v1/exports/{jobId}` should route without a custom path-template adapter.

### Client operation spike

The spike also used `OpenAPIAsyncHTTPClient.AsyncHTTPClientTransport` and the generated Swift `Client` against a real Hummingbird local server.

The executable:

1. Created a `Router()`.
2. Registered generated server handlers:

   ```swift
   try SpikeAPI().registerHandlers(
       on: router,
       middlewares: [
           EngineBearerAuthMiddleware(token: token),
           EngineBodyLimitMiddleware(maxBytes: 2 * 1024 * 1024)
       ]
   )
   ```

3. Started Hummingbird on `127.0.0.1:0`.
4. Captured the bound port from `onServerRunning` via `channel.localAddress?.port`.
5. Created a generated Swift `Client` with `AsyncHTTPClientTransport()`.
6. Added a small `ClientMiddleware` to inject `Authorization: Bearer <token>`.
7. Called the generated `system_period_systemPing()` client operation.

Validation command:

```sh
swift run --package-path .tmp/hummingbird-spike EngineHummingbirdSpike
```

Observed success output:

```txt
Server started and listening on 127.0.0.1:<ephemeral-port>
hummingbird-openapi-client-ok app=guerillaglass protocol=2 port=<ephemeral-port>
```

This proves generated Swift server helpers + Hummingbird transport + generated Swift client can perform a real loopback operation.

### Swift package caveats

- `swift-openapi-hummingbird` declares platforms including `.macOS(.v14)`. The root package currently declares `.macOS(.v13)`, so adopting Hummingbird transport likely requires raising the macOS engine package platform to macOS 14 or validating an older transport version.
- `swift-openapi-async-http-client` `1.5.0` declares `swift-tools-version: 6.1` and pulls in AsyncHTTPClient/NIO/BoringSSL. It works in the spike, but we probably do not need it in the production macOS engine because the engine is a server, not a client.
- Existing `engines/protocol-swift` already includes `OpenAPIURLSession`, which remains enough for any native client needs unless we specifically need AsyncHTTPClient/NIO behavior.

## Swift recommendation

Use Hummingbird for the macOS local HTTP server instead of writing a custom `Network.framework` HTTP parser/`ServerTransport`.

Recommended macOS implementation:

1. Wire root `Package.swift` to consume the real local `engines/protocol-swift` package and add:

   ```swift
   .package(url: "https://github.com/hummingbird-project/hummingbird.git", exact: "2.25.0"),
   .package(url: "https://github.com/swift-server/swift-openapi-hummingbird.git", exact: "2.0.1")
   ```

2. Add `Hummingbird` and `OpenAPIHummingbird` products to `guerillaglass-engine`.
3. Implement `EngineHTTPServer` using `Router` as the generated `ServerTransport`.
4. Register generated handlers with:

   ```swift
   try EngineHTTPAPI(service: service).registerHandlers(
       on: router,
       middlewares: [
           EngineHostOriginGuardMiddleware(),
           EngineBodyLimitMiddleware(maxBytes: 2 * 1024 * 1024),
           EngineBearerAuthMiddleware(token: token)
       ]
   )
   ```

5. Start Hummingbird with:

   ```swift
   let app = Application(
       router: router,
       configuration: .init(address: .hostname("127.0.0.1", port: 0), serverName: nil),
       onServerRunning: { channel in
           let port = channel.localAddress?.port
           // emit readiness once port is known
       }
   )
   try await app.runService(gracefulShutdownSignals: [])
   ```

6. Keep generated Swift `Client` + `OpenAPIURLSession` for normal native client needs. Use `OpenAPIAsyncHTTPClient` only if we need NIO-native client tests or Hummingbird integration tests that require it; it is not needed for the engine server itself.

## Security policy to implement for both Rust and Swift

Apply the same local-only stance as the desktop media server guard:

- bind only to `127.0.0.1`;
- require `Authorization: Bearer <GG_ENGINE_HTTP_AUTH_TOKEN>` for every route;
- allow missing `Origin` and `Origin: null`;
- allow loopback origins only:
  - `http://127.0.0.1:*`;
  - `http://localhost:*`;
  - `http://[::1]:*`;
- reject non-loopback `Host` headers;
- reject `Sec-Fetch-Site` values other than absent, `same-origin`, `same-site`, or `none`;
- do not emit `Access-Control-Allow-Origin: *`.

## Updated Phase 5 order

1. Implement Rust/native-foundation HTTP first with generated Axum server helpers.
2. Remove legacy Windows/Linux TypeScript engine usage and point desktop parity e2e coverage at the Rust native engine binaries.
3. Adopt Hummingbird for macOS server transport. Completed: root `Package.swift` now includes Hummingbird/OpenAPIHummingbird and the macOS executable starts a generated-handler Hummingbird server on `127.0.0.1:0`.
4. Refactor macOS `EngineService` endpoint implementations into generated `APIProtocol` handlers beyond the initial `system.ping`/`engine.capabilities` transport smoke endpoints.
5. Added launch/e2e tests for readiness, bearer rejection, success response, body limit, hostile origin, unsupported route, and unsupported method.
6. Delete any remaining legacy transport paths after native HTTP paths are green.
