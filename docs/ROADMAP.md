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
- [x] Add capture telemetry row (record state, duration, source/writer drop counters, performance timings)
- [x] Keep core shell actions wired to engine protocol (`record`, `open/save`, `export`)
- [x] Route `Current Window` recording through engine-side frontmost window resolution (`capture.startCurrentWindow`) instead of renderer-side source-order inference
- [x] Handle host-dialog RPC timeouts as recoverable workflow interruptions with guidance copy
- [x] Keep core keyboard shortcuts (`record`, `play/pause`, `trim in/out`, `save`, `export`)
- [ ] Add user-configurable shortcut overrides with validation and conflict handling
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
    - Layout persistence parsing now runs through an Effect Schema before migration/sanitize steps.
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
  - [x] Add a persistent technical feedback strip (source drops, writer drops/backpressure, achieved FPS, CPU, memory, bitrate, callback/queue/writer latency) with OBS-style immediate visibility.
  - Implementation notes:
    - Runtime diagnostics (`cpuPercent`, `memoryBytes`, `recordingBitrateMbps`) are sampled in the native capture engine telemetry store and emitted through `capture.status`.
    - Desktop shell streams `capture.status` updates from Bun host to renderer (`hostCaptureStatus` / `gg-host-capture-status`) with adaptive cadence; renderer cache is stream-fed instead of 250ms query polling.
    - Native capture benchmarking now runs through `bun run capture:benchmark`, which writes repeatable JSON/Markdown reports for the 60 and 120 fps display/window scenarios under `.tmp/capture-benchmarks/`.

---

## 3) Agent Mode productization track

Reference requirements: `docs/SPEC.md` §7.7

This track turns the existing Agent Mode protocol surface into a first-class desktop workflow inside Creator Studio.

Workspace UX checklist:

- [ ] Add visible Agent Mode entry points in the desktop workspace without creating a separate dashboard shell
- [ ] Surface preflight readiness and blocking reasons in the active project workflow
- [ ] Render proposed cut plans / apply intent as first-class reviewable UI objects
- [ ] Add explicit destructive apply confirmation flow in the workspace
- [ ] Render structured approvals and user-input requests inline instead of generic modal-only handling
- [ ] Surface agent artifacts (`run-summary`, QA report, cut plan) from project context panels
- [ ] Ensure Agent Mode augments preview/timeline/inspector workflows rather than displacing them

Groundwork already present:

- [x] Agent Mode protocol surface exists across TypeScript/Swift/Rust contracts
- [x] Preflight token handshake and blocking semantics are implemented
- [x] Agent artifacts persist inside project packages under `analysis/*.v1.json`
- [x] Deterministic cut-plan apply/export path exists in the engine contract

---

## 4) Release engineering & distribution track

Reference requirements: `docs/SPEC.md` §19

This track formalizes desktop packaging, tagged releases, smoke validation, and signing/notarization operations.

Release workflow checklist:

- [x] Canonical quality gate workflow exists in CI (`.github/workflows/full_gate.yml`)
- [x] Desktop parity matrix workflow exists for cross-target verification groundwork
- [ ] Add tag-triggered desktop release workflow with explicit prerelease/latest semantics
- [ ] Add release preflight job that reruns canonical quality gates before packaging/publish
- [ ] Add desktop packaging pipeline for supported artifact targets
- [ ] Add release-smoke validation job for version propagation and packaging metadata
- [ ] Add packaged-app startup smoke coverage in CI where feasible
- [ ] Document signing/notarization secret requirements and dry-run unsigned packaging path
- [ ] Document expected artifact set and manual release verification checklist
- [ ] Decide and document desktop update metadata/update-channel strategy

---

## 5) Polished demo editor core track

Reference requirements: `docs/SPEC.md` §7.3 and §7.8

This track is the current product priority. It turns Creator Studio from a recorder/trimmer with polish settings into a real polished demo editor, which is the product wedge that should carry the broader vision.

Editing depth checklist:

- [ ] Add true live preview during active recording instead of placeholder-only recording state.
- [ ] Elevate display capture to a first-class primary record affordance alongside current-window capture.
- [ ] Replace the synthetic single-clip timeline model with a real clip/segment data model.
- [ ] Implement clip split/delete/lift/move operations and make the ripple toggle behavior real.
- [ ] Add per-segment camera/zoom editing with manual keyframe override.
- [ ] Add crop/reframe/redaction/highlight tools for demo-focused editing.
- [ ] Add transcript import plus caption editing/export baseline.
- [ ] Keep Agent Mode supportive of preview/timeline/inspector workflows rather than phase-defining.

Delivery packaging checklist:

- [ ] Expand `Deliver` beyond preset selection into a real packaging surface.
- [ ] Add lightweight packaging metadata such as chapters/titles/end-card treatments where they improve demo delivery.
- [ ] Keep all packaging metadata local-first and deterministic with respect to exported media.

