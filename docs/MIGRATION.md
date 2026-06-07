# Effect-Native Desktop Migration

## Status

Living migration note. Phase 0 and most of Phase 1 are now complete: Effect v4 compatibility is stable enough for package and desktop typechecks, and `packages/engine` owns the TypeScript protocol plus the Bun engine transport. The remaining sections define the target desktop backend architecture, known boundaries, and migration direction.

## Research inputs

This plan is based on the current Guerilla Glass repository, the product architecture in `docs/SPEC.md`, the execution sequencing in `docs/ROADMAP.md`, Electrobun 1.18.1 API sources, Paraglide JS setup guidance, and the vendored Effect v4 beta.78 documentation.

Relevant Effect docs reviewed:

- `vendor/effect/LLMS.md`
- `vendor/effect/migration/services.md`
- `vendor/effect/migration/layer-memoization.md`
- `vendor/effect/migration/runtime.md`
- `vendor/effect/migration/scope.md`
- `vendor/effect/migration/schema.md`
- `vendor/effect/migration/error-handling.md`
- `vendor/effect/migration/forking.md`
- `vendor/effect/migration/cause.md`
- `vendor/effect/ai-docs/src/03_integration/10_managed-runtime.ts`
- `vendor/effect/ai-docs/src/60_child-process/10_working-with-child-processes.ts`
- `vendor/effect/ai-docs/src/01_effect/04_resources/20_layer-side-effects.ts`
- `vendor/effect/ai-docs/src/01_effect/06_pubsub/10_pubsub.ts`
- `vendor/effect/ai-docs/src/08_observability/10_logging.ts`
- `vendor/effect/ai-docs/src/09_testing/20_layer-tests.ts`
- `vendor/effect/ai-docs/src/50_http-client/10_basics.ts`
- `vendor/effect/ai-docs/src/51_http-server/10_basics.ts`

Relevant Effect platform sources reviewed:

- `vendor/effect/packages/platform-bun/src/BunRuntime.ts`
- `vendor/effect/packages/platform-bun/src/BunChildProcessSpawner.ts`
- `vendor/effect/packages/platform-bun/src/BunHttpClient.ts`
- `vendor/effect/packages/platform-bun/src/BunHttpServer.ts`
- `vendor/effect/packages/platform-bun/src/BunHttpPlatform.ts`
- `vendor/effect/packages/platform-bun/src/BunFileSystem.ts`
- `vendor/effect/packages/platform-bun/src/BunPath.ts`
- `vendor/effect/packages/platform-bun/src/BunStream.ts`

Relevant Electrobun sources reviewed:

- `node_modules/.bun/electrobun@1.18.1/node_modules/electrobun/README.md`
- `node_modules/.bun/electrobun@1.18.1/node_modules/electrobun/dist/api/bun/index.ts`
- `node_modules/.bun/electrobun@1.18.1/node_modules/electrobun/dist/api/bun/core/BrowserWindow.ts`
- `node_modules/.bun/electrobun@1.18.1/node_modules/electrobun/dist/api/bun/core/BrowserView.ts`
- `node_modules/.bun/electrobun@1.18.1/node_modules/electrobun/dist/api/bun/core/ApplicationMenu.ts`
- `node_modules/.bun/electrobun@1.18.1/node_modules/electrobun/dist/api/bun/core/Tray.ts`
- `node_modules/.bun/electrobun@1.18.1/node_modules/electrobun/dist/api/shared/rpc.ts`

## Goal

Make the Electrobun Bun host and TypeScript engine backend truly Effect-native.

The renderer UI should remain React/TanStack-oriented. The architectural rewrite is behind the bridge: engine package, native engine process ownership, engine RPC, media serving, project session state, shell menus, host events, diagnostics, and shutdown should be modeled as Effect services and scoped layers wherever Effect itself provides the recommended primitive.

General rule:

> If we can implement backend/engine infrastructure with native Effect primitives or Effect platform packages, we should prefer that over ad-hoc Promise/class/global code.

Target shape:

