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

## Runtime Data Flow

1. Renderer calls `window.ggEngine*` functions.
2. Electrobun main process handles these using `webview.expose`.
3. Bun `EngineClient` sends JSON line requests to the Swift sidecar.
4. Swift sidecar dispatches methods to native APIs (`ScreenCaptureKit`, `AVFoundation`, Input Monitoring checks).
5. Response envelopes are validated in TypeScript with Zod before UI rendering.

## Supported Engine Methods (Phase 1 parity)

- `system.ping`
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

## Why This Split

- UI iteration speed and styling improve with React/Tailwind.
- Capture/audio/rendering stays native for quality and permissions correctness.
- Cross-platform shell is ready now while additional native engines can be added later.

## Testing

- Desktop protocol and bridge tests: `bun run desktop:test:coverage`
- Native engine stack: `Scripts/full_gate.sh`

## Future Platform Targets

- Evolve `engines/windows-native` and `engines/linux-native` from protocol-complete foundations into production capture/audio/export engines.
- Keep `.gglassproj` as the shared project contract across engines.
- Current scaffold stubs live in `engines/windows-stub` and `engines/linux-stub` for parallel UI/protocol work.
