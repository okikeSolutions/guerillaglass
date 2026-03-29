# Hybrid Architecture (Electrobun + Native Engine + Review Plane)

## Overview

Guerilla Glass now follows a hybrid multiplatform architecture with strict local/cloud boundaries:

1. Desktop shell (`/apps/desktop-electrobun`)
   - Electrobun main process (`src/bun`)
   - React/Tailwind/shadcn UI (`src/mainview`)
2. Web app/auth shell (`/apps/web`)
   - TanStack Start frontend routes + marketing/auth entrypoints
   - Convex deployment root for web review/billing/auth functions (`/apps/web/convex`)
3. Native engine (`/engines/macos-swift`)
   - Uses existing Swift capture/render/export modules
   - Exposed as `guerillaglass-engine` executable target
4. Protocol layer (`/packages/engine-protocol`)
   - Effect Schema runtime schemas + TypeScript types
   - Wire contracts for request/response envelopes
5. Rust protocol layer (`/engines/protocol-rust`)
   - Shared Rust request/response envelope models
   - Shared monotonic clock primitive for timing-critical engines
6. Review control plane (Convex, in progress)
   - Review metadata domains (`videos`, `comments`, `share links`, `presence`, workflow status)
   - Async actions + webhooks for upload/transcode/playback readiness
7. Auth and session plane (Better Auth + Convex auth integration, in progress)
   - Better Auth manages user sessions and account identity
   - Convex functions enforce authenticated identity and role-based access for review/collab data
   - Wiring baseline follows Convex Labs Better Auth React framework guide
   - Dependency constraints: `convex >= 1.25.0`, `better-auth@1.4.9` pinned
8. Billing and entitlement plane (Convex Stripe component, planned)
   - Stripe checkout + customer portal + subscription lifecycle sync
   - Signed webhook ingestion at `/stripe/webhook` for billing truth reconciliation
   - Server-side entitlement projection for paid cloud features (review/collab access tiers)

North star:

- Cross-platform creator workflow parity (`Capture -> Edit -> Deliver`) with async review in `Deliver`
- Native capture/audio/export quality per platform
- Shared protocol contract so shell UX stays consistent across engines
- Cloud review features must not gate local capture/edit/export
- Account-gated collaboration: cloud review/collab actions are available only to authenticated users
- Open-source local core with paid cloud collaboration tiers via server-enforced entitlements

## Runtime Data Flow

1. Renderer calls `window.ggEngine*` functions.
2. Electrobun main process handles these via `BrowserView.defineRPC` request handlers.
3. Bun `EngineClient` sends JSON line requests to the Swift sidecar.
4. Swift sidecar dispatches methods to native APIs (`ScreenCaptureKit`, `AVFoundation`, Input Monitoring checks).
5. Response envelopes are validated in TypeScript with Effect Schema before UI rendering.
6. Agent Mode jobs write structured artifacts into the active project package (`analysis/*.v1.json`) and expose status/artifact access via protocol methods.

Deliver-review flow (Phase 2.5+):

1. Renderer validates an active Better Auth session before entering account-gated workspace routes.
2. Renderer invokes review-specific bridge RPC (`ggReview*`) for link/comment/presence/status actions.
3. Host routes review RPC to Convex-backed review services with user identity context for snapshot/comment/status flows.
4. Convex functions authorize by team/project/video role before protected reads/mutations.
5. Convex actions issue signed upload URLs, validate upload completion, and move video state to processing.
6. Webhooks reconcile transcode readiness and playback metadata updates.
7. Host emits typed review bridge events (`hostReviewEvent`) after successful review mutations for immediate renderer updates.
8. Renderer receives reactive query updates for comment threads, watcher presence, and review status.

Current hardening:

- Desktop review bridge requires per-request user-scoped Convex JWT auth tokens for review RPC calls.
- Review mutations enforce role-aware access (`owner`, `admin`, `member`, `viewer`) in Convex handlers.

Billing flow (Phase 2.6+):

