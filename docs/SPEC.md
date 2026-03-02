# Spec.md — Guerilla Glass (Open-source Cross-Platform Creator Recorder & Editor)

## 1) Goal

Build an open-source, cross-platform creator recording studio that helps users move from capture to polished delivery quickly.

Core product outcome:

- Entire display(s) or a single window (including iOS Simulator)
- Optional system audio + microphone
- Cursor + click metadata (when permitted)

…and exports “beautiful by default” videos using automatic motion design (auto-zoom, cursor smoothing, motion blur, background framing, and vertical exports).

Implementation strategy:

- Cross-platform desktop shell (Electrobun + React/Tailwind)
- Native per-OS media engines behind a shared typed protocol

### 1.1) Product north star

Guerilla Glass should feel like a professional creator tool:

- Fast record entry and reliable source/audio control (OBS-style operational capture discipline)
- Viewer/timeline/inspector-first editing ergonomics (Final Cut/Resolve-style workstation flow)
- Automatic polish with manual override (Screen Studio-style cinematic defaults)
- Async review workflow in `Deliver` (frame-accurate comments, link sharing, presence) without moving capture/edit off native-local execution.

---

## 2) Assumptions (verified + notes)

### Screen capture APIs

- **ScreenCaptureKit was introduced in macOS 12.3.**
- **ScreenCaptureKit (WWDC22) supports high-performance capture and can deliver both screen frames and audio sample buffers via SCStream outputs.**
- **Apple’s ScreenCaptureKit sample app (WWDC22) requires macOS 13+ to run.** Use macOS 13+ as the **v1 baseline**, and gate system/audio features accordingly.
- **macOS Sonoma adds the system Screen Capture picker (`SCContentSharingPicker`).** Presenter overlay and screenshot APIs are also covered in WWDC23 ScreenCaptureKit updates. Optional for v1.

### Input tracking permissions

- **Input Monitoring** permission is required for apps that monitor keyboard/mouse/trackpad input globally.
- **Accessibility** permission is required only if the app controls the Mac via accessibility APIs; it is **not required** for passive cursor/click timestamping.
- Implementation notes:
  - Use `IOHIDCheckAccess(kIOHIDRequestTypeListenEvent)` to check Input Monitoring status and guide users to System Settings when needed.
  - Use `AXIsProcessTrusted/AXIsProcessTrustedWithOptions` only if Accessibility-based UI inspection or control is added.

### iOS Simulator recording

- Simulator content can be captured via:
  - Window capture (ScreenCaptureKit)
  - Native CLI tooling (`xcrun simctl io … recordVideo`) for validation/fallback during development

### Ecosystem reality

- Screen capture itself is commoditized; cinematic presentation (auto-zoom, framing, vertical recomposition) is the differentiator.

---

## 3) Non-goals (v1)

- Live streaming (RTMP)
- Cloud-first capture/edit dependency (capture/edit/export must not require network services)
- Full cloud timeline collaboration suite
- Anonymous cloud review/collaboration access
- Full NLE feature set

---

## 4) Platform & stack

- **Desktop shell:** Electrobun + React + Tailwind + shadcn base components
- **Web landing/auth shell:** TanStack Start + Convex (`apps/web-landing`)
- **Protocol contract:** Zod (TypeScript) + Swift line-based wire codec + shared Rust protocol crate
  - `capture.status` telemetry emits machine-stable reason codes (`engine_error`, `high_dropped_frame_rate`, `elevated_dropped_frame_rate`, `low_microphone_level`); renderer localizes these codes for UI.
  - `capture.status` telemetry includes aggregate and channel-specific performance metrics (`sourceDroppedFrames`, `writerDroppedFrames`, `writerBackpressureDrops`, `achievedFps`) plus runtime diagnostics (`cpuPercent`, `memoryBytes`, `recordingBitrateMbps`) for capture diagnostics.
  - Runtime telemetry diagnostics are engine-owned and sampled from monotonic process/runtime counters (no renderer-side metric synthesis).
  - Desktop shell delivers high-frequency capture telemetry via host push stream (`hostCaptureStatus` / `gg-host-capture-status`) rather than renderer timer polling.
  - `capture.startDisplay`, `capture.startCurrentWindow`, and `capture.startWindow` accept `captureFps` (`24 | 30 | 60`, default `30`) and this is decoupled from export preset FPS.
  - `capture.startCurrentWindow` resolves the active frontmost shareable window in the engine, so renderer menu actions do not have to infer "current" from cached source ordering.
  - `capture.status` includes `captureMetadata` (with optional window identity for window captures) so shell status surfaces can reflect the active source from engine state rather than only form intent.
  - Additive protocol evolution rule: new response fields should be optional or renderer-derivable so older engines remain compatible during rollout.
- **Review control plane (Phase 2.5+):** Convex query/mutation/action layer for review workflows (`shareLinks`, `comments`, `presence`, review statuses) and webhook-driven media state reconciliation.
- **Contract split:** local media RPC stays in `packages/engine-protocol`; cloud review surfaces use a separate contract package (`packages/review-protocol`) so capture/edit/export methods remain clean and deterministic.
- **Authentication stack (Phase 2.5+):**
  - Better Auth is the canonical identity/session provider for product access.
  - Convex auth configuration validates Better Auth-issued identity tokens for cloud review/collaboration functions.
  - Clerk is not part of the Guerilla Glass authentication architecture.
