# Hybrid Architecture (Electrobun + Native Engines + Hosted Review Plane)

## Overview

Guerilla Glass uses a local-first hybrid architecture with strict local/cloud boundaries.

1. Desktop shell (`apps/desktop-electrobun`)
   - Electrobun Bun host (`src/bun`)
   - React/Tailwind renderer (`src/mainview`)
   - One Effect app runtime owned by `AppRuntime`
2. Web app (`apps/web`)
   - TanStack Start frontend routes
   - Convex root for hosted review/auth/billing surfaces
3. TypeScript engine package (`packages/engine`)
   - Effect Schema protocol domains
   - Effect RPC group as TypeScript source of truth
   - Bun native engine transport layer
   - Stable wire bridge between Effect RPC messages and native sidecar messages
4. Native engines (`engines/`)
   - macOS Swift sidecar
   - Rust native foundation plus Windows/Linux sidecar shells
   - protocol-compatible stubs for parallel development
5. Hosted review/control plane (`packages/review-protocol`, `apps/web/convex`)
   - Review/comment/presence/workflow contracts and Convex functions
   - Must not gate local capture/edit/export
6. Localization (`project.inlang`, `messages/*.json`)
   - Shared Paraglide/Inlang source messages
   - App-local generated `src/paraglide` output produced by CI/build/typecheck scripts and ignored by git

## Desktop Runtime Shape

```txt
React renderer
  -> Electrobun RPC bridge
    -> requestHandlers thin adapter
      -> AppRuntime / ManagedRuntime
        -> AppLayer
          -> DesktopShell
          -> HostBridgeService
          -> ProjectSession
          -> EngineTransport
          -> MediaSourceService
```

Rules:

- One Electrobun Bun process owns one Effect runtime boundary.
- `DesktopShell` owns Electrobun window/menu/tray resources as a scoped service.
- `ProjectSession` owns active project path, file access policy context, and project/session flows.
- `HostBridgeService` is backend application logic for renderer requests.
- `requestHandlers.ts` adapts Electrobun Promise handlers into Effect runtime calls only.
- Long-lived resources are acquired/released through layers/scopes.

## Engine Transport

Native sidecars speak the stable Guerillaglass socket wire protocol:

```ts
{ type: "request", id, method, params, authToken }
{ type: "response", id, result }
{ type: "error", id, error: { code, message } }
{ type: "chunk", id, values }
{ type: "ping" }
{ type: "pong" }
{ type: "interrupt", id }
```

TypeScript owns Effect RPC serialization details in `packages/engine/src/client/wireProtocol.ts`.
Native Swift/Rust code must not depend on `effect/unstable/rpc` internals.

Current package boundary:

```txt
packages/engine/src/protocol     Effect Schema domains and RPC group
packages/engine/src/client       EngineTransport service + Bun live layer
engines/protocol-rust            Rust stable wire message definitions
engines/protocol-swift           Swift stable wire message definitions
```

Production Bun transport:

- Spawns sidecars with Effect process primitives from `effect/unstable/process`.
- Connects through `@effect/platform-bun/BunSocket`.
- Uses bounded socket connect retry after sidecar readiness only.
- Does not perform generic RPC retries.
- Does not automatically restart native engines.
- Logs/spans process spawn, readiness, socket connection, RPC send/receive, protocol errors, stderr, and shutdown.

## Media Server

Desktop playback does not expose raw local file paths to the renderer. Media URLs are tokenized loopback URLs:

```txt
http://127.0.0.1:<ephemeral-port>/media/<uuid-token>
```

Implementation:

- `MediaRegistry` owns token state in an Effect `Ref<Map<...>>`.
- `MediaHttpRoutes` owns `/media/*` and `/health` Effect HTTP routes.
- `MediaSourceService` mints URLs from `HttpServer.address`.
- `makeLayerMediaSourceService` composes registry + routes + `BunHttpServer.layer`.
- File responses use `HttpServerResponse.file`/`HttpPlatform` and support `GET`, `HEAD`, byte ranges, and defensive headers.
- Capture preview URLs serve live JPEG frames with cached fallback frames.

Resource lifetime is scoped by Effect layers. There is no app-owned `Bun.serve` class and no Promise/Effect dual media API.

## Local / Cloud Boundary

Local media plane is authoritative for:

- Capture
- Recording
- Timeline/edit semantics
- Project package IO
- Deterministic render/export
- Local playback media serving

Hosted plane owns:

- Review links
- Comments
- Presence
- Workflow status
- Auth/session identity
- Future billing/entitlements

Hosted failures must degrade to local-only behavior and must not interrupt capture/edit/export.

## Renderer State

The desktop renderer remains React/TanStack-oriented:

- TanStack Router for locale-scoped studio routes
- TanStack Query for typed engine/review bridge calls
- Persistent studio layout in `gg.studio.layout.v1`
- Editor-first layout: transport, preview, timeline, inspector, optional left utility pane
- Localized date/number formatting in controller helpers
- Locale routes: `/:locale/capture`, `/:locale/edit`, `/:locale/deliver`
- Supported locales: `en-US`, `de-DE`

## Localization

Source files committed to git:

```txt
project.inlang/settings.json
messages/en-US.json
messages/de-DE.json
```

Generated files ignored by git:

```txt
apps/desktop-electrobun/src/paraglide/
apps/web/src/paraglide/
```

Both app Vite configs use `paraglideVitePlugin`. Scripts generate output before typecheck/build/test. The Vite plugin is allowed to choose Paraglide's default output structure (`locale-modules` in dev, `message-modules` in production).

## Review / Auth / Billing Plane

- Review DTOs live in `packages/review-protocol`.
- Convex functions live in `apps/web/convex`.
- Better Auth + Convex integration is the intended hosted identity stack.
- Billing applies only to hosted collaboration capabilities, never to the local recorder/editor core.

## Verification Commands

```bash
bun run i18n:compile
cd apps/desktop-electrobun && bun run typecheck
cd apps/desktop-electrobun && bun run test
cd apps/web && bun run typecheck
cd packages/engine && bun run typecheck
cd packages/review-protocol && bun run typecheck
cargo check
```