```txt
React renderer
  -> Electrobun RPC
    -> thin Promise adapter
      -> one ManagedRuntime / launched AppLayer
        -> Effect services and scoped resources
          -> packages/engine
            -> engine protocol + EngineTransport + Bun socket live layer
          -> Effect HTTP media server
          -> Electrobun shell adapter
```

## Non-goals

- Do not rewrite the React UI into Effect.
- Do not create many new packages for every desktop service.
- Do not move native Swift/Rust engines into `packages/`.
- Do not add cloud/auth requirements to local capture, edit, or export.
- Do not use Effect as a thin wrapper around the existing class/global architecture; the goal is to replace that architecture.

## Package and folder direction

### Keep native `engines/` separate

Native `engines/` should stay separate from `packages/` because it is a real toolchain and runtime boundary:

- SwiftPM macOS sidecar
- Rust Windows/Linux sidecars
- Rust native foundation
- Swift/Rust protocol codecs
- protocol-compatible stubs
- native build/test/benchmark flows

Recommended long-term top-level boundary:

```txt
apps/      runnable products
packages/  shared TypeScript libraries/contracts/runtime clients
engines/   native sidecars and native protocol modules
```

### Keep TypeScript engine and engine protocol together

The local engine is the product's core backend boundary. Its TypeScript protocol contract and TypeScript Effect-native engine client/runtime now live together in `packages/engine`.

Recommended package direction:

```txt
packages/
  engine/
  review-protocol/        # later becomes packages/review
  ui/
  typescript-config/
```

`packages/engine` owns the TypeScript side of the local media plane. The package has already been created and currently uses explicit, non-barrel entry points:

```txt
packages/engine/
  src/protocol/
    domains/
    rpc/
    shared/
    schema-primitives.ts
  src/client/
    service.ts        # EngineTransport service tag and public client types
    liveBun.ts        # Bun-backed production layer
    processBun.ts     # internal native process/readiness helper
    wireProtocol.ts   # internal Effect RPC <-> Guerillaglass wire bridge
    config/
    errors/
```

Exports should remain explicit. Do not add broad `./client` or `./protocol` barrels unless there is a specific API reason:

```json
{
  "exports": {
    "./client/service": "./src/client/service.ts",
    "./client/liveBun": "./src/client/liveBun.ts",
    "./client/config/paths": "./src/client/config/paths.ts",
    "./client/config/targets": "./src/client/config/targets.ts",
    "./client/errors/clientErrors": "./src/client/errors/clientErrors.ts",
    "./protocol/rpc/group": "./src/protocol/rpc/group.ts",
    "./protocol/domains/capture": "./src/protocol/domains/capture.ts"
  }
}
```

This consolidates the previous protocol, schema primitive, and desktop-local engine client split into one TypeScript engine package. The current public service is `EngineTransport`; `processBun.ts` and `wireProtocol.ts` are package-internal implementation details.

Native sidecars remain in `engines/`; `packages/engine` is the TypeScript Effect-native client/protocol package that talks to those sidecars.

### Localization: use Paraglide JS instead of a custom package

The custom `packages/localization` package should not grow. We should migrate localization to Paraglide JS.

Paraglide quick-start model:

```sh
npx @inlang/paraglide-js init
```

The CLI sets up message files, bundler integration, and generated typesafe message functions. Usage model:

```ts
import { m } from "./paraglide/messages.js";
import { getLocale, setLocale } from "./paraglide/runtime.js";

m.hello_world();
m.greeting({ name: "Ada" });
getLocale();
setLocale("de");
```

Migration direction:

- Replace `packages/localization` with Paraglide-generated messages/runtime.
- Keep generated Paraglide output close to the app(s) that use it unless we intentionally share locale messages across desktop and web.
- If desktop and web share messages, create one messages workspace/package specifically for Paraglide output, not a hand-rolled localization abstraction.

### Keep `ui` and `typescript-config`

Keep:

```txt
packages/ui
packages/typescript-config
```

`packages/ui` is shared by desktop and web. `packages/typescript-config` is monorepo infrastructure.

### Versioning and semver alignment

This migration is a breaking architecture change. When it lands, all versioned workspace packages and apps should align with the repository semver version for that breaking release. Do not leave packages on stale independent `0.x` versions if their public exports, package names, or import paths changed.

Version-alignment rules:

