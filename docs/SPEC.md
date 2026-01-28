# Spec.md — Open-source “Screen Studio–style” Recorder for macOS

## 1) Goal

Build an open-source macOS app that records:

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
- Cross-platform support

---

## 4) Platform & stack

- **macOS baseline (v1):** 13.0+
  - Stretch: validate whether **12.3+ video-only** support is feasible; keep runtime availability checks either way.
- Language/UI: Swift + SwiftUI
- Capture:
  - ScreenCaptureKit (video + system audio where supported)
  - AVFoundation (microphone capture, universally)
- Encoding/muxing: AVFoundation
- Rendering: Metal (preferred), Core Image acceptable for MVP

---

## 5) Capability matrix

| Capture mode    | Video (13+) |    System audio | Mic (AVF) | Cursor pos | Click events |
| --------------- | ----------: | --------------: | --------: | ---------: | -----------: |
| Display capture |        Yes |        13+ only |       Yes |   Optional |     Optional |
| Window capture  |        Yes | 13+ best-effort |       Yes |   Optional |     Optional |

Notes:

- System audio is only exposed when OS + source support it; UI must disable otherwise with explanation.
- Cursor/click tracking is optional and permission-gated.
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
- Audio:
  - Microphone via AVFoundation (all supported OS versions)
  - System/app audio via ScreenCaptureKit (macOS 13+ only)
- Optional event tracking:
  - Cursor positions (timestamped)
  - Mouse clicks (down/up, button, position)

### 7.2 Look & feel processing

- Auto-zoom virtual camera (offline planning)
- Cursor smoothing, scaling, click highlights
- Motion blur (camera + cursor only; no optical-flow blur)
- Background framing: padding, rounded corners, shadow
- Aspect-ratio exports: 16:9, 9:16 (camera path re-planned per ratio)

### 7.3 Basic editing (v1)

- Trim in/out
- Preview playback + scrubber

### 7.4 Export

- Presets:
  - 1080p 30fps H.264
  - 1080p 60fps H.264
  - 4K 30fps H.265
  - 1080×1920 30fps H.264
- Output: MP4 or MOV

---

## 8) Permissions & fallbacks

Required permissions:

1. Screen Recording (required to capture displays/windows; first-run prompt requires app restart)
2. Microphone (if enabled)
3. **Input Monitoring** (only if event tracking enabled)

Optional / future:

- **Accessibility** (only if AX-based automation or UI inspection is added)

Fallback behavior:

- If Input Monitoring denied:
  - Recording continues
  - Auto-zoom triggers and click highlights disabled
  - UI clearly indicates degraded automation mode

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
- Safe margin: 8–12% frame
- Dwell threshold: cursor speed < V for ≥ 350 ms
- Max pan speed & acceleration capped (“no nausea” rule)
- If no events: mild center framing only

---

## 15) Project format & versioning

Project directory:

- `project.json` (includes `projectVersion`)
- `recording.mov`
- `audio_system.m4a` (optional)
- `audio_mic.m4a` (optional)
- `events.json` (optional)

Versioning policy:

- Always migrate forward on load
- Never write older schema versions

---

## 16) Architecture modules

1. Capture Engine
2. Event Tracker (permission-gated)
3. Project Store (schema + migrations)
4. Automation Planner (virtual camera)
5. Renderer / Compositor
6. Export Pipeline
7. Diagnostics (performance + frame drops)

---

## 17) Project structure (proposed)
```

screenstudio-oss/
├─ README.md
├─ LICENSE
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
├─ app/
│ ├─ ScreenStudioApp.swift
│ ├─ AppDelegate.swift
│ ├─ Info.plist
│ └─ Entitlements.entitlements
├─ ui/
│ ├─ RootView.swift
│ ├─ Capture/
│ ├─ Library/
│ ├─ Editor/
│ └─ Components/
├─ capture/
│ ├─ CaptureEngine.swift
│ ├─ DisplayCapture.swift
│ ├─ WindowCapture.swift
│ ├─ AudioCapture.swift
│ └─ CaptureClock.swift
├─ inputTracking/
│ ├─ InputPermissionManager.swift
│ ├─ CursorTracker.swift
│ └─ ClickTracker.swift
├─ project/
│ ├─ Project.swift
│ ├─ ProjectStore.swift
│ ├─ ProjectMigration.swift
│ └─ Schema/
├─ automation/
│ ├─ VirtualCameraPlanner.swift
│ ├─ AttentionModel.swift
│ └─ ZoomConstraints.swift
├─ rendering/
│ ├─ PreviewRenderer.swift
│ ├─ ExportRenderer.swift
│ └─ Metal/
├─ export/
│ ├─ ExportPipeline.swift
│ ├─ Presets.swift
│ └─ AssetWriter.swift
├─ diagnostics/
│ └─ PerformanceMetrics.swift
└─ Tests/
├─ AutomationTests/
├─ ProjectMigrationTests/
└─ RenderingDeterminismTests/

```

---

## 18) Phased delivery
**Phase 1 — Recorder MVP**
- Display/window capture
- Mic audio (AVFoundation)
- Trim + export
- Project save/load + versioning

**Phase 2 — Cinematic defaults**
- Input Monitoring–gated event tracking
- Auto-zoom planning + constraints
- Background framing
- Vertical export with re-planned camera

**Phase 3 — Polish**
- Motion blur controls
- Per-segment overrides
- Simulator auto-crop
- Optional ProRes mezzanine

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

---

## 21) Human Interface Guidelines (HIG) & native feel

- Follow Apple’s Human Interface Guidelines for macOS layout, navigation patterns, and control behavior.
- Use **system typography (SF)**, standard controls, and native menus/shortcuts.
- Respect system preferences: Reduce Motion, Increase Contrast, Reduce Transparency.
- Adopt macOS windowing patterns: toolbar/inspector split, sidebar list, document-based workflow.
- Accessibility baseline: VoiceOver labels, keyboard navigation, focus order, high-contrast checks.

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
```

This version incorporates all verified corrections (OS baselines, permissions precision, audio reality, determinism scope) while keeping the spec tight, testable, and build-oriented.