- **Billing and entitlement stack (Phase 2.6+):**
  - Convex Stripe component (`@convex-dev/stripe`) is the billing backbone for checkout, subscriptions, customer portal, and billing webhooks.
  - Billing entitlements are server-enforced and map directly to paid cloud collaboration capabilities.
  - Local capture/edit/export remains available regardless of billing state.
- **Native engines (per platform):**
  - macOS: Swift sidecar (`engines/macos-swift`) as current production capture/export path
  - Shared Rust native foundation: `engines/native-foundation` (runtime + protocol parity handlers reused by Windows/Linux sidecars)
  - Windows: Rust sidecar foundation (`engines/windows-native`) with protocol parity handlers
  - Linux: Rust sidecar foundation (`engines/linux-native`) with protocol parity handlers
  - Stubs: protocol-compatible Windows/Linux stubs for parallel shell/protocol iteration
- **Current feature baseline:** macOS 13.0+ for full native capture/export path
  - Stretch: validate whether **12.3+ video-only** support is feasible for engine-only paths.
- **Development environment:** Cursor IDE + SweetPad (no Xcode project workflow).
- **Build system:** SwiftPM (`Package.swift` is the source of truth; no `.xcodeproj`).
- **App identity:**
  - Display name: **guerillaglass**
  - Bundle identifier: **com.okikeSolutions.guerillaglass**
- **Code quality tooling (no‑Xcode workflow):**
  - Formatter: **SwiftFormat** with a repo‑level `.swiftformat` config.
  - Linting: **SwiftLint** with `.swiftlint.yml` (editor plugin + CI checks).
  - Public API documentation coverage gate: `Scripts/docs_gate.mjs` with thresholds in `docs/doc_coverage_policy.json`.
  - Optional: **Periphery** for dead‑code detection in later phases.
  - Build logs: **xcbeautify** for readable CLI output.
  - LSP: **xcode-build-server** to support Cursor/SweetPad indexing.
- Native engine capture:
  - macOS: ScreenCaptureKit (video + system audio where supported), AVFoundation (microphone)
  - Windows/Linux: evolving to native capture/audio parity via Rust sidecars
- Native engine encoding/muxing:
  - macOS: AVFoundation
  - Windows/Linux: target equivalent native encode/mux pipelines
- Native engine rendering:
  - macOS: Metal preferred, Core Image acceptable for MVP
  - Windows/Linux: target deterministic renderer parity with platform-native acceleration

---

## 5) Capability matrix (cross-platform parity targets)

| Capability                         | macOS (`macos-swift`)                       | Windows (`windows-native`) | Linux (`linux-native`) | Stub engines      |
| ---------------------------------- | ------------------------------------------- | -------------------------- | ---------------------- | ----------------- |
| Display capture                    | Production (13+)                            | In progress                | In progress            | Simulated         |
| Window capture                     | Production (13+)                            | In progress                | In progress            | Simulated         |
| System audio capture               | Supported where SCStream source supports it | Planned                    | Planned                | Simulated         |
| Microphone capture                 | Production (AVFoundation)                   | In progress                | In progress            | Simulated         |
| Cursor/click event tracking        | Production (Input Monitoring-gated)         | Planned parity             | Planned parity         | Simulated         |
| Auto-zoom planner + effects model  | Production                                  | Planned parity             | Planned parity         | Protocol coverage |
| Export presets + project save/load | Production                                  | In progress                | In progress            | Protocol coverage |
| Project recents index              | Production (bookmark-backed)                | In progress (native index) | In progress (native index) | Protocol coverage |

Notes:

- Feature parity is a product requirement; rollout sequencing and execution tracking live in `docs/ROADMAP.md`.
- UI must disclose capability differences by OS/engine target and degrade gracefully.
- System audio is only exposed when OS + source support it.
- Cursor/click tracking remains optional and permission-gated.

---

## 6) Product principles

- Beautiful defaults, minimal configuration
- Local-first and privacy-respecting
- Professional creator workflow (record → edit → deliver)
- Project-based workflow (record once -> export many)
- Fast time-to-first-recording
- Automatic polish with manual override
- Cross-platform parity via a shared protocol contract
- Explicit determinism contract
- Native-feeling UX per platform (HIG/OS conventions) and top-tier performance
- Dual-plane architecture: local media plane (authoritative) + cloud review plane
- Cloud review must fail open; local capture/edit/export remain available offline
- Account-scoped collaboration: review/collab data must be tied to authenticated identities
- Commercial model: open-source local creator core plus paid cloud collaboration tiers

---

## 7) Functional requirements

### 7.1 Capture

- Display capture
- Window capture (including iOS Simulator)
- Capture at native display resolution; downscale only in preview/export.
- Runtime capture cadence selector supports `24/30/60` fps. Capture cadence is independent from export cadence, which remains preset-defined.
- Audio:
  - Microphone via native per-OS audio capture pipeline
  - System/app audio where platform APIs and source types support it
- Unified timebase: all streams (screen, system audio, mic, events) are timestamped against a single `CaptureClock` to prevent drift.
- Optional event tracking:
  - Cursor positions (timestamped)
  - Mouse clicks (down/up, button, position)

### 7.2 Look & feel processing

- Auto-zoom virtual camera (offline planning)
- Cursor smoothing, scaling, click highlights
- Motion blur (camera + cursor only; no optical-flow blur)
- Background framing: padding, rounded corners, shadow
- Aspect-ratio exports: 16:9, 9:16 (camera path re-planned per ratio)
- Auto-zoom tuning: toggle, intensity, and minimum keyframe interval

### 7.3 Basic editing (v1)

