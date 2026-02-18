# Spec.md — guerillglass (Open‑source “Screen Studio–style” Recorder with Hybrid Desktop Architecture)

## 1) Goal

Build an open-source recorder that uses a cross-platform desktop shell with a native macOS media engine and records:

- Entire display(s) or a single window (including iOS Simulator)
- Optional system audio + microphone
- Cursor + click metadata (when permitted)

…and exports “beautiful by default” videos using automatic motion design (auto-zoom, cursor smoothing, motion blur, background framing, and vertical exports).

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
- Cloud sync/collaboration
- Full NLE feature set
- Native Windows/Linux capture backends in v1

---

## 4) Platform & stack

- **Desktop shell:** Electrobun + React + Tailwind + shadcn base components
- **Protocol contract:** Zod (TypeScript) + Swift line-based wire codec + shared Rust protocol crate
- **Native engine baseline (v1):** macOS 13.0+
  - Stretch: validate whether **12.3+ video-only** support is feasible for engine-only paths.
- Native engine language: Swift
- **Development environment:** Cursor IDE + SweetPad (no Xcode project workflow).
- **Build system:** SwiftPM (`Package.swift` is the source of truth; no `.xcodeproj`).
- **App identity:**
  - Display name: **guerillaglass**
  - Bundle identifier: **com.okikeSolutions.guerillaglass**
- **Code quality tooling (no‑Xcode workflow):**
  - Formatter: **SwiftFormat** with a repo‑level `.swiftformat` config.
  - Linting: **SwiftLint** with `.swiftlint.yml` (editor plugin + CI checks).
  - Optional: **Periphery** for dead‑code detection in later phases.
  - Build logs: **xcbeautify** for readable CLI output.
  - LSP: **xcode-build-server** to support Cursor/SweetPad indexing.
- Native engine capture:
  - ScreenCaptureKit (video + system audio where supported)
  - AVFoundation (microphone capture, universally)
- Native engine encoding/muxing: AVFoundation
- Native engine rendering: Metal (preferred), Core Image acceptable for MVP

---

## 5) Capability matrix

| Capture mode    | Video (13+) |    System audio | Mic (AVF) | Cursor pos | Click events |
| --------------- | ----------: | --------------: | --------: | ---------: | -----------: |
| Display capture |         Yes |        13+ only |       Yes |   Optional |     Optional |
| Window capture  |         Yes | 13+ best-effort |       Yes |   Optional |     Optional |

Notes:

- System audio is only exposed when OS + source support it; UI must disable otherwise with explanation.
- Cursor/click tracking is optional and permission-gated; enabled by default with a toggle to disable.
- If 12.3+ video-only support is validated, expand matrix and gate by OS at runtime.

---

## 6) Product principles

- Beautiful defaults, minimal configuration
- Local-first and privacy-respecting
- Project-based workflow (record once → export many)
- Explicit determinism contract
- Native macOS feel (HIG-aligned) and top-tier performance

---

## 7) Functional requirements

### 7.1 Capture

- Display capture (single display v1)
- Window capture (including iOS Simulator)
- Capture at native display resolution; downscale only in preview/export.
- Audio:
  - Microphone via AVFoundation (all supported OS versions)
  - System/app audio via ScreenCaptureKit (macOS 13+ only)
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

### 7.6 Creator Studio shell guide (manual implementation + tracking)

This section operationalizes the non-dashboard contract into an implementation plan that can be shipped incrementally while preserving working capture, recording, project open/save, and export behavior.

Design baseline (from pro-tool patterns):

- Workflow-first shell: prioritize throughput and editing clarity over decorative UI chrome.
- Persistent workstation panes: top transport/status, left utility panel, center viewer, right inspector, bottom timeline.
- Contextual controls: inspector content changes by selection/mode; avoid showing unrelated settings by default.
- Keyboard-first operations: all core actions remain available without pointer dependency.
- Capture-first telemetry: record state, elapsed time, and health indicators stay visible while recording/editing.

Creator Studio implementation requirements:

- Top transport/status bar must always show:
  - record state
  - elapsed duration/timecode
  - quick actions (`record`, `play/pause`, `save`, `export`)
- Left panel provides session/source access (`sources`, `media`, optional `projects/recent`).
- Center viewer is the dominant stage; permission or diagnostics UI is supportive, not primary.
- Right inspector is contextual (`capture`, `effects`, `export`, `project`) and selection-aware.
- Bottom timeline is always present and treated as a first-class editing surface.
- Project lifecycle remains first-class in shell:
  - open existing project
  - save/save as
  - preserve project state for repeat exports

Creator Studio tracking checklist (current repo):