- `packages/engine`, `packages/ui`, future `packages/review`, and versioned apps should share the release semver.
- Package rename/removal changes are breaking changes and need changelog/release notes.
- Internal/private packages still need version consistency if they are published, packaged, or used in release metadata.
- Do not change versions opportunistically during exploratory refactors; update versions as part of the approved breaking migration landing plan.

### Review package direction

Review is out of scope for the first Effect-native backend migration. Local capture/edit/export and the engine package are the priority.

`packages/review-protocol` should later become `packages/review` with an Effect-native review service. That later package can own review protocol, review service boundaries, HTTP/client integration, auth concerns, and test layers. Until then, keep review protocol separate from `packages/engine` because the local media plane and review/collaboration plane are distinct product surfaces.

## Effect v4 principles to follow

### Services

Use `Context.Service` for service boundaries.

```ts
export class EngineTransport extends Context.Service<EngineTransport, EngineRpcClient>()(
  "@guerillaglass/engine/EngineTransport",
) {}
```

Future product-level app services may wrap this transport with narrower domain methods, but the package-level native client service is currently `EngineTransport`.

Use service identifiers that include package/app and path-like context.

Prefer `yield* Service` inside `Effect.gen` for explicit dependencies. `Service.use` is acceptable at imperative edges, but service dependencies should usually be visible in generator bodies.

### Layers

Use explicit layers, named with v4 conventions:

- `layer` for default production layer
- `layerTest` for test implementation
- `layerMock` for controllable mock implementation
- `layerNoDeps` only when useful for composition

Prefer `layer*` names for new app services. Existing package client exports such as `EngineTransportBunLive` may keep their current names until a deliberate naming cleanup; do not add additional compatibility aliases.

Compose the full app layer once. Effect v4 memoizes layer builds more safely than v3, but the docs still recommend explicit layer composition over scattered `Effect.provide` calls.

### Runtime and app launch

Use one Effect application runtime boundary for the Electrobun Bun process. Electrobun handlers are framework edges and should call into that runtime or into an app-owned runner service.

Effect docs show two relevant patterns:

1. `ManagedRuntime` for framework integration.
2. `Layer.launch` + `BunRuntime.runMain` for a long-running app represented as layers.

For Electrobun, the preferred model is:

- composition root owns runtime/app launch;
- shell remains shell, not runtime owner;
- `DesktopShell` is an Effect service that owns Electrobun resources;
- bridge handlers receive/use the app runner at the edge.

If multiple runtimes ever become unavoidable, share a memo map:

```ts
const appMemoMap = Layer.makeMemoMapUnsafe();
const runtime = ManagedRuntime.make(AppLayer, { memoMap: appMemoMap });
```

The preferred architecture is still one runtime boundary.

### Resources and scopes

Use scoped resources for anything that must be cleaned up:

- native engine process
- native process readiness readers
- socket connections and protocol loops
- media HTTP server
- Electrobun window/tray/menu event listeners
- capture-status stream
- global shortcuts if added later

Use `Effect.acquireRelease`, `Layer.effect`, `Layer.effectDiscard`, `Effect.forkScoped`, and `Layer.launch` patterns rather than manual global cleanup.

### Errors

Use tagged errors, ideally `Schema.TaggedErrorClass`, for domain and infrastructure failures.

Prefer:

```ts
Effect.catchTag("EngineClientError", ...)
Effect.catchTags({ ... })
Effect.catch(...)
```

over broad `unknown` propagation.

### Schema boundaries

Effect schemas have two important sides:

- `Schema.Schema.Type<S>` is the decoded runtime type used inside Effect code.
- `Schema.Codec.Encoded<S>` is the canonical JSON/wire DTO type.

Effect RPC returns decoded schema `Type` values. Renderer-facing Electrobun bridge values should be encoded JSON DTOs. Bridge boundaries must encode decoded Effect values with:

```ts
Schema.encodeEffect(Schema.toCodecJson(schema))
```

before returning them to renderer code, and renderer-facing validation should treat payloads as encoded JSON DTOs. This avoids leaking `Option<T>`, brands, and other decoded Effect-only shapes into UI DTOs that expect `T | null`, plain strings, and plain numbers.