- Trim in/out
- Preview playback + scrubber + playback speed control
- In `Edit`, the media element is the playback clock authority; transport/timeline state mirrors media play/pause/time events to avoid dual-clock drift.
- Media source/waveform hydration should follow query-driven loading/caching flows instead of effect-chained state updates.
- Timeline tool discipline (`Select` / `Trim` / `Blade`) with snap/ripple toggles
- Timeline zoom controls and per-lane lock/mute/solo controls

### 7.4 Export

- Presets:
  - 1080p 30fps H.264
  - 1080p 60fps H.264
  - 4K 30fps H.265
  - 1080×1920 30fps H.264
- Output: MP4 or MOV

### 7.5 Desktop editor layout contract (non-dashboard)

- Guerilla Glass is a screen recording and editing tool. The primary shell must follow an editor-first layout (closer to pro NLE/recording tools) and must not ship as a generic settings dashboard.
- Required primary regions:
  - Top transport/status bar (record state, elapsed time, core actions)
  - Center preview/stage as the dominant surface
  - Bottom timeline with scrubber/playhead and trim controls
  - Right inspector for contextual settings (capture/effects/export/project)
  - Optional left utility panel for sources/scenes/session state
- Timeline and preview are first-class workflow surfaces, not secondary cards.
- Permission and diagnostics views are supportive panels; they must not become the app’s primary visual hierarchy.
- Keyboard-first controls must be preserved for core actions (record toggle, play/pause, trim in/out, save, export).
- Degraded-mode messaging (for denied Input Monitoring or similar capability gaps) must remain visible in context near preview/record controls.

### 7.6 Creator Studio shell guide (requirements)

This section operationalizes the non-dashboard contract into an implementation plan that can be shipped incrementally while preserving working capture, recording, project open/save, and export behavior.

Design baseline (from pro-tool patterns):

- Workflow-first shell: prioritize throughput and editing clarity over decorative UI chrome.
- Fast entry into recording: users should be able to start recording in one focused flow with source/audio controls immediately visible.
- Persistent workstation panes: top transport/status, left utility panel, center viewer, right inspector, bottom timeline.
- Contextual controls: inspector content changes by selection/mode; avoid showing unrelated settings by default.
- Keyboard-first operations: all core actions remain available without pointer dependency.
- Capture-first telemetry: record state, elapsed time, and health indicators stay visible while recording/editing.
- Desktop renderer state architecture:
  - TanStack Router for explicit mode navigation (`Capture`, `Edit`, `Deliver`)
  - TanStack Query for typed engine RPC query/mutation flows
  - TanStack Form for typed studio settings and export form state

Creator Studio implementation requirements:

- Top transport/status bar must always show:
  - record state
  - elapsed duration/timecode
  - quick actions (`record`, `play/pause`, `save`, `export`)
- Left panel provides session/source access (`sources`, `media`, optional `projects/recent`).
- Center viewer is the dominant stage; permission or diagnostics UI is supportive, not primary.
- Right inspector is contextual (`capture`, `effects`, `export`, `project`) and selection-aware.
- Bottom timeline is always present and treated as a first-class editing surface.
- Capture onboarding and permission prompts must be integrated into the workflow without turning the shell into a diagnostics dashboard.
- Renderer effects hygiene: avoid direct state updates in effects for derivable/query-backed state; prefer query/memoized/controller-derived data flows.
- Project lifecycle remains first-class in shell:
  - open existing project
  - save/save as
  - preserve project state for repeat exports
  - Open Project picker targets `.gglassproj` packages (project container contract).
  - Save As resolves and validates target package paths in host shell code; renderer receives the final path.
  - Save As uses a native save panel when available in the host runtime.
  - Save As fallback uses an open picker that accepts either a `*.gglassproj` file path or a directory, then resolves to a final `*.gglassproj` target path in host shell code.
  - Save path collisions may require explicit host confirmation before replacing an existing project package.
  - Save/Save As/Export picker defaults should start in platform Videos/Movies directories, with Documents as a host fallback.
- Project utility panel must provide:
  - active project metadata (name/path, capture metadata, URLs, duration)
  - recent projects list with one-action reopen from the utility rail

Execution tracking, rollout sequencing, and backlog checklists for the Creator Studio shell are maintained in `docs/ROADMAP.md`.
Detailed accessibility policy and verification steps remain in `docs/DESKTOP_ACCESSIBILITY.md`.

### 7.7 Agent Mode v1 (local-only)

Goal:

- From an existing project recording, run a local rough-cut pipeline end-to-end with no human intervention unless blocked by QA or destructive confirmation.

Scope (v1):

- Deterministic local pipeline service: `transcribe -> beatMap -> qa -> cutPlan` under `agent.run`.
- Local transcript analysis with word timings.
- `agent.preflight` is required before `agent.run` so agents can fail fast on blockers without trial/error runs.
- Narrative beat mapping with canonical structure: `hook -> action -> payoff -> takeaway`.
- Strict narrative QA gate before `agent.apply` and `export.runCutPlan`.
- Deterministic cut-plan apply/export path for repeatable behavior.
- Guerilla Glass-native implementation only (no external editor/plugin integration in v1).
- Transcription is explicit and pluggable via provider contract:
  - `none` provider: returns `missing_local_model`.
  - `imported_transcript` provider: reads imported transcript JSON input.

Hard rules:

