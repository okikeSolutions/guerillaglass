# ROADMAP.md — Guerilla Glass Execution Plan

## 1) Document ownership

- `docs/SPEC.md` is the normative source for product requirements, architecture, constraints, and verification links.
- `docs/ROADMAP.md` is the execution tracker for milestone sequencing, task checklists, and implementation backlog.
- Roadmap tasks should reference relevant spec sections when requirements context is needed.

### UI review follow-up

The 2026-11-08 review of the merged editor is tracked in the [UI review ledger](UI_REVIEW_LEDGER.md), with a [screen/component coverage inventory](UI_REVIEW_INVENTORY.md) and native/browser evidence. It records 40 baseline findings. The fixing pass and its [implementation evidence](UI_IMPLEMENTATION_EVIDENCE.md) cover workflow labels, editor history/recovery, truthful timeline/audio, preview/delivery, native project IO and the public website. Findings remain open for final acceptance where their verification matrix is incomplete; three independent ratings strictly above 9.5/10 are required before preparing the requested PR. Shell checkboxes below describe implementation presence; they do not certify those interactions as polished or complete.

The requested UI pass follows trust/recovery and workflow orientation, then editing/delivery, shared visual conventions and the public website. It is implemented but has not merged; PR preparation requires three fresh independent frozen reviews strictly above 9.5/10. Use the ledger's acceptance criteria and stable IDs in fixing PRs. This baseline review does not complete the later Phase 2 performance/accessibility/polish gate or the outstanding editor features.