### Observability

Use Effect logging, log annotations, and spans around host operations:

- engine method
- request id
- native pid
- engine target
- capture session id
- project path
- export id
- retry count
- restart count

Every engine RPC should have a span. Background streams should log interruption and shutdown through finalizers.

### Streams, queues, pub/sub, schedules

Use Effect primitives for asynchronous backend flows:

- `Stream` for backend event sources
- `Stream<CaptureStatusResult>` for capture status
- socket protocol loops and request correlation internal to the TypeScript Effect RPC bridge
- `PubSub` for host domain events fan-out
- `Schedule` for polling, retry, and restart backoff

Capture status should be modeled as a stream unless implementation research proves a stronger alternative. The shell can subscribe to the stream and publish/forward renderer updates.

### HTTP client/server

Do not use raw `fetch` or ad-hoc `Bun.serve` in new backend architecture when Effect provides a suitable primitive.

Use Effect HTTP primitives:

- `effect/unstable/http` `HttpClient`, `HttpClientRequest`, `HttpClientResponse`
- `FetchHttpClient` or preferably `BunHttpClient` where appropriate in Bun
- `HttpRouter`, `HttpServer`, `HttpServerResponse`
- `@effect/platform-bun` `BunHttpServer`

Research notes:

- Effect HTTP client examples show request middleware, base URLs, JSON body schema decoding, status filtering, and transient retry via `Schedule`.
- Effect HTTP server examples show schema-first APIs with `HttpApi`, route layers with `HttpRouter.serve`, and platform-specific backends. The docs explicitly note the server can use `BunHttpServer`.
- `@effect/platform-bun` includes `BunHttpClient`, `BunHttpServer`, `BunHttpPlatform`, and test server layers.

Migration targets:

- Local media/preview serving should move from custom server code to `BunHttpServer`/`HttpRouter` where feasible.
- All HTTP request/response validation should use schemas at the boundary.

## Electrobun constraints and integration model

Electrobun gives us:

- a Bun main process
- `BrowserWindow` / `BrowserView`
- typed RPC via `BrowserView.defineRPC` and renderer `Electroview.defineRPC`
- `ApplicationMenu` and `Tray`
- global application/menu events via Electrobun event emitters
- window close/focus lifecycle hooks
- RPC request timeout behavior via `maxRequestTime`

Important implications:

1. Electrobun RPC handlers are Promise-returning functions. They should remain thin adapters from RPC params to Effect programs.
2. Electrobun messages are fire-and-forget. Host push events should be centralized behind shell/event services.
3. `BrowserWindow`, `Tray`, and menu event listeners are imperative resources. Wrap them in scoped services.
4. Shell stays shell: it adapts Electrobun APIs to Effect services, but it should not own business logic or own the entire runtime architecture.
5. The composition root owns the app runtime/lifecycle. `DesktopShell` owns windows, menus, tray, and renderer event forwarding.
6. Keep `maxRequestTime: Infinity` only for operations where user/system dialogs can legitimately exceed default RPC timeout. Prefer operation-level timeout/cancellation inside Effect for engine requests.
7. Electrobun sandbox mode disables RPC for untrusted content. Our main view is trusted local app UI; any future remote content should be sandboxed and should not receive privileged RPC.

## Target desktop backend structure

Desktop shell-specific code remains inside `apps/desktop-electrobun`:

```txt
apps/desktop-electrobun/src/bun/
  main.ts

  app/
    App.ts
    AppLayer.ts
    AppConfig.ts

  shell/
    DesktopShell.ts
    WindowService.ts
    MenuService.ts
    TrayService.ts

  bridge/
    RendererBridge.ts
    BridgeSchemas.ts

  events/
    HostEvents.ts

  session/
    ProjectSession.ts
    RuntimeFlags.ts

  media/
    MediaService.ts
    MediaServer.ts

```

Engine TypeScript runtime now lives in `packages/engine`:

```txt
packages/engine/src/
  protocol/
    domains/
    rpc/
    shared/
    schema-primitives.ts
  client/
    service.ts
    liveBun.ts
    processBun.ts
    wireProtocol.ts
    config/
    errors/
```

