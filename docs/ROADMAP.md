# ROADMAP.md — Guerilla Glass Execution Plan

## 1) Document ownership

- `docs/SPEC.md` is the normative source for product requirements, architecture, constraints, and verification links.
- `docs/ROADMAP.md` is the execution tracker for milestone sequencing, task checklists, and implementation backlog.
- Roadmap tasks should reference relevant spec sections when requirements context is needed.

---

## 2) Creator Studio shell execution tracking

Reference requirements: `docs/SPEC.md` §7.5–§7.6

Creator Studio tracking checklist (current repo):

- [x] Replace card-dashboard shell with contiguous editor panes
- [x] Add explicit mode switch (`Capture`, `Edit`, `Deliver`) with stable navigation state
- [x] Keep timeline permanently visible in primary layout across desktop breakpoints
- [x] Convert timeline slider into lane-based timeline surface (video/audio/events tracks)
- [x] Add timeline operation toolbar (tool mode, snap/ripple toggles, zoom controls)
- [x] Add per-lane lock/mute/solo controls for video/audio lanes
- [x] Make inspector fully contextual to selection and mode
- [x] Add project utility panel support for recent projects + active project metadata
- [x] Add source monitor + audio mixer surfaces in capture inspector
- [x] Add media-bin summary to project utility rail
- [x] Add layout persistence (pane sizes/collapse/workspace restore)
- [x] Add capture telemetry row (record state, duration, dropped frames, audio level, health)
- [x] Keep core shell actions wired to engine protocol (`record`, `open/save`, `export`)
- [x] Route `Current Window` recording through engine-side frontmost window resolution (`capture.startCurrentWindow`) instead of renderer-side source-order inference
- [x] Handle host-dialog RPC timeouts as recoverable workflow interruptions with guidance copy
- [x] Keep core keyboard shortcuts (`record`, `play/pause`, `trim in/out`, `save`, `export`)
- [x] Keep degraded-mode messaging visible near preview/recording context
- [x] Add host command bus between Bun shell menu/tray and renderer actions
- [x] Add cross-platform native shell actions (application menu on macOS/Windows, tray fallback on Linux)
- [x] Add menu-state synchronization (`canSave`, `canExport`, `isRecording`) for dynamic labels/enablement
- [x] Align macOS application menu template + wiring with Electrobun guidance (native app menu + command routing)
- [x] Modularize shell menu code into builders/actions/router units with tests
- [x] Complete accessibility pass for focus visibility, contrast, and reduced-motion behavior

Accessibility implementation notes:

- Canonical focus treatment uses `:focus-visible` styles across shell controls and custom timeline entities.
- Pane/timeline resize separators are keyboard-operable (`Arrow`, `Home`, `End`) with `role="separator"` value semantics.
- Reduced-motion and increased-contrast/forced-colors media queries are implemented in shell CSS.
- Single-key shortcuts (`R`, `I`, `O`, `Space`) can be disabled in-canvas and are scoped away from interactive control focus.
- Separator/timeline drag interactions use Pointer Events + pointer capture with TanStack Pacer throttling (`wait: 16`) and explicit `flush`/`cancel` end-state handling.
- Detailed policy and verification steps are documented in `docs/DESKTOP_ACCESSIBILITY.md`.

Suggested rollout order:

1. Studio pane scaffold (no protocol changes)
2. Timeline lanes + contextual inspector behavior
3. Project utility panel + layout persistence
4. Capture telemetry expansion + final accessibility polish

Creator Studio pro-UI parity backlog (next pass):

- Phase A — Visual foundation + keyboard clarity
  - [x] Switch Tailwind/system surface palette from blue-tinted dark to neutral dark grays (`~#1E1E1E` to `~#2D2D2D`) while keeping contrast-compliant text.
  - [x] Reduce chrome/panel noise (lighter separators, fewer heavy borders/glows/boxed cards, flatter pane surfaces).
  - [x] Tighten typography for pro density (smaller utility labels, reduced decorative uppercase tracking, cleaner hierarchy).
  - [x] Enforce strict icon/state color semantics (monochrome default; red for recording/error; green for healthy/live; blue or orange for active selection only).
  - [x] Expose shortcuts in actionable UI affordances (`Blade (B)`, `Play/Pause (Space)`, `Save (Cmd/Ctrl+S)`) across tooltips and menu labels.
  - Implementation notes:
    - Semantic tone tokens are defined in renderer CSS (`--gg-tone-neutral`, `--gg-tone-danger`, `--gg-tone-success`, `--gg-tone-selected`, `--gg-tone-selected-alt`) and applied via utility classes rather than raw component variants.
    - Top-shelf controls are icon-only; language and density controls moved to native menu/tray actions (`app.locale.enUS`, `app.locale.deDE`, `view.density.comfortable`, `view.density.compact`).
    - Shared shortcut registry (`src/shared/shortcuts.ts`) now drives renderer hotkeys, tooltip hints (`Kbd`), and native menu labels/accelerators to prevent binding drift.
