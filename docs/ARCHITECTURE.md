# Hybrid Architecture (Electrobun + Native Engine)

## Overview

Guerilla Glass now follows a hybrid multiplatform architecture:

1. Desktop shell (`/apps/desktop-electrobun`)
   - Electrobun main process (`src/bun`)
   - React/Tailwind/shadcn UI (`src/mainview`)
2. Native engine (`/engines/macos-swift`)
   - Uses existing Swift capture/render/export modules
   - Exposed as `guerillaglass-engine` executable target
3. Protocol layer (`/packages/engine-protocol`)
   - Zod runtime schemas + TypeScript types
   - Wire contracts for request/response envelopes
4. Rust protocol layer (`/engines/protocol-rust`)
   - Shared Rust request/response envelope models
   - Shared monotonic clock primitive for timing-critical engines

North star:

- Cross-platform creator workflow parity (`Record -> Edit -> Deliver`)
- Native capture/audio/export quality per platform
- Shared protocol contract so shell UX stays consistent across engines

## Runtime Data Flow

1. Renderer calls `window.ggEngine*` functions.
2. Electrobun main process handles these via `BrowserView.defineRPC` request handlers.
3. Bun `EngineClient` sends JSON line requests to the Swift sidecar.
4. Swift sidecar dispatches methods to native APIs (`ScreenCaptureKit`, `AVFoundation`, Input Monitoring checks).
5. Response envelopes are validated in TypeScript with Zod before UI rendering.
6. Agent Mode jobs write structured artifacts into the active project package (`analysis/*.v1.json`) and expose status/artifact access via protocol methods.

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

## `capture.status` Telemetry Contract

`capture.status` includes transport-safe capture telemetry for the desktop telemetry row:

- `isRunning`, `isRecording`, `recordingDurationSeconds`, `recordingURL`, `lastError`, `eventsURL`
- `telemetry`:
  - `totalFrames`
  - `droppedFrames`
  - `droppedFramePercent`
  - `sourceDroppedFrames`
  - `sourceDroppedFramePercent`
  - `writerDroppedFrames`
  - `writerBackpressureDrops`
  - `writerDroppedFramePercent`
  - `achievedFps`
  - `audioLevelDbfs` (`null` when unavailable)
  - `health` (`good` | `warning` | `critical`)
  - `healthReason` (`engine_error` | `high_dropped_frame_rate` | `elevated_dropped_frame_rate` | `low_microphone_level` | `null`)

Health reasons are protocol codes, not user-facing copy. Renderer surfaces localize these codes per active locale.

Protocol compatibility policy for `capture.status`:

- Additive fields must be optional/derivable in the renderer.
- Renderer parsing defaults missing `telemetry` to a neutral payload so older engines do not break UI.
- Engines should emit explicit `null` for unavailable telemetry fields instead of omitting keys.

Capture start requests support runtime capture cadence selection:

- `capture.startDisplay.params.captureFps` (`24 | 30 | 60`, default `30`)
- `capture.startCurrentWindow.params.captureFps` (`24 | 30 | 60`, default `30`)
- `capture.startWindow.params.captureFps` (`24 | 30 | 60`, default `30`)

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
