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
  - [ ] Improve inspector context switching so clip/marker/source selection immediately swaps to specific controls with minimal generic scaffolding.
  - [ ] Add a persistent technical feedback strip (dropped frames, CPU, memory, bitrate/audio level, recording health) with OBS-style immediate visibility.
- Phase C — Docking architecture
  - [ ] Implement true docking (tear-off/floating panels, drag/snap docking zones, saved workspace presets: `Edit`, `Color`, `Audio`, `Stream`).

---

## 3) Phased delivery execution status

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
- Windows/Linux native engine parity expansion (capture/audio/export protocol coverage)
- Localization: add/refresh localized strings for all new UI and errors
- Post‑localization polish audit (UI/UX, performance, accessibility)

Progress (current repo)

- [x] Input Monitoring permission flow + event tracking
- [x] Auto-zoom planning + constraints (planner + renderer wiring + UI tuning)
- [ ] Background framing
- [ ] Vertical export with re-planned camera
- [ ] Windows native capture/audio/export parity milestones
- [ ] Linux native capture/audio/export parity milestones
- [ ] Localization updated for Phase 2 UI
- [ ] Post‑localization polish audit (UI/UX, performance, accessibility)

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