- Phase B — Workflow hierarchy + readability
  - [x] Rebalance default layout so preview + timeline are visually dominant and utility rails are more recessive/collapsible.
  - Implementation notes:
    - Added dominant layout presets per route (`capture`/`edit`/`deliver`) with one-time application per route and reset-to-preset behavior.
    - Layout persistence parsing now runs through a Zod schema before migration/sanitize steps.
    - Updated pane and timeline surface styling so utility rails are visually recessive while center preview/timeline surfaces carry stronger emphasis.
  - [x] Upgrade timeline readability (audio waveform-rich lanes, stronger clip semantics, clearer selected-state/playhead contrast).
  - Implementation notes:
    - Timeline lanes now render semantic clip identity and a higher-contrast selected clip/playhead treatment.
    - Audio lanes render waveform bars using decoded media when available, with input-event-derived fallback waveform generation.
    - Playback transport now uses dual clocks: a smooth display clock for playhead rendering and a frame-quantized edit clock for trim/blade/snap actions.
    - Edit-route media sync uses `requestVideoFrameCallback` (with `requestAnimationFrame` fallback) instead of coarse `timeupdate` playhead stepping.
  - [x] Improve inspector context switching so clip/marker/source selection immediately swaps to specific controls with minimal generic scaffolding.
  - Implementation notes:
    - Inspector body rendering now routes from a single `resolveInspectorView(...).id` dispatch path, keeping header/body view mapping in sync.
    - Timeline clip and marker selections render dedicated control blocks (timing details + direct actions) without default mode scaffolding.
    - Capture-window and export-preset selections keep their selection-specific details while retaining core mode controls for continuity.
    - Timeline empty-track pointer-down and `Escape` clear inspector selection and return to mode-default inspector content.
  - [x] Add a persistent technical feedback strip (dropped frames, CPU, memory, bitrate/audio level, recording health) with OBS-style immediate visibility.
  - Implementation notes:
    - Runtime diagnostics (`cpuPercent`, `memoryBytes`, `recordingBitrateMbps`) are sampled in the native capture engine telemetry store and emitted through `capture.status`.
    - Desktop shell streams `capture.status` updates from Bun host to renderer (`hostCaptureStatus` / `gg-host-capture-status`) with adaptive cadence; renderer cache is stream-fed instead of 250ms query polling.

---

## 3) Deliver review acceleration track (Convex plane)

Reference requirements: `docs/SPEC.md` §7.8 and §16

This track adds async review collaboration in `Deliver` while preserving local-first `Capture` and `Edit`.

Contract and architecture checklist:

- [x] Add review contract package scaffold (`packages/review-protocol`) with Zod schemas + fixtures for share/comment/presence payloads.
- [ ] Keep `packages/engine-protocol` focused on local native media operations (no review-specific method leakage).
- [x] Add bridge request/message schema for review RPC and review realtime events in `apps/desktop-electrobun/src/shared/bridgeRpc.ts`.
- [x] Add web app/auth scaffold (`apps/web`) using TanStack Start + Convex baseline wiring.
- [ ] Define feature flag gate (`GG_REVIEW_ENABLE_CONVEX`) and fail-open behavior to local-only workflow.

Authentication and access-control checklist:

- [ ] Integrate Better Auth as the canonical authentication layer for desktop product access.
- [ ] Implement Convex auth configuration and identity validation for protected review/collaboration functions.
- [ ] Enforce account-gated Creator Studio routes in product mode (`Capture`, `Edit`, `Deliver`).
- [ ] Enforce role-aware authorization (`owner`, `admin`, `member`, `viewer`) across review domains.
- [ ] Remove/avoid Clerk dependencies in cloud review/collab surfaces.
- [ ] Add audit attribution for review mutations (actor identity + timestamp).
- [ ] Implement against Convex Labs Better Auth React guide (`framework-guides/react`) as canonical wiring baseline.
- [ ] Add `@convex-dev/better-auth` component wiring (`convex.config.ts`, `auth.config.ts`, `auth.ts`, `http.ts`).
- [ ] Enforce dependency baseline: `convex >= 1.25.0` and `better-auth@1.4.9` pinned exactly until compatibility matrix update.
- [ ] Add renderer auth client wiring (`better-auth/react` + Convex client plugins + `ConvexBetterAuthProvider` with account-gated mode).
- [ ] Validate required environment variables and startup errors for missing auth config.
- [ ] Configure Better Auth `trustedOrigins` and provider callbacks against Convex site auth routes.