1. Authenticated renderer invokes billing RPC for checkout or customer portal actions.
2. Host routes billing RPC to Convex actions using `@convex-dev/stripe`.
3. Convex actions create Stripe checkout/customer-portal sessions linked to authenticated user/org identity.
4. Stripe emits billing lifecycle webhooks to `https://<deployment>.convex.site/stripe/webhook`.
5. Stripe component syncs customers/subscriptions/invoices/payments in Convex component tables.
6. Entitlement projection functions compute paid capability flags for review/collab and seat limits.
7. Renderer consumes reactive entitlement state and gates paid cloud features without blocking local media workflows.

## Dual-Plane Boundaries

- Local media plane (authoritative): capture, record, timeline edit semantics, deterministic render/export, project package IO.
- Cloud review plane: share links, review comments, presence, review workflow metadata, async delivery readiness.
- Bridge rule: failures in cloud review paths must degrade to local-only behavior without interrupting capture/edit/export.
- Auth rule: unauthenticated clients cannot access protected cloud review/collaboration data.
- Monetization rule: subscription/billing failures cannot block local `Capture`/`Edit`/deterministic `Export`; only paid cloud features are gated.
- Contract rule:
  - Local media RPC remains in `packages/engine-protocol`.
  - Review payload contracts live in `packages/review-protocol` and must not expand native engine media responsibilities.

Renderer hardening (current):

- Desktop bridge text file reads are restricted to `.json` files under the active project directory or OS temp directories.
- Desktop bridge media source resolution is restricted to known video extensions (`.mov`, `.mp4`, `.m4v`, `.webm`) under the active project directory or OS temp directories.
- Renderer HTML ships with a restrictive Content Security Policy.

Playback transport hardening (current):

- Local recordings are served through an in-process loopback media server (`http://127.0.0.1:<port>/media/<token>`) instead of direct `file://` playback.
- Media URLs are tokenized with ephemeral UUID path segments and TTL/size-pruned in-memory token storage.
- Media server bind strategy prefers OS-assigned ephemeral binding (`port: 0`) and falls back to reserved loopback ephemeral ports with collision retries.
- The media route supports `GET`/`HEAD` with byte-range responses (`206` / `416`) for scrub/seek behavior.
- Only allowlisted non-file pass-through schemes are accepted (`stub`).
- Requests are restricted to loopback hostnames and include defensive response headers (`no-store`, `nosniff`, no-referrer).

## Engine Client Reliability Policy

- `EngineClient` enforces method-specific request timeouts instead of a single global timeout.
  - Short control-plane reads (`ping`, `permissions`, `capture.status`) fail fast.
  - Long operations (`project.open`, `project.save`) get longer timeout budgets.
  - `export.run` is non-timed by default so long exports are not failed by arbitrary client deadlines.
- Unexpected sidecar exit now immediately rejects all pending requests with an explicit process-exit error.
- Transient transport failures are retried in Bun for read-only methods only, using typed transport errors (not string matching).
- Restart handling uses bounded attempts with backoff + jitter and a circuit-open cooldown after repeated crash loops.
- Mutating methods (capture/recording start-stop, export run, project writes) are not auto-retried to avoid duplicate side effects.
- Renderer picker flows (`open project`, `save as`, export target selection) use a single host RPC (`ggPickPath`) with explicit modes: `openProject`, `saveProjectAs`, `export`.
- `openProject` selections are constrained to `.gglassproj` package paths.
- macOS build hooks patch generated `Info.plist` entries to register `.gglassproj` using `UTExportedTypeDeclarations` (custom UTI) and `CFBundleDocumentTypes` (`LSItemContentTypes` + `LSTypeIsPackage`) so Finder treats projects as single package items by default.
- `saveProjectAs` prefers a native save dialog when the host runtime exposes one; otherwise it falls back to an open picker that accepts either a target `*.gglassproj` file or a directory (resolved to `<directory>/<default-name>.gglassproj`).
- Save/Save As/Export pickers default to the platform Videos/Movies directory (`Utils.paths.videos`) and fall back to Documents when unavailable.
- Save path collisions can trigger a host confirmation message before replacing an existing `*.gglassproj` target.
- Renderer picker flows treat host RPC timeout responses as recoverable interruptions and show workflow guidance instead of a sticky fatal error state.
- Renderer save flows surface the resolved target path before write confirmation.
- Transport mutations (`start/stop preview`, record toggles) reconcile against follow-up `capture.status` polls before final notice state to reduce stale transport-state drift.