## Proposed service graph

```txt
DesktopApp
  requires DesktopShell
  requires RendererBridge
  requires CaptureStatusStream

RendererBridge
  requires EngineTransport          # from packages/engine/client/service
  requires MediaService
  requires ProjectSession
  requires DesktopShell

DesktopShell
  requires HostEvents
  requires RuntimeFlags

CaptureStatusStream
  requires EngineTransport
  exposes Stream<CaptureStatusResult>
  encodes decoded Effect values to renderer-facing JSON DTOs before forwarding
  may publish HostEvents for shell forwarding

EngineTransport
  provided by packages/engine/client/liveBun
  uses processBun to start native sidecar and read socket readiness
  uses wireProtocol to bridge Effect RPC encoded messages to stable Guerillaglass wire
  requires Bun socket, filesystem, and path platform services

MediaService
  requires AppConfig
  requires Effect HTTP server services
  should avoid hidden cycles with EngineTransport

ProjectSession
  owns current project path/state refs

HostEvents
  owns PubSub for host-to-shell and domain events
```

Avoid cycles. If two services need to communicate bidirectionally, use `HostEvents`, streams, or split the service.

## App entrypoint goal

The Bun entry should become small. Preferred direction:

```ts
import { BunRuntime } from "@effect/platform-bun";
import { Layer } from "effect";
import { DesktopApp } from "./app/App";
import { AppLayer } from "./app/AppLayer";

Layer.launch(AppLayer.pipe(Layer.provide(DesktopApp.layer))).pipe(
  BunRuntime.runMain({ disableErrorReporting: true }),
);
```

If Electrobun RPC setup requires a framework-style runner, use one `ManagedRuntime` owned by the composition root and expose only a small runner to the shell/bridge edge:

```ts
const runtime = ManagedRuntime.make(AppLayer);
await runtime.runPromise(DesktopApp.start);
```

The key requirement is that there is one composition root and one runtime boundary. `DesktopShell` should not become a hidden second composition root.

## Bridge goal

Current bridge handlers perform orchestration. Target bridge handlers only decode/route:

```ts
ggEnginePing: () => runtime.runPromise(
  EngineTransport.use((engine) => engine["system.ping"](undefined)),
)
```

The bridge should not own project path, engine process, media URL policy, or retry logic. Those belong to services.

## Engine package goal

The previous desktop-local engine client and protocol definitions have been consolidated into `packages/engine`. The current chain is:

```txt
Electrobun handler
  -> HostRuntime
  -> EngineTransport service
  -> packages/engine/client/liveBun
  -> processBun starts native sidecar and reads socket readiness
  -> wireProtocol bridges Effect RPC encoded messages to stable Guerillaglass wire
  -> Bun TCP socket
  -> native sidecar
```

Native engines speak the stable Guerillaglass socket wire protocol, not Effect RPC internals. TypeScript owns the bridge between Effect RPC encoded messages and the native wire protocol.

### EngineTransport

`EngineTransport` is the package-level Effect service tag for the generated engine RPC client. App code should depend on this service rather than constructing process/socket/wire details directly.

Responsibilities:

- provide the typed Effect RPC client generated from the engine RPC group;
- hide native process, socket, auth token, and wire-message details;
- expose decoded Effect schema values to backend Effect code;
- let bridge boundaries encode decoded values back to `Schema.Codec.Encoded` JSON DTOs before sending them to renderer code.

### processBun

`processBun.ts` is internal. It starts the configured native sidecar, passes socket/auth environment, drains stderr, reads the readiness line from stdout, and returns `{ address, authToken }` to the Bun live layer. It is not exported from the package.

### wireProtocol

`wireProtocol.ts` is internal. It adapts Effect RPC encoded client/server messages to the stable Guerillaglass wire shapes:

```ts
{ type: "request", id, method, params, authToken }
{ type: "response", id, result }
{ type: "error", id, error: { code, message } }
{ type: "chunk", id, values }
{ type: "ping" }
{ type: "pong" }
{ type: "interrupt", id }
```

It intentionally does not expose Effect RPC wire internals to Swift/Rust/native engines.

### Remaining engine hardening