Lawn-adapted performance checklist:

- [ ] Implement intent-based review route prewarm (`hover`/`focus`/`touch`) with debounce/dedupe/subscription-extension defaults.
- [ ] Add media-origin warmup strategy (`preconnect`, `dns-prefetch`, runtime prefetch, manifest prefetch) for review playback routes.
- [ ] Ensure warmups remain best-effort and never block route transitions.
- [ ] Add playback source fallback policy for review (`processed stream -> original source`).

Review workflow checklist:

- [ ] Implement link sharing controls (expiry, optional password, download policy, access grants).
- [ ] Implement frame/time-accurate threaded comments with resolved state.
- [ ] Implement watcher presence heartbeats + disconnect handling.
- [ ] Implement review workflow status model (`review`, `rework`, `done`) in Deliver surfaces.

Upload/transcode and reliability checklist:

- [ ] Implement signed upload flow + upload completion validation.
- [ ] Implement transcode readiness reconciliation via verified webhooks.
- [ ] Add idempotent error handling + retry-safe state transitions for upload/transcode lifecycle.
- [ ] Instrument review perceived-latency SLOs and expose regression checks.

---

## 4) Billing commercialization track (Convex Stripe plane)

Reference requirements: `docs/SPEC.md` §7.10 and §18

This track adds paid cloud collaboration billing without regressing local creator workflows.

Billing architecture checklist:

- [ ] Register `@convex-dev/stripe` component in `apps/web/convex/convex.config.ts`.
- [ ] Register Stripe webhook HTTP routes in `apps/web/convex/http.ts` at `/stripe/webhook`.
- [ ] Add billing integration module (`apps/web/convex/stripe.ts`) for checkout/portal actions.
- [ ] Ensure billing actions require authenticated identity and map to user/org records.
- [ ] Implement server-side entitlement projection from subscription status and seat quantity.
- [ ] Add bridge request/message schema for billing RPC/events in `apps/desktop-electrobun/src/shared/bridgeRpc.ts`.

Plan/pricing and product-gating checklist:

- [ ] Define canonical Stripe products/prices for launch plans and map to app entitlement tiers.
- [ ] Add server allowlist for accepted price IDs (reject arbitrary client-submitted prices).
- [ ] Gate paid cloud review/collaboration features on entitlement flags.
- [ ] Keep local `Capture`/`Edit`/deterministic `Export` available regardless of billing state.
- [ ] Add org/seat update flows and role checks for team plan administration.

Reliability and compliance checklist:

