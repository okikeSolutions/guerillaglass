# Hybrid Architecture (Electrobun + Native Engine)

## Overview

Guerillaglass now follows a hybrid multiplatform architecture:

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
- Renderer directory-picker flows (`open project`, `save as`, export target selection) treat host RPC timeout responses as recoverable interruptions and show workflow guidance instead of a sticky fatal error state.
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
- Date/number UI formatting is localized via controller-level wrappers (`Intl.DateTimeFormat`, `Intl.NumberFormat`) so components avoid ad-hoc formatting logic.
- Capture inspector includes source monitor and audio mixer surfaces (master + mic) for operational monitoring.
- Project utility rail includes a lightweight media-bin summary (recording/events asset readiness) alongside active metadata and recents.

## Supported Engine Methods (Phase 1 parity)

- `system.ping`
- `engine.capabilities`
- `permissions.get`
- `permissions.requestScreenRecording`
- `permissions.requestMicrophone`
- `permissions.requestInputMonitoring`
- `permissions.openInputMonitoringSettings`
- `sources.list`
- `capture.startDisplay`
- `capture.startWindow`
- `capture.stop`
- `recording.start`
- `recording.stop`
- `capture.status`
- `export.info`
- `export.run`
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
- `capture.startWindow.params.captureFps` (`24 | 30 | 60`, default `30`)

Capture FPS is independent from export preset FPS. Export cadence remains defined by the selected export preset.

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