- Replace remaining ad-hoc process/readiness code with Effect platform primitives where feasible.
- Add spans and structured logs around process spawn, socket connect, RPC send/receive, and protocol errors.
- Add retry/restart policy using `Schedule` only where product-safe.
- Keep `processBun` and `wireProtocol` private implementation modules unless a real public use case appears.

## Media goal

Media server should become an Effect HTTP server service:

- acquire server on layer build
- release server on layer close
- expose `resolveMediaSourceURL` and `resolveCapturePreviewURL`
- serve media/preview routes through Effect HTTP routing where feasible
- validate path/token inputs at the boundary
- avoid direct dependency cycles with `EngineTransport`; pass preview-frame loading explicitly, use a stream, or route through an event/request service

Preferred implementation path is `@effect/platform-bun` `BunHttpServer` + Effect HTTP router primitives. More implementation research is needed before replacing all custom media behavior, especially byte ranges, headers, token handling, and preview-frame response shape.

## Review goal

Review is out of scope for the first migration. Do not remove the review protocol package as part of unrelated work, but do not wire review services into the new desktop backend until the local engine/media architecture is stable.

Later direction: `packages/review-protocol` becomes `packages/review` with an Effect-native review service, tagged errors, HTTP/client integration where appropriate, and test layers. That future package should follow the same service/layer rules as `packages/engine`.

## Shell goal

Desktop shell should own Electrobun resources only:

- `BrowserWindow`
- `BrowserView` RPC installation
- `ApplicationMenu`
- Linux `Tray`
- menu click listeners
- window close/focus listeners
- host-to-renderer messages

Shell should stay shell. It should adapt imperative Electrobun resources into scoped Effect services, but not own engine/media business logic.

Use finalizers for:

- tray removal
- event listener unregistration where Electrobun exposes it
- runtime disposal signal on close
- best-effort window cleanup

Move module globals into services/refs:

```txt
mainWindow          -> WindowService / DesktopShell scoped state
linuxTray          -> TrayService scoped state
hostMenuState      -> Ref<HostMenuState>
currentProjectPath -> ProjectSession Ref<Option<string>>
hostRuntime        -> composition root only
```

## Host events goal

Use a bounded `PubSub` service to decouple producers and consumers.

Events may include:

```ts
type HostEvent =
  | { readonly _tag: "CaptureStatusUpdated"; readonly status: CaptureStatusResult }
  | { readonly _tag: "MenuCommand"; readonly command: HostMenuCommand }
  | { readonly _tag: "RuntimeFlagsChanged"; readonly flags: HostRuntimeFlags }
  | { readonly _tag: "EngineProcessExited"; readonly reason: unknown };
```

`DesktopShell` subscribes and forwards renderer-facing events. Engine/session services publish domain events without knowing about `mainWindow`.

## Capture status goal

Model capture status as a stream:

```ts
Stream.Stream<CaptureStatusResult, EngineError>
```

The stream can be implemented with engine polling + `Schedule` initially, then later switch to native engine push events if the wire protocol adds them. The renderer-facing push still uses Electrobun messages, but the backend source of truth is an Effect stream.

## Project session goal

Create a small `ProjectSession` service for host-side project state:

- current project path
- project file access policy inputs
- recents limit/defaults
- save/open side effects that update session state

This removes current project state from bridge handlers and app globals.

## Testing goal

Use Effect layers for backend tests.

Add `@effect/vitest` once the service architecture exists. Use:

- `layerTest` for in-memory services
- `Layer.fresh` or `Effect.provide(..., { local: true })` where test isolation is required
- shared layers only when state sharing is intentional

Most backend tests should run without Electrobun by providing test layers for `DesktopShell`, `EngineTransport`, and `MediaService`.

## Migration phases

### Phase 0 — Stabilize Effect v4 compatibility — mostly complete

- Effect v4 API migration is stable enough for `packages/engine` and desktop typechecks.
- Keep direct Effect versions pinned exactly.
- Adopt `@effect/platform-bun` for new backend/engine work where it fits.
- Add `@effect/vitest` when converting backend tests.
- Do not broaden runtime architecture while package or desktop typecheck is red.

### Phase 1 — Package consolidation first — mostly complete