Groundwork already present:

- [x] Editor-first shell baseline exists (`Capture` / `Edit` / `Deliver`).
- [x] Timeline toolbar and lane surface exist.
- [x] Auto-zoom and background-framing settings exist in the inspector.
- [x] Deliver/export route exists as a local surface.
- [x] Imported-transcript protocol groundwork exists for later caption/transcript editing.

Sequencing note:

- Existing web/auth/review scaffolding remains in the repo as groundwork for the hosted delivery/commercialization vision.
- Hosted delivery remains part of the destination product, but it is not the current release-defining milestone while the editor core checklist above is still incomplete.

---

## 6) Hosted delivery and commercialization track

Reference requirements: `docs/SPEC.md` §7.8–§7.9

This track preserves the overarching product vision: Guerilla Glass should eventually extend the local creator studio with hosted review/collaboration for teams. It is intentionally sequenced after the editor core work, but it is not an abandoned or optional direction.

Hosted delivery checklist:

- [ ] Add hosted share-link publishing from `Deliver`.
- [ ] Add timestamp comments/replies and lightweight review workflow state.
- [ ] Add presence, review status, and delivery analytics where they materially improve team collaboration.
- [ ] Add authenticated user/org identity for hosted surfaces only.
- [ ] Add hosted permissions and visibility controls without polluting the local media contract.
- [ ] Add billing/entitlement for hosted collaboration features only.
- [ ] Preserve fail-open local behavior when hosted services are unavailable or the user is not on a paid plan.

Groundwork already present:

- [x] Web shell exists under `apps/web`.
- [x] Convex backend/auth scaffolding exists under `apps/web/convex`.
- [x] `packages/review-protocol` exists for hosted review contract evolution.

Sequencing note:

- The editor core remains the immediate priority because it determines whether the local product is compelling on its own.
- Hosted delivery work should advance enough to avoid contract drift and clarify the destination, but it must not outrun local capture/edit/export quality.

---

## 7) Phased delivery execution status

Reference scope: `docs/SPEC.md` §18

**Phase 0 — Hybrid platform foundation**

- Electrobun desktop shell with React/Tailwind UI
- Typed protocol package shared across shell/runtime boundaries
- Native Swift sidecar engine process for capture permissions/source discovery

Progress (current repo)

- [x] Electrobun shell scaffolded
- [x] Effect Schema protocol package added
- [x] Native Swift `guerillaglass-engine` target added

**Phase 1 — Capture/export baseline**

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

**Phase 2 — Polished demo editor core**

- Input Monitoring-gated event tracking
- Auto-zoom planning + constraints
- Background framing
- Vertical export with re-planned camera
- Live capture preview that remains useful while recording
- True clip-based editing model (split/delete/reorder/ripple)
- Crop/reframe/redaction/highlight treatments for demos
- Transcript/caption editing baseline
- Localization: add/refresh localized strings for all new UI and errors
- Post‑localization polish audit (UI/UX, performance, accessibility)

Progress (current repo)

- [x] Input Monitoring permission flow + event tracking
- [x] Auto-zoom planning + constraints (planner + renderer wiring + UI tuning)
- [ ] Background framing
- [ ] Vertical export with re-planned camera
- [ ] Live preview remains useful during recording
- [ ] True clip-based editing model implemented
- [ ] Crop/reframe/redaction/highlight tools implemented
- [ ] Transcript/caption editing baseline implemented
- [ ] Windows native capture/audio/export parity milestones
- [ ] Linux native capture/audio/export parity milestones
- [ ] Localization updated for Phase 2 UI
- [ ] Post‑localization polish audit (UI/UX, performance, accessibility)

**Phase 3 — Packaging, hosted delivery, polish, and parity**

- Motion blur controls
- Per-segment overrides
- Simulator auto-crop
- Optional ProRes mezzanine
- Delivery packaging improvements (chapters/titles/end-card style metadata where they fit)
- Hosted sharing/review surfaces for teams
- Account/auth/billing rollout for hosted features only
- Cross-platform creator-workflow polish parity (menu, shortcuts, diagnostics, onboarding)
- Localization: update strings for new controls, settings, and export options
- Post‑localization polish audit (UI/UX, performance, accessibility)

Progress (current repo)

- [ ] Motion blur controls
- [ ] Per-segment overrides
- [ ] Simulator auto-crop
- [ ] Optional ProRes mezzanine
- [ ] Delivery packaging improvements
- [ ] Hosted sharing/review surfaces for teams
- [ ] Account/auth/billing rollout for hosted features only
- [ ] Cross-platform creator-workflow polish parity
- [ ] Localization updated for Phase 3 UI
- [ ] Post‑localization polish audit (UI/UX, performance, accessibility)