- [ ] Replace card-dashboard shell with contiguous editor panes
- [ ] Add explicit mode switch (`Capture`, `Edit`, `Deliver`) with stable navigation state
- [ ] Keep timeline permanently visible in primary layout across desktop breakpoints
- [ ] Convert timeline slider into lane-based timeline surface (video/audio/events tracks)
- [ ] Make inspector fully contextual to selection and mode
- [ ] Add project utility panel support for recent projects + active project metadata
- [ ] Add layout persistence (pane sizes/collapse/workspace restore)
- [ ] Add capture telemetry row (record state, duration, dropped frames, audio level, health)
- [x] Keep core shell actions wired to engine protocol (`record`, `open/save`, `export`)
- [x] Keep core keyboard shortcuts (`record`, `play/pause`, `trim in/out`, `save`, `export`)
- [x] Keep degraded-mode messaging visible near preview/recording context
- [ ] Complete accessibility pass for focus visibility, contrast, and reduced-motion behavior

Suggested rollout order:

1. Studio pane scaffold (no protocol changes)
2. Timeline lanes + contextual inspector behavior
3. Project utility panel + layout persistence
4. Capture telemetry expansion + final accessibility polish

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

---

## 11) Performance & quality targets (baseline: Apple Silicon M1/M2)

- Capture (1080p/60, 10 min):
  - Dropped frames ≤ 0.5%
  - Avg CPU ≤ 20% (excluding encode spikes)
- Export (1080p/60):
  - ≤ 1.5× realtime (target, not hard requirement)

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
│ ├─ CODEOWNERS
│ ├─ ISSUE_TEMPLATE/
│ └─ PULL_REQUEST_TEMPLATE.md
├─ docs/
│ └─ SPEC.md
├─ apps/
│ └─ desktop-electrobun/
│   ├─ src/
│   │ ├─ bun/
│   │ └─ mainview/
│   ├─ electrobun.config.ts
│   ├─ tailwind.config.js
│   └─ vite.config.ts
├─ packages/
│ └─ engine-protocol/
│   └─ src/
├─ engines/
│ ├─ macos-swift/
│ │ └─ modules/
│ │   ├─ capture/
│ │   ├─ inputTracking/
│ │   ├─ project/
│ │   ├─ automation/
│ │   ├─ rendering/
│ │   └─ export/
│ ├─ windows-native/
│ ├─ linux-native/
│ ├─ windows-stub/
│ ├─ linux-stub/
│ ├─ protocol-rust/
│ └─ protocol-swift/
└─ Tests/
├─ automationTests/
├─ projectMigrationTests/
└─ renderingDeterminismTests/

```

---

## 18) Phased delivery

**Phase 0 — Hybrid platform foundation**

- Electrobun desktop shell with React/Tailwind UI
- Typed protocol package shared across shell/runtime boundaries
- Native Swift sidecar engine process for capture permissions/source discovery

Progress (current repo)

- [x] Electrobun shell scaffolded
- [x] Zod protocol package added
- [x] Native Swift `guerillaglass-engine` target added

**Phase 1 — Recorder MVP**

- Display/window capture
- Mic audio (AVFoundation)
- Trim + export
- Project save/load + versioning (protocol-based open/save)
- Localization: keep desktop shell strings localizable
- Post‑localization polish audit (UI/UX, performance, accessibility)

Progress (current repo)

- [x] Display capture preview (ScreenCaptureKit)
- [x] Mic capture skeleton (permission + AVAudioEngine tap)
- [x] Window capture UI + preview
- [x] Trim + export
- [x] Project schema + store (save/load on disk)
- [x] Protocol-based project open/save flow in desktop shell
- [x] Desktop shell strings are centralized in the React surface
- [x] Post‑localization polish audit (UI/UX, performance, accessibility)
- [ ] Creator Studio shell alignment (tracked in §7.6)

**Phase 2 — Cinematic defaults**

- Input Monitoring–gated event tracking
- Auto-zoom planning + constraints
- Background framing
- Vertical export with re-planned camera
- Localization: add/refresh localized strings for all new UI and errors
- Post‑localization polish audit (UI/UX, performance, accessibility)

Progress (current repo)

- [x] Input Monitoring permission flow + event tracking
- [x] Auto-zoom planning + constraints (planner + renderer wiring + UI tuning)
- [ ] Background framing
- [ ] Vertical export with re-planned camera
- [ ] Localization updated for Phase 2 UI
- [ ] Post‑localization polish audit (UI/UX, performance, accessibility)

**Phase 3 — Polish**

- Motion blur controls
- Per-segment overrides
- Simulator auto-crop
- Optional ProRes mezzanine
- Localization: update strings for new controls, settings, and export options
- Post‑localization polish audit (UI/UX, performance, accessibility)

Progress (current repo)

- [ ] Motion blur controls
- [ ] Per-segment overrides
- [ ] Simulator auto-crop
- [ ] Optional ProRes mezzanine
- [ ] Localization updated for Phase 3 UI
- [ ] Post‑localization polish audit (UI/UX, performance, accessibility)

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

## 22) Verification sources (links)

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

```

This version incorporates all verified corrections (OS baselines, permissions precision, audio reality, determinism scope) while keeping the spec tight, testable, and build-oriented.
```