- `packages/engine` exists.
- Engine protocol and schema primitives live in `packages/engine/src/protocol`.
- The desktop engine client now uses explicit package-local client entry points: `client/service` for `EngineTransport` and `client/liveBun` for the Bun-backed layer.
- Desktop and package imports use explicit `@guerillaglass/engine` exports rather than old desktop-local engine client paths.
- Remaining Phase 1 work is documentation/API polishing, fixture/golden generation, and deciding whether any public package-level aliases are still necessary. Current preference: no barrels and no compatibility shims.

### Phase 2 — Establish composition root

- Create `app/AppLayer.ts`.
- Create one runtime/app-launch owner.
- Convert current host runtime naming to v4 service/layer conventions.
- Keep shell as shell; do not let shell own the app runtime architecture.

### Phase 3 — Shell as scoped service

- Wrap `BrowserWindow`, menu, tray, and host messages in `DesktopShell`.
- Move globals into `Ref`s and scoped services.
- Make close/focus/menu listeners managed resources.

### Phase 4 — Bridge as thin adapter

- Move orchestration out of `requestHandlers.ts`.
- Make handlers call service methods only.
- Move current project path handling into `ProjectSession`.

### Phase 5 — Engine client hardening inside `packages/engine`

- Keep native engines on the stable Guerillaglass socket wire protocol.
- Keep Effect RPC serialization details inside TypeScript `wireProtocol`.
- Do not export `processBun` or `wireProtocol` unless a real public use case appears.
- Replace remaining ad-hoc process/readiness handling with Effect platform primitives where feasible.
- Use `Schedule` for retry/restart policy only where product-safe.
- Add spans and structured logs around process spawn, socket connect, RPC send/receive, protocol errors, and shutdown.

### Phase 6 — Media/session cleanup

- Convert media server to Effect HTTP server primitives where feasible.
- Ensure all resource lifetimes are scoped.
- Remove Promise/Effect dual APIs.

### Phase 7 — Version alignment and localization migration

- Align package versions with the repository semantic version before landing the breaking architecture change.
- Initialize Paraglide JS.
- Replace hand-written localization package usages with generated message functions/runtime.
- Remove `packages/localization` after desktop/web callers are migrated.

## Design rules

1. One Electrobun Bun process = one Effect app runtime boundary.
2. Electrobun is an adapter, not the architecture.
3. Shell stays shell; composition root owns app runtime/lifecycle.
4. React remains React; Effect owns the host backend and TypeScript engine package.
5. Use native Effect primitives wherever recommended and feasible.
6. Keep TypeScript engine protocol + TypeScript engine runtime in `packages/engine` with explicit, non-barrel exports.
7. Native Swift/Rust sidecars stay in `engines/`.
8. All long-lived resources are scoped.
9. All backend async loops are fibers/streams/schedules.
10. Capture status is a stream unless later research proves otherwise.
11. All cross-service events go through a typed event service or explicit stream.
12. All expected failures are tagged errors.
13. The bridge should not contain business logic.
14. No Promise/Effect dual APIs after migration.
15. Avoid tiny services; keep pure functions pure.
16. Prefer Effect HTTP client/server over raw `fetch`/ad-hoc `Bun.serve` in new backend code.
17. Use Paraglide JS for localization instead of maintaining custom localization infrastructure.
18. Renderer-facing DTOs use `Schema.Codec.Encoded<S>`; backend Effect code may use decoded `Schema.Schema.Type<S>`.
19. This is a breaking architecture change; all package versions must be aligned with the repository semver version when the migration lands.

## Resolved decisions from review

- `packages/engine` consolidation happened before the full Effect-native backend rewrite.
- Native engines speak a stable Guerillaglass socket wire protocol; TypeScript owns the Effect RPC bridge.
- `packages/engine` exposes explicit client entry points (`client/service`, `client/liveBun`) and keeps process/wire modules private.
- Adopt `@effect/platform-bun` for new backend/engine architecture where it fits.
- Shell remains shell. Effect approach: wrap Electrobun resources as scoped shell services; the composition root owns runtime/lifecycle.
- Capture status should be modeled as `Stream<CaptureStatusResult>` unless deeper implementation research proves a better Effect-native design.
- Bridge boundaries encode decoded Effect values into `Schema.Codec.Encoded` JSON DTOs before sending them to renderer code.
- Leave review out of the first migration.
- `packages/review-protocol` should later become `packages/review` with an Effect-native review service.