- `agent.apply` and `export.runCutPlan` are blocked when narrative QA fails.
- Destructive apply operations require explicit confirmation (`destructiveIntent=true`) when unsaved project changes are present.
- `agent.apply` is a strict alias to `export.runCutPlan`; there is one canonical cut-plan execution engine.
- `run-summary.v1` is the canonical agent manifest; project summary state derives from this artifact.
- Agent artifacts are written under the project package `analysis/` directory.
- Cut-plan segments are frame-based (`startFrame`/`endFrame`) with source FPS metadata.
- `force` is debug-only (disabled in production unless `GG_AGENT_ALLOW_FORCE=1`).
- v1 source target: recordings up to 10 minutes.
- `agent.status` is intentionally compact: one `status` field plus optional `blockingReason`.
- `agent.run` requires a valid short-lived `preflightToken` from `agent.preflight` (TTL: 60 seconds).

Protocol surface:

- `agent.preflight`
- `agent.run`
- `agent.status`
- `agent.apply`
- `export.runCutPlan`

`agent.preflight` result contract:

- `ready: boolean`
- `blockingReasons: AgentBlockingReason[]`
- `canApplyDestructive: boolean`
- `preflightToken: string | null` (`null` unless `ready=true`)

`agent.run` request contract additions:

- `preflightToken: string` (required; must match latest preflight inputs and active project/recording state)

`agent.status.blockingReason` values (when present):

- `empty_transcript`: transcript has no usable timed tokens.
- `weak_narrative_structure`: transcript exists, but QA coverage is missing one or more required beats.

Imported transcript contract (`imported_transcript` provider):

- JSON object with one or both arrays:
  - `segments[]` with `{ text, startSeconds, endSeconds }`
  - `words[]` with `{ word, startSeconds, endSeconds }`
- Timing invariants:
  - `startSeconds >= 0`
  - `endSeconds > startSeconds`
- At least one valid segment or one valid word is required.
- Reference fixtures:
  - `packages/engine-protocol/fixtures/imported-transcript.valid.json`
  - `packages/engine-protocol/fixtures/imported-transcript.invalid.json`

Error model additions:

- `needs_confirmation`
- `qa_failed`
- `missing_local_model`
- `invalid_cut_plan`

Agent runbook (required order):

1. `agent.preflight`
2. If `ready=true`, call `agent.run` with returned `preflightToken`.
3. Poll `agent.status` until terminal (`completed` or `blocked`/`failed`).
4. Call `agent.apply` (handle `needs_confirmation` by retrying with `destructiveIntent=true` when intended).
5. Call `export.runCutPlan` for deterministic export.

Retry rules:

- If run/apply returns preflight-token mismatch/expiry errors, rerun `agent.preflight` and retry with the new token.
- If `qaReport.missingBeats` is non-empty, regenerate transcript/beat quality before apply/export.

Artifact contract (project-relative paths):

- `analysis/transcript.full.v1.json`
- `analysis/transcript.words.v1.json`
- `analysis/beat-map.v1.json`
- `analysis/qa-report.v1.json`
- `analysis/cut-plan.v1.json`
- `analysis/run-summary.v1.json`

### 7.8 Deliver Review (cloud plane)

Goal:

- Add an async review layer in `Deliver` while preserving the existing local `Capture -> Edit -> Deliver (final export)` workflow as the default production path.

Scope (Phase 2.5+):

- Link-based review sharing with access controls (expiry, optional password, download policy).
- Frame/time-accurate comments with threaded replies and resolved state.
- Watcher presence and lightweight collaborator awareness for active review sessions.
- Review workflow states (`review`, `rework`, `done`) separate from edit timeline state.
- Async upload/transcode orchestration (direct upload + webhook status reconciliation) so UI stays responsive.
- Playback source fallback policy (processed stream preferred when ready; original source fallback when unavailable).

Performance patterns adapted from the Lawn reference implementation:

- Intent-based route prewarm for likely next queries (`hover`/`focus`/`touch`) with debounce + dedupe + short-lived subscription extension.
- Media network warmups (`preconnect`/`dns-prefetch`) for streaming origins.
- Best-effort runtime and manifest prefetch for streamed playback paths.
- Warmups must never block navigation or local editing actions.

Hard boundaries:

- Convex/network paths are not allowed to gate `Capture`, `Edit`, or deterministic `Export`.
- Native engine protocol remains focused on local media compute and project determinism.
- Review data is additive metadata, not the source of truth for timeline edits or render determinism.
- Review/collaboration mutations and protected reads require authenticated user identity.

### 7.9 Authentication & access control

Identity and session policy:

- Better Auth is the required authentication system for product access.
- All cloud review and collaboration capabilities require logged-in users.
- The Creator Studio workspace (`Capture`, `Edit`, `Deliver`) is account-gated in product mode; unauthenticated users are limited to auth/onboarding screens.
- Existing authenticated sessions may continue local capture/edit/export during temporary network outages; new sign-in is required when session validity expires.
- Implementation baseline follows the Convex Labs React integration guide for Better Auth (`framework-guides/react`) with these required constraints:
  - `convex` version `>= 1.25.0`.
  - `better-auth` pinned to `1.4.9` (`--save-exact`) until compatibility is revalidated and documented.

Authorization policy:

- Convex public functions must validate identity on every protected request before data access.
- Team/project/video resources enforce role-aware access (`owner`, `admin`, `member`, `viewer`) for reads and mutations.
- Share links and access grants are secondary authorization layers and do not replace identity requirements for collaboration actions.
- Audit attribution (actor identity + timestamp) is required for cloud review mutations (comments, review status changes, link administration).

Required integration artifacts (Phase 2.5 baseline):