## Renderer UI State (Creator Studio)

- The desktop renderer keeps editor mode (`Capture`/`Edit`/`Deliver`) and inspector selection in a shared studio controller.
- The studio shell persists workspace layout and restore state (`gg.studio.layout.v1`):
  - pane widths/collapse (left + right)
  - timeline height
  - last route + locale
- Locale-aware routing is canonical and centralized:
  - route schema: `/:locale/:mode`
  - supported locales: `en-US`, `de-DE`
  - route helpers generate navigation/redirect targets and normalize unknown locale segments
- Inspector rendering is centralized in a single panel component and driven by:
  - active mode
  - current selection (timeline clip/marker, capture window, export preset)
- Selection is normalized when mode changes so mode-incompatible selections are cleared in controller state, not only at render time.
- Timeline entities are keyboard-focusable selectable controls and update inspector context directly.
- Timeline toolbar exposes pro-style operations (`Select`/`Trim`/`Blade`, snap/ripple toggles, zoom controls) and lane controls (`lock`/`mute`/`solo`) while preserving keyboard/pointer parity.
- Waveform/media source hydration uses query-driven data flows so async loading, cancellation, and cache state are centralized.
- Timeline playback uses a shared frame timebase model aligned to media playback state for stable transport behavior.
- Date/number UI formatting is localized via controller-level wrappers (`Intl.DateTimeFormat`, `Intl.NumberFormat`) so components avoid ad-hoc formatting logic.
- Capture inspector includes source monitor and audio mixer surfaces (master + mic) for operational monitoring.
- Project utility rail includes a lightweight media-bin summary (recording/events asset readiness) alongside active metadata and recents.

## Deliver Review Performance Patterns (adapted from Lawn)

- Route intent preloading:
  - Use route-level intent preloads (`hover`/`focus`/`touch`) for likely next views.
  - Apply prewarm debounce + dedupe windows and short subscription extension to avoid redundant network churn.
- Media warmup:
  - Add `preconnect` and `dns-prefetch` for streaming image/video origins.
  - Prefetch runtime dependencies and manifests on intent to reduce startup latency.
  - Keep all prefetch paths best-effort and non-blocking.
- Async upload/transcode orchestration:
  - Direct upload to object storage via signed URL.
  - Server-side completion validation and processing-state transitions.
  - Webhook signature verification and idempotent reconciliation for ready/failed updates.
- Playback fallback policy:
  - Prefer processed review stream when available.
  - Fall back to original source playback while processing paths are unavailable.
- Realtime review collaboration:
  - Presence heartbeat + disconnect semantics for active viewers.
  - Timestamped comment threading and status fields for review workflow.

## Supported Engine Methods (Phase 1 parity)

- `system.ping`
- `engine.capabilities`
- `agent.preflight`
- `agent.run`
- `agent.run` executes a deterministic local pipeline service (`transcribe -> beatMap -> qa -> cutPlan`).
- `agent.status`
- `agent.apply`
- `permissions.get`
- `permissions.requestScreenRecording`
- `permissions.requestMicrophone`
- `permissions.requestInputMonitoring`
- `permissions.openInputMonitoringSettings`
- `sources.list`
- `capture.startDisplay`
- `capture.startCurrentWindow`
- `capture.startWindow`
- `capture.stop`
- `recording.start`
- `recording.stop`
- `capture.status`
- `export.info`
- `export.run`
- `export.runCutPlan`
- Agent flows should call `agent.preflight` first and only run when `ready=true`.
- `agent.run` enforces preflight-first sequencing by requiring a valid short-lived `preflightToken`.
- Transcription input is provider-driven: `none` (returns `missing_local_model`) or `imported_transcript`.
- Imported transcript input is explicit JSON (`segments[]` and/or `words[]` with timed entries).
- For `imported_transcript`, narrative QA derives beat coverage from transcript content (not source-duration heuristics).
- `agent.apply` and `export.runCutPlan` share one canonical cut-plan execution path.
- Cut-plan artifacts are frame-based (`startFrame`/`endFrame`, `sourceFPS`) to avoid time rounding drift.
- Agent run metadata is canonicalized in `analysis/run-summary.v1.json`; project-level summaries derive from that manifest.
- Agent preflight blocks weak-input runs (`no_audio_track`, `silent_audio`) before apply/export is possible.
- `agent.status` remains compact (`status` + optional `blockingReason`) for deterministic automation logic.
- Narrative QA failures with non-empty transcripts report `blockingReason=weak_narrative_structure` (reserved `empty_transcript` for token-empty transcripts).
- Desktop engine client exposes `sendRaw(method, params)` for test/diagnostic flows that need engine-originated errors without request schema pre-validation; this is disabled in production unless `GG_ENGINE_ALLOW_RAW_RPC=1`.
- `project.current`
- `project.open`
- `project.save`
- `project.recents`
- Review-plane methods remain outside this local engine method set and should use the review contract surface (`packages/review-protocol`).