Frozen commit `0131236` failed correctness/standards/product review at 8.7/9.0/8.4; [historical reports and follow-up corrections](UI_IMPLEMENTATION_EVIDENCE.md#review-gate) are retained. The follow-up includes same-package Discard and recording-session safety, static camera distinction, permission-check recovery, localized host failures, truthful audio states, preview volume/fullscreen, contextual actions and responsive delivery. All 40 ledger findings remain Ready for verification with explicit limits. This UI work does not complete full camera authoring, native granted capture/audio, the Phase 2 performance/accessibility gate or cross-platform media parity.

The [UI improvement research](UI_IMPROVEMENT_RESEARCH.md) adds primary-source competitor analysis, [Emil Kowalski guidance](audits/2026-11-08-emil-kowalski-ui-guidance.md), proposed screen/component behavior and five UI work slices mapped to every finding. These are recommendations for the UI pass, not completed features or a replacement for the Phase 2 feature sequence below.

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
- [x] Add user-configurable shortcut overrides with validation and conflict handling
  - Implementation notes:
    - Shortcut overrides are edited in the inspector, validated against active bindings, persisted as desktop preferences, and reflected in renderer hotkeys plus native menu/tray hints.
    - Shared shortcut registry tests cover sanitization, conflicts, host menu synchronization, and customized hotkey dispatch.
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
    - Native capture benchmarking now runs through `bun run capture:benchmark`, which opens an animated benchmark scene and writes repeatable JSON/Markdown reports for the 30, 60, and 120 fps display/window scenarios under `.tmp/capture-benchmarks/`.
    - `bun run capture:benchmark:check` now fails locally when a scenario misses its native telemetry thresholds; pass `--baseline-report=.tmp/capture-benchmarks/latest/report.json` to compare against the previous run on the same machine.

---

## 3) Agent Mode productization track

Reference requirements: `docs/SPEC.md` §7.7

This track turns the existing Agent Mode protocol surface into a first-class desktop workflow inside Creator Studio.

External storyboard editing milestone, explicitly requested before the remaining general editor slices. See `docs/AGENT_EDITING_DESIGN.md` and `docs/AGENT_EDITING_RUNBOOK.md`:

- [x] Accept versioned external edit plans and validate source ranges.
- [x] Apply/save and explicitly export a checked project revision.
- [x] Provide a thin authenticated external-agent command adapter.
- [x] Support saved-project review/revision with sequential native ownership.
- [x] Persist and render per-scene camera curves in preview and export.

Follow-up in the same PR:

- [x] Reusable separate storyboard/editing agent workflow with source evidence workspaces.
- [x] Saved-revision renders, unique render receipts, and scene-bound feedback for revision passes.
- [x] Desktop storyboard import, validation, before/after scene review, and explicit apply/save confirmation.
- [x] Exercise a two-agent proposal and a retained-ID correction pass through the packaged editor and native renderer.

The proof uses synthetic footage for deterministic edit/camera checks. Production editorial quality still requires inspecting a real recording's complete render.

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
  - The supported production path is macOS plus an imported timed transcript; foundation shells advertise Agent/cut-plan capabilities as unavailable.
  - Status exposes QA, project-relative artifacts, and the exact rational-FPS frame plan used by both apply and export.
  - The latest run is project-bound and recovered from `run-summary.v1` when reopening a project.
  - Operational guidance and remaining discoverability gaps are tracked in `docs/AGENT_MODE_RUNBOOK.md` and `docs/AGENT_DISCOVERABILITY_AUDIT.md`.

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
- [x] Add packaged-app startup smoke coverage in CI where feasible
  - `bun run desktop:acceptance` launches the real packaged macOS Electrobun app with the Swift engine, verifies runtime milestones/window/cleanup, captures styled browser acceptance screenshots, and emits a machine-readable report.
  - The macOS TypeScript CI job runs the packaged runtime smoke and uploads browser screenshots plus runtime logs/report. Real-window screenshot capture remains opt-in because it requires Screen Recording permission.
- [x] Document desktop executable-trust signing requirements and remaining platform validation notes (`docs/RELEASE_HARDENING.md`)
- [ ] Document notarization secret requirements and dry-run unsigned packaging path
- [ ] Document expected artifact set and manual release verification checklist
- [ ] Decide and document desktop update metadata/update-channel strategy

---

## 5) Polished demo editor core track

Reference requirements: `docs/SPEC.md` §7.3 and §7.8

This track is the current product priority. It turns Creator Studio from a recorder/trimmer with polish settings into a real polished demo editor, which is the product wedge that should carry the broader vision.

Editing depth checklist:

- [x] Add true live preview during active recording instead of placeholder-only recording state.
- [x] Elevate display capture to a first-class primary record affordance alongside current-window capture.
- [x] Replace the synthetic single-clip timeline model with a real clip/gap item model.
- [x] Implement pure clip split/delete/lift/move commands and make the ripple toggle behavior real in renderer state.
- [x] Wire split/lift/delete/move inspector actions and Blade click-to-split to the timeline command layer.
- [x] Add drag-to-move timeline interactions with ripple-aware insert and conservative non-ripple gap/boundary moves.
  - Implementation notes:
    - Timeline clips can be pointer-dragged in Select mode.
    - Ripple-enabled drags resolve to insertion indexes and reuse the pure `moveTimelineItems` command path.
    - Ripple-disabled drags resolve only gaps large enough for the clip, preserve the pointer grab offset, and split destination space around the moved clip.
    - Gap regions use a recessed dashed treatment so lift/non-ripple edit space is visible on the timeline.
    - Browser coverage verifies leading, interstitial, and trailing gap preview; paused gap seeks; reordered source mapping; and native media-end transitions.
- [x] Make macOS export consume timeline v2 items so exported media matches editor split/delete/lift/move state.
  - Implementation notes:
    - macOS `export.run` parses `payload.timeline` v2 clip/gap items and builds an edited `AVMutableComposition` before export.
    - Clip items insert source recording ranges in timeline order; gap items reserve silent program space.
    - Timeline exports use per-item video composition instructions so gaps render as black program space instead of holding the previous frame.
    - Timeline exports remap camera-plan transforms from source ranges into edited program ranges so auto-zoom/camera planning is preserved across timeline edits.
    - Deliver trim fields are applied as `AVAssetExportSession.timeRange` on the edited program timeline, not the original recording timeline.
    - Export tests cover clip/gap composition duration, program-time trim behavior, camera-plan transforms, strict invalid timeline handling, and black gap rendering.
- Implementation design reference: `docs/TIMELINE_EDITING_DESIGN.md`
- [x] Support per-scene manual camera keyframes through external edit plans, project persistence, preview, and native export.
- [ ] Add inspector controls for authoring per-segment camera/zoom keyframes.
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
- [x] Auto-zoom and background-framing settings exist in the inspector with deterministic preview/export wiring.
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
- [x] Background framing
  - Versioned project-global settings drive the live Capture/Edit preview and macOS native export.
  - Preview and export share golden geometry vectors for stage padding, aspect-fit card bounds, corner radius, and shadow formulas.
  - Native export uses explicit sRGB stage color, rounded source masking, gap-aware shadow visibility, and cancellation-aware async export.
  - Capability reporting enables framing only on the production macOS renderer; Rust foundation shells explicitly report it unsupported.
- [x] Vertical export with re-planned camera
  - macOS export derives a fresh camera plan for each selected output preset from persisted input events and the explicit export auto-zoom override (falling back to project settings for older clients).
  - Capture-space event coordinates are normalized through persisted capture metadata before planning against the oriented source dimensions.
  - Camera viewports use the output aspect ratio, so 9:16 exports crop and pan within a portrait viewport instead of reusing landscape transforms.
  - Direct and timeline exports share the same aspect-aware viewport transform while preserving clip/gap and program-time trim semantics.
  - Capture/Edit previews switch between legacy aspect-fit and aspect-aware cover composition with the auto-zoom toggle.
  - Swift coverage verifies landscape-versus-portrait replanning, deterministic viewport geometry, event-directed raster output, and encoded portrait dimensions.
- [x] Live preview remains useful during recording
- [x] Timeline v2 clip/gap data model implemented in contract, renderer, and Swift project state
- [x] Pure split/delete/lift/move command layer implemented with unit coverage
- [x] Inspector actions and Blade click-to-split wired to timeline commands
- [x] macOS export applies timeline v2 edits, gaps, program-time trims, and camera-plan transforms
- [x] Drag-to-move timeline interaction implemented
- [ ] Crop/reframe/redaction/highlight tools implemented
- [ ] Transcript/caption editing baseline implemented
- [ ] Windows native capture/audio/export parity milestones
- [ ] Linux native capture/audio/export parity milestones
- [ ] Localization updated for Phase 2 UI
- [ ] Post‑localization polish audit (UI/UX, performance, accessibility)

Suggested Phase 2 PR slices:

1. `phase2/timeline-v2-export-macos` — make macOS export honor timeline v2 edits, gaps, and program-time Deliver trims.
2. `phase2/timeline-drag-move-gaps` — add drag-to-move, finish gap interaction/readability, and verify preview behavior across gaps.
3. `phase2/background-framing-contract` — define persisted background framing/effects settings in the project/export contract per `docs/BACKGROUND_FRAMING_DESIGN.md` (implemented).
4. `phase2/background-framing-renderer` — implement native export rendering for background stage, padding, rounded screen card, and shadow (implemented).
5. `phase2/vertical-camera-replan` — make camera planning/export aspect-ratio-aware for 9:16 vertical output (implemented).
6. `phase2/segment-camera-overrides` — clip-level camera/keyframe model, external authoring, preview and export implemented; inspector authoring controls remain.
7. `phase2/crop-reframe-tool` — add deterministic crop/reframe controls with preview/export wiring.
8. `phase2/redaction-highlight-tools` — add redaction/highlight overlay models and render hooks.
9. `phase2/transcript-import` — add transcript import UI and persist transcript artifacts in the project package.
10. `phase2/caption-edit-export` — add caption editing surface plus caption render/export hooks.
11. `phase2/localization-refresh` — refresh `en-US`/`de-DE` strings for Phase 2 UI and errors.
12. `phase2/polish-audit` — run UI/UX, performance, and accessibility verification after Phase 2 features land.
13. `phase2/windows-media-parity` — replace Windows foundation media stubs with production capture/audio/export milestones.
14. `phase2/linux-media-parity` — replace Linux foundation media stubs with production capture/audio/export milestones.

**Phase 3 — Packaging, hosted delivery, polish, and parity**

- Motion blur controls
- Advanced per-segment visual/effect overrides beyond Phase 2 camera/keyframe controls
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
- [ ] Advanced per-segment visual/effect overrides beyond Phase 2 camera/keyframe controls
- [ ] Simulator auto-crop
- [ ] Optional ProRes mezzanine
- [ ] Delivery packaging improvements
- [ ] Hosted sharing/review surfaces for teams
- [ ] Account/auth/billing rollout for hosted features only
- [ ] Cross-platform creator-workflow polish parity
- [ ] Localization updated for Phase 3 UI
- [ ] Post‑localization polish audit (UI/UX, performance, accessibility)