## Resolved implementation research

### Native engine process and stable socket wire boundary

Native stdio transport has been removed from the real native engine path. The sidecar process is still a scoped resource, but native request/response traffic now flows over a socket using the stable Guerillaglass wire protocol.

Current TypeScript-side shape:

- `processBun.ts` resolves the engine executable, spawns it, passes `GG_ENGINE_RPC_TRANSPORT=socket` and `GG_ENGINE_RPC_AUTH_TOKEN`, drains stderr, and reads the stdout readiness line.
- Native engines print a readiness envelope containing host/port, then serve the socket protocol.
- `liveBun.ts` connects with `BunSocket.layerNet` and provides `RpcClient.Protocol`.
- `wireProtocol.ts` maps Effect RPC encoded messages to/from stable Guerillaglass wire messages.

Stable client-to-native messages:

```ts
{ type: "request", id, method, params, authToken }
{ type: "interrupt", id, authToken }
{ type: "ping" }
```

Stable native-to-client messages:

```ts
{ type: "response", id, result }
{ type: "error", id, error: { code, message } }
{ type: "chunk", id, values }
{ type: "pong" }
{ type: "protocolError", message }
```

Effect RPC internals must remain contained in TypeScript. Swift/Rust/native code should depend on generated Guerillaglass protocol bindings and fixtures, not on `effect/unstable/rpc` wire shapes.

Remaining research/hardening:

- Evaluate replacing the current `Bun.spawn` wrapper with `@effect/platform-bun` child-process services where that improves lifecycle/readiness handling.
- Keep stdout for readiness and stderr for logging; do not reintroduce stdio request transport.
- Add structured logging/spans around process spawn, readiness, socket connect, send/receive, and protocol errors.
- Add restart/retry with `Schedule` only where product-safe.

### `BunHttpServer` / Effect HTTP route shape for media byte ranges, signed preview URLs, and cache headers

`@effect/platform-bun` `BunHttpServer` is a good fit for the local media server. It wraps `Bun.serve` as an Effect `HttpServer`, stops the server on scope finalization, and provides Bun-backed HTTP platform services. `BunHttpPlatform` maps Effect file responses to `Bun.file`, including sliced file responses for byte ranges.

Effect already has most media-serving behavior in `HttpStaticServer`:

- path normalization and traversal protection for root-based static serving;
- `Range` parsing;
- `206 Partial Content` and `416 Range Not Satisfiable`;
- `Content-Range`;
- `Accept-Ranges: bytes`;
- content type inference;
- `Cache-Control`;
- ETag and `Last-Modified`;
- conditional `If-None-Match` / `If-Modified-Since` handling.

Recommended route shape:

```txt
GET  /media/:token      -> validate token, resolve canonical file path, serve file/range
HEAD /media/:token      -> same headers, no body
GET  /preview/:token    -> validate token, return latest encoded preview frame
GET  /health            -> local server health check
```

Use `BunHttpServer.layer({ hostname: "127.0.0.1", port: 0 })` with Effect HTTP router/app layers. For directory-rooted static content, prefer `HttpStaticServer.layer`. For signed arbitrary project files, do not expose raw paths in URLs; use a route-local handler that validates token -> canonical file path, then follows the same `HttpStaticServer` pattern with `HttpPlatform.fileResponse` / `HttpServerResponse.file`. This is better than forcing tokenized paths into a fake static root.

Cache policy should be explicit per route:

- `/media/:token`: likely `Cache-Control: private, max-age=0, must-revalidate` or `no-store` depending on token lifetime and privacy requirements.
- `/preview/:token`: `Cache-Control: no-store`.
- static app assets, if served through this path later: long-lived immutable caching is acceptable only for content-addressed assets.

The media service should therefore use `BunHttpServer` + Effect HTTP routing, reuse `HttpStaticServer` where URL-path-to-root mapping is natural, and implement a small signed-file route where token validation is required.