- [ ] Configure required Convex env vars (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`).
- [ ] Configure and validate required webhook events (`checkout`, `subscription`, `invoice`, `payment_intent` lifecycle).
- [ ] Add webhook signature validation and idempotent event processing semantics.
- [ ] Add billing outage/degraded-mode behavior with non-blocking local fallback.
- [ ] Add billing observability: checkout conversion funnel, webhook failure alerts, entitlement mismatch alerts.

---

## 5) Phased delivery execution status

Reference scope: `docs/SPEC.md` §18

**Phase 0 — Hybrid platform foundation**

- Electrobun desktop shell with React/Tailwind UI
- Typed protocol package shared across shell/runtime boundaries
- Native Swift sidecar engine process for capture permissions/source discovery

Progress (current repo)

- [x] Electrobun shell scaffolded
- [x] Zod protocol package added
- [x] Native Swift `guerillaglass-engine` target added

**Phase 1 — Recorder MVP**

- Production-grade macOS capture/export path
- Display/window capture
- Mic audio
- Trim + export
- Project save/load + versioning (protocol-based open/save)
- Creator Studio editor-first shell baseline (`Capture`/`Edit`/`Deliver`)
- Localization: keep desktop shell strings localizable
- Post‑localization polish audit (UI/UX, performance, accessibility)

Progress (current repo)

- [x] Display capture preview (ScreenCaptureKit)
- [x] Mic capture skeleton (permission + AVAudioEngine tap)
- [x] Window capture UI + preview
- [x] Engine-side frontmost current-window capture command (`capture.startCurrentWindow`)
- [x] Trim + export
- [x] Project schema + store (save/load on disk)
- [x] Protocol-based project open/save flow in desktop shell
- [x] Protocol-based project recents flow in desktop shell
- [x] Desktop shell strings are centralized in the React surface
- [x] Post‑localization polish audit (UI/UX, performance, accessibility)
- [x] Creator Studio shell alignment (tracked in `docs/ROADMAP.md` §2)

**Phase 2 — Cinematic defaults**

- Input Monitoring-gated event tracking
- Auto-zoom planning + constraints
- Background framing
- Vertical export with re-planned camera
- Agent Mode v1 (Guerilla Glass-native, local-only rough-cut pipeline)
- Windows/Linux native engine parity expansion (capture/audio/export protocol coverage)
- Localization: add/refresh localized strings for all new UI and errors
- Post‑localization polish audit (UI/UX, performance, accessibility)

Progress (current repo)

- [x] Input Monitoring permission flow + event tracking
- [x] Auto-zoom planning + constraints (planner + renderer wiring + UI tuning)
- [x] Agent Mode protocol surface (`agent.preflight`, `agent.run`, `agent.status`, `agent.apply`, `export.runCutPlan`) across TypeScript/Swift/Rust contracts
- [x] Agent Mode v1 artifact contract persisted inside project packages (`analysis/*.v1.json`)
- [x] Narrative QA hard gate enforced for apply/export cut-plan operations
- [x] Project schema v4 migration path for agent-analysis metadata index
- [x] Deterministic local agent pipeline service with frame-based cut plans and canonical `run-summary` manifest
- [x] Agent preflight token handshake (`agent.run` requires `preflightToken`) and explicit imported transcript contract
- [x] Imported-transcript runs use transcript-driven beat coverage (no duration-only QA gating for short clips)
- [x] Agent status semantics refined: `weak_narrative_structure` vs `empty_transcript` for clearer automation branching
- [x] Desktop engine client validation normalization + raw RPC diagnostic path (`sendRaw`) for deterministic agent-debug workflows
- [ ] Background framing
- [ ] Vertical export with re-planned camera
- [ ] Windows native capture/audio/export parity milestones
- [ ] Linux native capture/audio/export parity milestones
- [ ] Localization updated for Phase 2 UI
- [ ] Post‑localization polish audit (UI/UX, performance, accessibility)

**Phase 2.5 — Deliver review acceleration (cloud plane)**

- Better Auth + Convex auth integration for account-gated product access
- Convex-backed review control plane (`share`, `comments`, `presence`, review status metadata)
- Contract split implementation (`packages/review-protocol`) without expanding native engine media scope
- Async upload/transcode orchestration with webhook reconciliation for review playback readiness
- Deliver-route intent prewarm and media warmup patterns for perceived-latency wins
- Feature-flagged rollout with local-only fallback preserved

Progress (current repo)

- [x] Review contract package scaffolded with fixtures and validation
- [x] Desktop bridge review RPC/events baseline added (cloud routing still pending)
- [x] Web app/auth scaffolded in `apps/web` with TanStack Start + Convex dev wiring
- [ ] Better Auth session flows wired for account-gated workspace access
- [ ] Convex auth enforcement wired for protected review/collab functions
- [ ] Share-link access controls + grants implemented
- [ ] Threaded frame/time comments implemented in Deliver review UI
- [ ] Presence heartbeat/watcher flow implemented
- [ ] Upload/transcode webhook reconciliation wired for review readiness
- [ ] Review-route warmup and playback fallback policy implemented
- [ ] Review SLO instrumentation + regression checks added

**Phase 2.6 — Commercial access and billing (cloud plane)**

- Convex Stripe component integration for checkout, subscriptions, invoices, and webhook sync
- Entitlement projection service for paid cloud collaboration features
- Team/seat billing support for organization collaboration flows
- Hosted billing portal and subscription lifecycle controls
- Feature-flagged rollout with local creator core unaffected by billing outages

Progress (current repo)

- [ ] Stripe component registration and webhook route wiring complete
- [ ] Checkout and customer-portal actions implemented with auth enforcement
- [ ] Canonical price-tier mapping and server allowlist implemented
- [ ] Entitlement projection and paid-cloud feature gating implemented
- [ ] Team/seat billing lifecycle controls implemented
- [ ] Billing observability and alerting implemented

**Phase 3 — Polish**

- Motion blur controls
- Per-segment overrides
- Simulator auto-crop
- Optional ProRes mezzanine
- Cross-platform creator-workflow polish parity (menu, shortcuts, diagnostics, onboarding)
- Localization: update strings for new controls, settings, and export options
- Post‑localization polish audit (UI/UX, performance, accessibility)

Progress (current repo)

- [ ] Motion blur controls
- [ ] Per-segment overrides
- [ ] Simulator auto-crop
- [ ] Optional ProRes mezzanine
- [ ] Cross-platform creator-workflow polish parity
- [ ] Localization updated for Phase 3 UI
- [ ] Post‑localization polish audit (UI/UX, performance, accessibility)