- Dependency baseline:
  - `@convex-dev/better-auth` installed in the web landing/auth workspace (`apps/web-landing`).
  - `convex@latest` with runtime validation that installed version satisfies `>= 1.25.0`.
  - `better-auth@1.4.9` pinned exactly.
- Convex component registration:
  - `apps/web-landing/convex/convex.config.ts` uses `@convex-dev/better-auth/convex.config`.
- Convex auth provider wiring:
  - `apps/web-landing/convex/auth.config.ts` provides `getAuthConfigProvider()` from `@convex-dev/better-auth/auth-config`.
- Better Auth server instance:
  - `apps/web-landing/convex/auth.ts` initializes Better Auth with Convex adapter and plugins (`crossDomain`, `convex`).
  - `trustedOrigins` must include product web origin(s) and local dev origin(s).
- Better Auth HTTP handlers:
  - `apps/web-landing/convex/http.ts` mounts auth routes via `authComponent.registerRoutes(..., { cors: true })`.
- Renderer auth client:
  - `auth-client` uses `better-auth/react` with Convex client plugins (`convexClient`, `crossDomainClient`).
- Renderer provider:
  - App root wraps with `ConvexBetterAuthProvider`; Convex client should use `expectAuth: true` for account-gated product mode.
- Environment baseline:
  - Convex env: `BETTER_AUTH_SECRET`, `SITE_URL`.
  - Renderer env: `VITE_CONVEX_URL`, `VITE_CONVEX_SITE_URL`, `VITE_SITE_URL`.
  - For social auth providers, redirect/callback URLs must use the Convex site domain (`https://<deployment>.convex.site/api/auth/callback/<provider>`).

### 7.10 Billing & entitlement model (Convex Stripe)

Billing policy:

- Paid cloud features are subscription-gated using Convex Stripe component data as the backend billing source of truth.
- Local-first creator core (`Capture`, `Edit`, deterministic `Export`) remains available even if billing is inactive.
- Collaboration/hosted review capabilities may be gated by active subscription entitlements.

Billing integration baseline (Phase 2.6):

- Component registration:
  - `apps/web-landing/convex/convex.config.ts` registers `@convex-dev/stripe/convex.config.js`.
- Webhook routing:
  - `apps/web-landing/convex/http.ts` registers Stripe routes through `registerRoutes(...)` at `/stripe/webhook`.
- Billing actions:
  - `apps/web-landing/convex/stripe.ts` defines authenticated actions for checkout and customer portal session creation.
  - Billing actions must associate Stripe customers/subscriptions to authenticated app user/org identifiers.
- Entitlement projection:
  - Server-side projection derives capability flags from subscription status and seat quantity.
  - Renderer consumes entitlement flags reactively and must not decide access from client-calculated billing logic.

Required billing environment:

- Convex env:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
- App env/config:
  - Canonical Stripe price IDs for plan tiers (for example: `GG_STRIPE_PRICE_ID_PRO`, `GG_STRIPE_PRICE_ID_TEAM`).
  - Success/cancel return URLs that map back to authenticated app routes.

Webhook/event baseline:

