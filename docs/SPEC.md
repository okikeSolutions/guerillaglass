# Spec.md — Guerilla Glass (Open-source Local-First Creator Studio)

## 1) Goal

Build an open-source, cross-platform, local-first creator studio that helps users move from capture to polished delivery quickly.

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

- Fast record entry and reliable source/audio control
- Viewer/timeline/inspector-first editing ergonomics (Final Cut/Resolve-style workstation flow)
- Automatic polish with manual override (Screen Studio-style cinematic defaults)
- A local-first `record -> shape -> export` workflow where the recorder is useful on its own and the editor is the product’s center of gravity
- A hosted review/collaboration workflow in `Deliver` that extends the local product for teams without gating local capture, edit, or export

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
- Full cloud review/collaboration suite
- Subscription-gated local recording/editing core
- Generic team workspace before the local editor is compelling
- Full NLE feature set

---

## 4) Platform & stack

- **Desktop shell:** Electrobun + React + Tailwind + shadcn base components
- **Web app shell:** TanStack Start + Convex (`apps/web`) for marketing/auth/review/billing surfaces; sequenced behind the editor-core work
- **Protocol contract:** Effect Schema (TypeScript) + Swift line-based wire codec + shared Rust protocol crate
  - `capture.status` telemetry is performance-first and includes `sourceDroppedFrames`, `writerDroppedFrames`, `writerBackpressureDrops`, `achievedFps`, `cpuPercent`, `memoryBytes`, `recordingBitrateMbps`, `captureCallbackMs`, `recordQueueLagMs`, and `writerAppendMs`.
  - Runtime telemetry diagnostics are engine-owned and sampled from monotonic process/runtime counters (no renderer-side metric synthesis).
  - Desktop shell delivers high-frequency capture telemetry via host push stream (`hostCaptureStatus` / `gg-host-capture-status`) rather than renderer timer polling.
  - `capture.startDisplay`, `capture.startCurrentWindow`, and `capture.startWindow` accept `captureFps` (`24 | 30 | 60 | 120`, default `30`) and this is decoupled from export preset FPS.
  - `capture.startCurrentWindow` resolves the active frontmost shareable window in the engine, so renderer menu actions do not have to infer "current" from cached source ordering.
  - `capture.status` includes `captureMetadata` (with optional window identity for window captures) so shell status surfaces can reflect the active source from engine state rather than only form intent.
  - Hardware verification runs through `bun run capture:benchmark`, which exercises native display/window capture at 60 and 120 fps and writes JSON/Markdown reports under `.tmp/capture-benchmarks/`.
- **Shared contract primitives:** reusable Effect Schema helpers that must stay aligned across protocol packages live in `packages/schema-primitives`.
- **Hosted delivery plane (deferred until editor core is strong):**
  - Hosted review/collaboration lives in web/Convex surfaces and must remain downstream of the local editor.
  - The hosted plane can own share links, comments, presence, workflow state, analytics, and billing without polluting the local media contract.
- **Contract split:** local media RPC stays focused on capture/edit/export determinism; hosted review/collaboration uses separate contracts and backend surfaces.
- **Authentication stack (for hosted surfaces):**
  - Better Auth + Convex is the intended identity stack when hosted review/collaboration becomes a release-defining milestone.
  - Authentication must not be required for local capture, edit, or export.
- **Billing and entitlement stack (for hosted surfaces):**
  - Billing applies only to hosted review/collaboration capabilities, not the local recorder/editor core.
  - The local creator core remains available regardless of billing state.
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
- Capture polish and editing depth before collaboration surfaces
- Cross-platform parity via a shared protocol contract
- Explicit determinism contract
- Native-feeling UX per platform (HIG/OS conventions) and top-tier performance
- Dual-plane architecture: local media plane (authoritative) + hosted delivery/review plane
- Hosted review must fail open; local capture/edit/export remain available offline
- Account-scoped collaboration for hosted workflows
- Commercial model: local-first creator core plus paid hosted review/collaboration

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

### 7.3 Polished demo editing core

- Live preview during capture and edit; recording should not collapse to placeholder-only state while active.
- Preview playback + scrubber + playback speed control
- In `Edit`, the media element is the playback clock authority; transport/timeline state mirrors media play/pause/time events to avoid dual-clock drift.
- Media source/waveform hydration should follow query-driven loading/caching flows instead of effect-chained state updates.
- A true clip-based timeline model, not only global trim state:
  - split/blade
  - delete/lift
  - reorder/move
  - ripple-aware edits
