# Agent instructions — Guerilla Glass

This project is an open-source macOS app that records displays/windows (including iOS Simulator) with optional system audio and microphone, plus cursor/click metadata when permitted, and exports “beautiful by default” videos with automatic motion design (auto-zoom, cursor smoothing, motion blur, background framing, vertical exports).

**Full product and technical spec:** `docs/SPEC.md`

---

## Platform & stack

- **macOS baseline (v1):** 13.0+ (stretch: validate 12.3+ video-only)
- **Language/UI:** Swift + SwiftUI
- **Capture:** ScreenCaptureKit (video + system audio where supported), AVFoundation (microphone)
- **Encoding/muxing:** AVFoundation
- **Rendering:** Metal preferred, Core Image acceptable for MVP

---

## Architecture modules

1. **Capture** — CaptureEngine, DisplayCapture, WindowCapture, AudioCapture, CaptureClock
2. **InputTracking** — InputPermissionManager, CursorTracker, ClickTracker (permission-gated)
3. **Project** — Project, ProjectStore, ProjectMigration, Schema
4. **Automation** — VirtualCameraPlanner, AttentionModel, ZoomConstraints
5. **Rendering** — PreviewRenderer, ExportRenderer, Metal
6. **Export** — ExportPipeline, Presets, AssetWriter
7. **Diagnostics** — PerformanceMetrics

---

## Project structure (from spec)

Code lives under `app/`, `ui/`, `capture/`, `inputTracking/`, `project/`, `automation/`, `rendering/`, `export/`, `diagnostics/`. Tests under `Tests/` with subdirs `automationTests/`, `projectMigrationTests/`, `renderingDeterminismTests/`. See `docs/SPEC.md` §17 for the full tree.

---

## Conventions to follow

- **Native macOS:** Follow Apple HIG; system typography (SF), standard controls, document-based workflow. Respect Reduce Motion, Increase Contrast, Reduce Transparency.
- **Determinism:** Pre-encode frame buffers must be deterministic (same project + version + settings + hardware class ⇒ pixel-identical frames). Encoding bytes are not guaranteed identical. Tests hash pre-encode frames.
- **Permissions:** Screen Recording required; Microphone and Input Monitoring only when those features are enabled. If Input Monitoring is denied, recording continues but auto-zoom/click highlights are disabled—UI must show degraded mode clearly.
- **Versioning:** Project schema always migrates forward on load; never write older schema versions.
- **Mezzanine (v1):** H.264 mezzanine, high bitrate, short GOP / frequent keyframes.

---

## Phased delivery context

- **Phase 1:** Display/window capture, mic audio, trim + export, project save/load + versioning.
- **Phase 2:** Input Monitoring–gated event tracking, auto-zoom, background framing, vertical export with re-planned camera.
- **Phase 3:** Motion blur controls, per-segment overrides, Simulator auto-crop, optional ProRes mezzanine.

When adding features, align with the current phase and the capability matrix in the spec (§5).

---

## Testing & quality

- Determinism validated by hashing pre-encode frames; update rendering determinism tests when changing the pipeline.
- Baseline targets (Apple Silicon M1/M2): capture dropped frames ≤ 0.5%, avg CPU ≤ 20%; export ≤ 1.5× realtime for 1080p/60.
- Tag issues/PRs appropriately: `bug`, `feature`, `good first issue`, `help wanted`, `design`, `performance`.

---

## References

- **Spec:** `docs/SPEC.md` — source of truth for requirements, project format, auto-zoom constraints, presets, and verification links.
- **Licensing:** MIT or Apache-2.0 (see spec §19); third-party in `THIRD_PARTY_NOTICES.md`.