- Stripe webhook endpoint must target `https://<deployment>.convex.site/stripe/webhook`.
- Required event coverage includes:
  - `checkout.session.completed`
  - `customer.created`, `customer.updated`
  - `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
  - `invoice.created`, `invoice.finalized`, `invoice.paid`, `invoice.payment_failed`
  - `payment_intent.succeeded`, `payment_intent.payment_failed`

Security and correctness constraints:

- Checkout price selection must be server allowlisted (never trust client-submitted arbitrary price IDs).
- Webhook signatures must be verified before mutating billing state.
- Access control checks for paid cloud features must run server-side per request using entitlement projection.
- Billing feature rollout must use `GG_BILLING_ENABLE_STRIPE`; if disabled or degraded, app falls back to non-billing local workflow.

---

## 8) Permissions & fallbacks

Required permissions:

1. Screen Recording (required to capture displays/windows; first-run prompt requires app restart)
2. Microphone (if enabled)
3. **Input Monitoring** (only if event tracking enabled)

Preferred consent flow (macOS 14+):

- Use `SCContentSharingPicker` for privacy-aligned capture selection.

Optional / future:

- **Accessibility** (only if AX-based automation or UI inspection is added)

Fallback behavior:

- If Input Monitoring denied:
  - Recording continues
  - Auto-zoom triggers and click highlights disabled
  - UI clearly indicates degraded automation mode
- If bypassing the system picker on macOS 15+: users may see periodic re‑authorization prompts; design UX to explain and re‑request access.

---

## 9) iOS Simulator capture behavior

- v1:
  - Detect Simulator windows by owner/bundle id
  - Default to frontmost Simulator window
  - Capture full window (including macOS chrome)
- Development note:
  - `xcrun simctl io booted recordVideo` is documented by Apple; use as a validation/fallback tool
- v2+:
  - Optional auto-crop to device viewport

---

## 10) Determinism contract

- Determinism target:
  - **Pre-encode frame buffers are deterministic**
  - Same project + same app version + same settings + same hardware class ⇒ pixel-identical rendered frames
- Encoding/container bytes are **not** guaranteed to be identical.
- Tests hash pre-encode frames to validate determinism.
- Assumptions:
  - Same OS version
  - Same color space (SDR only in v1)
  - Same Metal feature set
- Cloud review metadata does not participate in render determinism; determinism scope remains local pre-encode frame output.

---

## 11) Performance & quality targets (baseline: Apple Silicon M1/M2)

- Capture (1080p/60, 10 min):
  - Dropped frames ≤ 0.5%
  - Avg CPU ≤ 20% (excluding encode spikes)
- Export (1080p/60):
  - ≤ 1.5× realtime (target, not hard requirement)
- Deliver review (target values):
  - Review shell route transition remains interactive without blocking on media readiness.
  - Intent prewarm defaults start at ~120ms debounce, ~3s dedupe, and ~8s subscription extension (tunable via instrumentation).
  - Playback startup should fall back to the original source if processed stream readiness is delayed.
  - Comment and presence updates should propagate in near-realtime (target p50 sub-second delivery).

---

## 12) Mezzanine strategy (v1)

- Default: **H.264 mezzanine**, high bitrate, **short GOP / frequent keyframes**
- Rationale: smaller files, simpler pipeline
- Store mezzanine at capture (native) resolution to preserve detail for zoom; downscale on export.
- v2 option: ProRes 422 LT mezzanine for higher-quality reframes

---

## 13) Rendering pipeline

- Preview renderer:
  - Downscaled
  - Simplified/no motion blur
  - Optimized for scrubbing
- Export renderer:
  - Full resolution
  - All effects enabled
  - Deterministic

---

## 14) Auto-zoom constraints (v1 defaults)

- Max zoom-in: 2.5×
- Min visible area: ≥ 40% of source
- Safe margin: 8–12% of visible frame
- Dwell threshold: cursor speed < V for ≥ 350 ms
- Cursor velocity filter (EMA or Kalman) before dwell/pan evaluation to reduce jitter.
- Max pan speed & acceleration capped (“no nausea” rule)
- Minimum keyframe interval: 1/30 s (coalesce same-timestamp events; bucket to limit density)
- If no events: mild center framing only

---

## 15) Project format & versioning

Project container:

- File extension: `.gglassproj`
- macOS: treated as a **package** (single file in Finder, directory on disk)
- Desktop shell build hooks register `.gglassproj` as a package document type on macOS by writing `UTExportedTypeDeclarations` (custom project UTI) and `CFBundleDocumentTypes` (`LSItemContentTypes` + `LSTypeIsPackage`) into generated `Info.plist`.
- Cross‑platform: other OSes see a folder with the same contents

Project directory contents:

- `project.json` (includes `projectVersion` + capture metadata for event-to-capture mapping)
- `recording.mov`
- `audio_system.m4a` (optional)
- `audio_mic.m4a` (optional)
- `events.json` (optional)

`events.json` schema (v1):

- Root object: `schemaVersion` (Int), `events` (array)
- Event fields:
  - `type`: `cursorMoved` | `mouseDown` | `mouseUp`
  - `timestamp`: seconds since recording start (Double)
  - `position`: `{ "x": Double, "y": Double }` in global screen coordinates (points)
  - `button`: optional `left` | `right` | `other` (for mouse down/up)

Library & recents:

- Maintain a private library index in Application Support for “Open Recent”
- Index stores bookmarks/metadata only; actual projects live in user‑chosen locations
- Protocol method `project.recents` returns recent project metadata:
  - `projectPath` (absolute path)
  - `displayName` (user-facing name)
  - `lastOpenedAt` (ISO 8601 timestamp)
- Foundation Windows/Linux engines persist recents metadata to a native index file in the user data directory; production parity targets bookmark/security-scoped behavior equivalent to macOS.

Versioning policy:

- Always migrate forward on load
- Never write older schema versions

---

## 16) Architecture modules

1. Desktop Shell (Electrobun main + React/Tailwind renderer)
2. Engine Protocol (typed request/response wire contract)
3. Native Capture Engine (permission-gated)
4. Native Event Tracker (permission-gated)
5. Project Store (schema + migrations)
6. Automation Planner (virtual camera)
7. Renderer / Compositor
8. Export Pipeline
9. Review Control Plane (Convex domain model: teams/projects/videos/comments/share/presence)
10. Upload & Transcode Orchestrator (signed uploads, processing state machine, webhook reconciliation)
11. Review Contract Layer (`packages/review-protocol` for host/renderer/cloud payload schemas)

Desktop shell and sidecar reliability contract (current):

- Engine transport errors are typed and surfaced explicitly (unavailable, timeout, sidecar exit/failure, circuit-open).
- Request timeout policy is method-specific; `export.run` is non-timed by default to avoid aborting valid long exports.
- Automatic retries are limited to read-only methods and transport failures.
- Repeated crash loops open a restart circuit for a cooldown window before restart attempts resume.
- Review-control failures must degrade to local-only workflow (no capture/edit/export interruption).

---

## 17) Project structure (proposed)

```
guerillaglass/
├─ README.md
├─ LICENSE
├─ Package.swift
├─ package.json
├─ PrivacyInfo.xcprivacy
├─ CONTRIBUTING.md
├─ CODE_OF_CONDUCT.md
├─ SECURITY.md
├─ SUPPORT.md
├─ CHANGELOG.md
├─ THIRD_PARTY_NOTICES.md
├─ GOVERNANCE.md (optional)
├─ .github/
│  ├─ CODEOWNERS
│  ├─ ISSUE_TEMPLATE/
│  └─ PULL_REQUEST_TEMPLATE.md
├─ Scripts/
│  ├─ full_gate.sh
│  ├─ rust_gate.sh
│  ├─ typescript_gate.sh
│  └─ docs_gate.mjs
├─ docs/
│  ├─ SPEC.md
│  ├─ ROADMAP.md
│  ├─ ARCHITECTURE.md
│  ├─ DESKTOP_ACCESSIBILITY.md
│  └─ doc_coverage_policy.json
├─ apps/
│  ├─ desktop-electrobun/
│  │  ├─ src/
│  │  │  ├─ bun/
│  │  │  └─ mainview/
│  │  ├─ tests/
│  │  │  └─ ui/
│  │  ├─ electrobun.config.ts
│  │  ├─ tailwind.config.mjs
│  │  └─ vite.config.ts
│  └─ web-landing/
│     ├─ src/
│     ├─ public/
│     ├─ convex/
│     └─ vite.config.ts
├─ packages/
│  ├─ engine-protocol/
│  │  ├─ src/
│  │  └─ fixtures/
│  ├─ review-protocol/
│  │  ├─ src/
│  │  └─ fixtures/
│  └─ localization/
│     └─ src/
├─ engines/
│  ├─ macos-swift/
│  │  └─ modules/
│  │     ├─ capture/
│  │     ├─ inputTracking/
│  │     ├─ project/
│  │     ├─ automation/
│  │     ├─ rendering/
│  │     └─ export/
│  ├─ native-foundation/
│  ├─ windows-native/
│  ├─ linux-native/
│  ├─ windows-stub/
│  ├─ linux-stub/
│  ├─ stub-common/
│  ├─ protocol-rust/
│  └─ protocol-swift/
└─ Tests/
   ├─ automationTests/
   ├─ captureTests/
   ├─ engineProtocolTests/
   ├─ exportTests/
   ├─ projectMigrationTests/
   └─ renderingDeterminismTests/