- Timeline tool discipline (`Select` / `Trim` / `Blade`) with snap/ripple toggles
- Timeline zoom controls and per-lane lock/mute/solo controls
- Editable polish controls:
  - auto-zoom/camera keyframes with manual override
  - cursor smoothing and click emphasis
  - crop/reframe/redaction/highlight treatments for demos
  - background framing and aspect-ratio-aware composition
- Transcript/caption support:
  - importable transcript baseline
  - caption editing/export hooks as the editor matures

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
- User-customizable shortcuts are part of the workstation contract, not a debug convenience.
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
- Keyboard and shortcut policy:
  - Ship with platform-appropriate default shortcuts for record/playback/project/export actions.
  - Maintain one canonical shortcut registry shared by renderer hotkeys, tooltip hints, and native menu accelerators.
  - Allow per-user keybinding overrides for non-text-entry contexts.
  - Validate conflicts and scope rules before accepting custom bindings; unsafe or ambiguous bindings must be rejected with guidance.
  - Preserve expected platform conventions unless the user explicitly overrides them.

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

Workspace UX requirements:

- Agent Mode is project-scoped and must feel like a workstation assistant inside Creator Studio, not a separate dashboard product.
- Agent preflight readiness, blocking reasons, and the latest run/apply state must be visible from the desktop workspace without opening debug-only views.
- Proposed cut plans and apply intent must be surfaced as first-class reviewable UI objects with explicit user confirmation paths for destructive actions.
- Structured approvals and user-input requests should render inline in the active workspace flow instead of generic modal-only interruptions.
- Agent artifacts (`run-summary`, QA report, cut plan) must be inspectable from the project context so users can understand what will be changed before apply/export.
- Agent interactions must not displace the core preview/timeline/inspector workflow; they augment the editing surface rather than replacing it.

Artifact contract (project-relative paths):

- `analysis/transcript.full.v1.json`
- `analysis/transcript.words.v1.json`
- `analysis/beat-map.v1.json`
- `analysis/qa-report.v1.json`
- `analysis/cut-plan.v1.json`
- `analysis/run-summary.v1.json`

### 7.8 Deliver, packaging, and hosted review

Goal:

- Make `Deliver` feel like the final polish/export surface for demos, and the eventual hosted review/collaboration surface for teams.

Scope:

- Export presets and aspect-ratio-aware packaging remain first-class.
- Delivery metadata can grow to include lightweight packaging features such as chapters, titles, and end-card treatments, but these must not displace the local editor core.
- Hosted review/collaboration can grow to include link sharing, comments, presence, workflow state, and analytics for delivery workflows.
- Hosted review/collaboration is explicitly secondary to the local `Capture -> Edit -> Deliver` workflow and must never gate local recording, editing, or deterministic export.

Hard boundaries:

- Network services are not allowed to gate `Capture`, `Edit`, or deterministic `Export`.
- Native engine protocol remains focused on local media compute and project determinism.
- Delivery metadata is additive metadata, not the source of truth for timeline edits or render determinism.

Sequencing:

- The editor core is the immediate execution priority.
- Hosted review/collaboration remains part of the product vision, but it should not outrun the local editor in roadmap priority.

### 7.9 Hosted account model and commercialization

- Hosted review/collaboration must be tied to authenticated user or organization identity.
- The intended commercial model is:
  - local recorder/editor core that stands on its own
  - paid recurring hosted review/collaboration features for teams
- Billing, auth, and hosted permissions must apply only to the hosted plane and must never degrade the local core product promise.

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
- Hosted review and delivery metadata do not participate in render determinism; determinism scope remains local pre-encode frame output.

---

## 11) Performance & quality targets (baseline: Apple Silicon M1/M2)

- Capture (1080p/60, 10 min):
  - Dropped frames ≤ 0.5%
  - Avg CPU ≤ 20% (excluding encode spikes)
- Export (1080p/60):
  - ≤ 1.5× realtime (target, not hard requirement)
- Delivery workflow (target values):
  - Route transitions between `Capture`, `Edit`, and `Deliver` remain interactive without blocking on media hydration.
  - Export setup should stay responsive while preview/timeline state is active.
  - Packaging metadata must never introduce drift between previewed and exported local output.
  - Any hosted review surfaces must degrade without interrupting local export.

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
9. Hosted delivery plane (review, comments, share, presence, analytics, auth, billing), sequenced behind the local editor core