## `capture.status` Telemetry Contract

`capture.status` includes transport-safe capture telemetry for the desktop telemetry row:

- `isRunning`, `isRecording`, `recordingDurationSeconds`, `recordingURL`, `lastError`, `eventsURL`
- `telemetry`:
  - `sourceDroppedFrames`
  - `writerDroppedFrames`
  - `writerBackpressureDrops`
  - `achievedFps`
  - `cpuPercent` (`null` when unavailable)
  - `memoryBytes` (`null` when unavailable)
  - `recordingBitrateMbps` (`null` when unavailable)
  - `captureCallbackMs`
  - `recordQueueLagMs`
  - `writerAppendMs`

Protocol policy for `capture.status`:

- Engines must emit the full telemetry payload.
- Renderer and host parsing require the exact telemetry schema instead of synthesizing compatibility defaults.

Telemetry delivery model for desktop shell:

- Native engine remains the source of truth for runtime telemetry fields (`cpuPercent`, `memoryBytes`, `recordingBitrateMbps`) and latency metrics returned by `capture.status`.
- Bun host streams status updates to renderer via `hostCaptureStatus` RPC messages (browser event: `gg-host-capture-status`) on adaptive cadence:
  - `250ms` while recording
  - `500ms` while capture is running but not recording
  - `1000ms` while idle
- Renderer updates React Query cache from the stream and only uses direct `capture.status` fetches for bootstrap and mutation-sync paths.

Hardware verification:

- `bun run capture:benchmark` drives the native engine directly through `EngineClient` and runs the 60 and 120 fps benchmark scenarios used for capture acceptance checks.
- Reports are written to `.tmp/capture-benchmarks/<timestamp>/report.json` and `.tmp/capture-benchmarks/<timestamp>/report.md`.

Capture start requests support runtime capture cadence selection:

- `capture.startDisplay.params.captureFps` (`24 | 30 | 60 | 120`, default `30`)
- `capture.startCurrentWindow.params.captureFps` (`24 | 30 | 60 | 120`, default `30`)
- `capture.startWindow.params.captureFps` (`24 | 30 | 60 | 120`, default `30`)

Capture FPS is independent from export preset FPS. Export cadence remains defined by the selected export preset.

Current-window semantics:

- `capture.startCurrentWindow` is resolved engine-side against the frontmost shareable window, reducing shell-side fallback heuristics.

## Why This Split

- UI iteration speed and styling improve with React/Tailwind.
- Capture/audio/rendering stays native for quality and permissions correctness.
- Cross-platform shell ships one product surface while native engines converge on capability parity over time.

## Testing

- Desktop protocol and bridge tests: `bun run desktop:test:coverage`
- Full repository gate: `bun run gate`

## Future Platform Targets

- Evolve `engines/windows-native` and `engines/linux-native` from protocol-complete foundations into production capture/audio/export engines.
- Keep `.gglassproj` as the shared project contract across engines.
- Current scaffold stubs live in `engines/windows-stub` and `engines/linux-stub` for parallel UI/protocol work.