```

---

## 18) Phased delivery

**Phase 0 — Hybrid platform foundation**

- Electrobun desktop shell with React/Tailwind UI
- Typed protocol package shared across shell/runtime boundaries
- Native Swift sidecar engine process for capture permissions/source discovery

**Phase 1 — Recorder MVP**

- Production-grade macOS capture/export path
- Display/window capture
- Mic audio
- Trim + export
- Project save/load + versioning (protocol-based open/save)
- Creator Studio editor-first shell baseline (`Capture`/`Edit`/`Deliver`)
- Localization: keep desktop shell strings localizable
- Post‑localization polish audit (UI/UX, performance, accessibility)

**Phase 2 — Cinematic defaults**

- Input Monitoring-gated event tracking
- Auto-zoom planning + constraints
- Background framing
- Vertical export with re-planned camera
- Windows/Linux native engine parity expansion (capture/audio/export protocol coverage)
- Localization: add/refresh localized strings for all new UI and errors
- Post‑localization polish audit (UI/UX, performance, accessibility)

**Phase 2.5 — Deliver review acceleration (cloud plane)**

- Convex-backed review control plane (`share`, `comments`, `presence`, review status metadata)
- Contract split implementation (`packages/review-protocol`) without expanding native engine media scope
- Async upload/transcode orchestration with webhook reconciliation for review playback readiness
- Deliver-route intent prewarm and media warmup patterns for perceived-latency wins
- Feature-flagged rollout with local-only fallback preserved

**Phase 2.6 — Commercial access and billing (cloud plane)**

- Convex Stripe component integration for checkout, subscriptions, invoices, and webhook sync
- Entitlement projection service for paid cloud collaboration features
- Team/seat billing support for organization collaboration flows
- Hosted billing portal and subscription lifecycle controls
- Feature-flagged rollout with local creator core unaffected by billing outages

**Phase 3 — Polish**

- Motion blur controls
- Per-segment overrides
- Simulator auto-crop
- Optional ProRes mezzanine
- Cross-platform creator-workflow polish parity (menu, shortcuts, diagnostics, onboarding)
- Localization: update strings for new controls, settings, and export options
- Post‑localization polish audit (UI/UX, performance, accessibility)

Detailed phase task lists and completion status are tracked in `docs/ROADMAP.md`.

---

## 19) Licensing

- Code: choose **MIT** or **Apache-2.0** and document the rationale.
- Assets: license-compatible or optional download; all assets must have explicit licenses.
- Third-party dependencies: list in `THIRD_PARTY_NOTICES.md` (or `NOTICE` if Apache-2.0).

---

## 20) Open-source readiness & contribution setup

Required repo artifacts:

- `CONTRIBUTING.md`: local dev setup, build/run, testing, coding style, PR checklist.
- `CODE_OF_CONDUCT.md`: Contributor Covenant (or equivalent).
- `SECURITY.md`: vulnerability reporting + disclosure timeline.
- `SUPPORT.md`: where to ask questions (GitHub Discussions, etc.).
- `.github/ISSUE_TEMPLATE/` + `PULL_REQUEST_TEMPLATE.md`: structured intake.
- `CODEOWNERS` (optional but recommended for review routing).
- `CHANGELOG.md`: user-facing release notes.

Contribution policy:

- Decide **DCO sign-off** vs **CLA** and document in `CONTRIBUTING.md`.
- Define review standards: CI must pass, tests required for behavior changes, deterministic rendering tests updated where relevant.
- Tag-based triage: `bug`, `feature`, `good first issue`, `help wanted`, `design`, `performance`.

License hygiene:

- Keep a rolling third‑party inventory; automated checks recommended (e.g., license scanning in CI).
- Add attribution for bundled assets/fonts.
- Maintain `PrivacyInfo.xcprivacy` for any required‑reason APIs used by the app or dependencies.

---

## 21) Human Interface Guidelines (HIG) & native feel

- Follow platform HIG principles for desktop layout, navigation patterns, and control behavior.
- Keep navigation and primary actions discoverable in the shell (keyboard-first paths for start/stop record, export, and project save/open).
- Preserve accessibility defaults across platforms (focus order, readable contrast, reduced-motion behavior when available).
- Prefer clear status surfaces for capture/record/export state over hidden modal-only feedback.

---

## 22) Localization & internationalization

- **String catalogs:** Use a single desktop-shell localization source of truth (e.g. locale JSON catalogs in the React app).
- **Internationalize first:** All user-facing strings must be localizable. Avoid hardcoded UI copy in components.
- **Pluralization:** Use locale-aware message formatting for plural nouns/verbs.
- **Formatting:** Use locale-aware date/number/measurement formatting instead of manual string interpolation.
- **No concatenation:** Avoid building sentences by concatenating fragments; use localized format strings instead.
- **App Store:** Plan to localize App Store metadata per territory when shipping.
- Current desktop shell baseline:
  - Canonical locales: `en-US`, `de-DE`
  - Locale-scoped routes: `/:locale/capture`, `/:locale/edit`, `/:locale/deliver`
  - Unknown locale segments redirect to the default locale route
  - Locale-aware UI formatting uses `Intl.DateTimeFormat` and `Intl.NumberFormat` wrappers in the studio controller
- Respect system accessibility preferences where available (Reduce Motion, high contrast, reduced transparency).
- Accessibility baseline: screen reader labels, keyboard navigation, focus order, high-contrast checks.
- Preserve expected desktop menu/shortcut conventions per platform.
- Provide in‑app permission explanations before triggering OS prompts; degrade gracefully when denied.

### Must-haves (macOS compliance)

- Hardened Runtime + code signing; notarization for non–App Store distribution.
- App Sandbox enabled unless a documented, reviewed exception is required.
- Request permissions only from direct user intent; never on launch.
- Provide user-facing privacy/usage disclosures for any protected resources (e.g., mic, input monitoring).
- Avoid private APIs and fragile behavior; document any OS‑version limitations with clear UX fallbacks.
- Ensure accessibility coverage (labels, keyboard navigation, VoiceOver order) for all primary workflows.
- Keep UI responsive under capture/export loads; avoid blocking the main thread.

---

## 23) Verification sources (links)

- Apple WWDC22: “Meet ScreenCaptureKit” — https://developer.apple.com/videos/play/wwdc2022/10156/
- Apple ScreenCaptureKit sample app (WWDC22) README — https://github.com/Fidetro/CapturingScreenContentInMacOS
- Apple WWDC23: “What’s new in ScreenCaptureKit” — https://developer.apple.com/videos/play/wwdc2023/10136/
- Apple WWDC23: “What’s new in privacy” (SCContentSharingPicker) — https://developer.apple.com/videos/play/wwdc2023/10053/
- Apple Support: Input Monitoring on macOS — https://support.apple.com/en-kg/guide/mac-help/mchl4cedafb6/mac
- Apple Support: Accessibility access on macOS — https://support.apple.com/en-afri/guide/mac-help/mh43185/mac
- Apple Developer Docs: `xcrun simctl io … recordVideo` — https://developer.apple.com/library/archive/documentation/IDEs/Conceptual/iOS_Simulator_Guide/InteractingwiththeiOSSimulator/InteractingwiththeiOSSimulator.html
- Apple Design: HIG entry point — https://developer.apple.com/design/get-started/
- Apple Developer: macOS get started — https://developer.apple.com/macos/get-started/
- Apple Developer Docs: SCContentSharingPicker — https://developer.apple.com/documentation/screencapturekit/sccontentsharingpicker
- Apple Developer Docs: Privacy manifest — https://developer.apple.com/documentation/bundleresources/adding-a-privacy-manifest-to-your-app-or-third-party-sdk
- Gannon Lawlor: Input Monitoring & AX trust checks — https://gannonlawlor.com/2022/07/02/accessing-mouse-events-on-macos/
- macOS Sequoia screen recording re‑authorization prompt (reports) — https://www.macrumors.com/2024/08/15/macos-sequoia-screen-recording-app-permissions/
- macOS Sequoia prompt details (reports) — https://9to5mac.com/2024/08/14/macos-sequoia-screen-recording-prompt-monthly/
- Better Auth docs — https://www.better-auth.com/docs
- Convex React docs — https://docs.convex.dev/client/react
- Convex React quickstart — https://docs.convex.dev/quickstart/react
- Convex TanStack Start quickstart — https://docs.convex.dev/quickstart/tanstack-start
- Convex authentication docs — https://docs.convex.dev/auth
- Convex Labs Better Auth React guide — https://labs.convex.dev/better-auth/framework-guides/react
- Convex Stripe component — https://www.convex.dev/components/stripe
- Convex Stripe README/API reference — https://github.com/get-convex/stripe
- Screen Studio product site — https://screen.studio/
- lawn pricing/product site — https://lawn.video/#pricing
- DaVinci Resolve product page — https://www.blackmagicdesign.com/products/davinciresolve
- Final Cut Pro user guide (interface/workflow) — https://support.apple.com/guide/final-cut-pro/final-cut-pro-interface-ver92bd100a/mac
- OBS knowledge base (sources/workflow) — https://obsproject.com/kb/sources-guide

```

This version incorporates all verified corrections (OS baselines, permissions precision, audio reality, determinism scope) while keeping the spec tight, testable, and build-oriented.
```