Desktop shell and sidecar reliability contract (current):

- Engine transport errors are typed and surfaced explicitly (unavailable, timeout, sidecar exit/failure, circuit-open).
- Request timeout policy is method-specific; `export.run` is non-timed by default to avoid aborting valid long exports.
- Automatic retries are limited to read-only methods and transport failures.
- Repeated crash loops open a restart circuit for a cooldown window before restart attempts resume.
- Any hosted delivery-plane failure must degrade to local-only workflow (no capture/edit/export interruption).

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
│  └─ web/
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
│  ├─ schema-primitives/
│  │  └─ src/
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

**Phase 1 — Capture/export baseline**

- Production-grade macOS capture/export path
- Display/window capture
- Mic audio
- Trim + export
- Project save/load + versioning (protocol-based open/save)
- Creator Studio editor-first shell baseline (`Capture`/`Edit`/`Deliver`)
- Localization: keep desktop shell strings localizable
- Post‑localization polish audit (UI/UX, performance, accessibility)

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

Detailed phase task lists and completion status are tracked in `docs/ROADMAP.md`.

---

## 19) Release engineering & distribution

Release policy:

- Desktop distribution is a first-class product requirement, not a post-MVP packaging task.
- Release automation must rerun quality gates before packaging or publishing any desktop artifacts.
- Tagged releases should produce a consistent cross-platform artifact set with explicit prerelease vs latest semantics.
- Release engineering must preserve the local-first product promise: packaged builds, updater metadata, and signing flows must not weaken offline capture/edit/export behavior.

Required release workflow baseline:

- CI preflight job:
  - reruns the canonical quality gates used for day-to-day verification
  - blocks packaging/publishing on any failure
- Desktop packaging workflow:
  - builds platform-specific desktop artifacts from a tagged revision
  - stages only the dependencies and assets required for production packaging
  - validates artifact metadata needed by the chosen update/distribution mechanism
- Release smoke validation:
  - verifies version propagation and packaging metadata before public publish
  - includes a packaged-app startup smoke path in CI where feasible
- Manual validation checklist:
  - install/open packaged app on each supported desktop OS target
  - verify project open/save/export basics
  - verify updater metadata presence and signing/notarization status when enabled

Distribution and update constraints:

- Update behavior must be explicit and user-controlled; background availability checks are acceptable, but automatic destructive install flows are not required for v1.
- Signing/notarization configuration must be isolated from unsigned dev/test builds so dry-run packaging remains possible.
- Release docs must describe:
  - tag format and release trigger conditions
  - required secrets for signing/notarization
  - expected artifact set per platform
  - smoke-test procedure for shipped builds

---

## 20) Licensing

- Code: choose **MIT** or **Apache-2.0** and document the rationale.
- Assets: license-compatible or optional download; all assets must have explicit licenses.
- Third-party dependencies: list in `THIRD_PARTY_NOTICES.md` (or `NOTICE` if Apache-2.0).

---

## 21) Open-source readiness & contribution setup

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

## 22) Human Interface Guidelines (HIG) & native feel

- Follow platform HIG principles for desktop layout, navigation patterns, and control behavior.
- Keep navigation and primary actions discoverable in the shell (keyboard-first paths for start/stop record, export, and project save/open).
- Preserve accessibility defaults across platforms (focus order, readable contrast, reduced-motion behavior when available).
- Prefer clear status surfaces for capture/record/export state over hidden modal-only feedback.

---

## 23) Localization & internationalization

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

## 24) Verification sources (links)

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
- Convex TanStack Start quickstart — https://docs.convex.dev/quickstart/tanstack-start
- Convex authentication docs — https://docs.convex.dev/auth
- Convex Labs Better Auth React guide — https://labs.convex.dev/better-auth/framework-guides/react
- Screen Studio product site — https://screen.studio/
- lawn pricing/product site — https://lawn.video/#pricing
- DaVinci Resolve product page — https://www.blackmagicdesign.com/products/davinciresolve
- Final Cut Pro user guide (interface/workflow) — https://support.apple.com/guide/final-cut-pro/final-cut-pro-interface-ver92bd100a/mac
- OBS knowledge base (sources/workflow) — https://obsproject.com/kb/sources-guide

```

This version incorporates all verified corrections (OS baselines, permissions precision, audio reality, determinism scope) while keeping the spec tight, testable, and build-oriented.
```
