# Repository Guidelines

- **Spec:** `docs/SPEC.md` — source of truth for product, architecture, project format, and verification links.
- **Licensing:** MIT or Apache-2.0 (see spec §19); third-party in `THIRD_PARTY_NOTICES.md`.
- GitHub issues/comments/PR comments: use literal multiline strings or `-F - <<'EOF'` (or `$'...'`) for real newlines; never embed `"\\n"`.

---

## Project Structure & Module Organization

- **Desktop shell (new):** `apps/desktop-electrobun/` — Electrobun main process, React/Tailwind UI, shadcn base components.
- **Desktop shell bridge:** `apps/desktop-electrobun/src/bun/` — Electrobun `BrowserWindow` setup and native engine bridge.
- **Desktop shell UI:** `apps/desktop-electrobun/src/mainview/` — React app (`App.tsx`), UI components, styling.
- **Protocol (new):** `packages/engine-protocol/` — Zod schemas + TypeScript types for engine requests/responses.
- **Native engine (new):** `engines/macos-swift/` — Swift sidecar executable target (`guerillaglass-engine`).
- **Platform stub engines:** `engines/windows-stub/`, `engines/linux-stub/` — protocol-compatible stubs for parallel engine work.
- **Swift protocol module (new):** `engines/protocol-swift/` — wire codec and typed message envelope models.
- **Capture:** `capture/` — CaptureEngine, DisplayCapture, WindowCapture, AudioCapture, CaptureClock.
- **Input tracking:** `inputTracking/` — InputPermissionManager, CursorTracker, ClickTracker (permission-gated).
- **Project:** `project/` — Project, ProjectStore, ProjectMigration, Schema.
- **Automation:** `automation/` — VirtualCameraPlanner, AttentionModel, ZoomConstraints.
- **Rendering:** `rendering/` — PreviewRenderer, ExportRenderer, Metal.
- **Export:** `export/` — ExportPipeline, Presets, AssetWriter, TrimRangeCalculator.
- **Tests:** `Tests/` — `automationTests/`, `captureTests/`, `engineProtocolTests/`, `exportTests/`, `projectMigrationTests/`, `renderingDeterminismTests/`.
- **Scripts:** `Scripts/` — `full_gate.sh`.
- **Docs:** `docs/` — SPEC and other project docs.

When adding modules or moving code, keep the spec’s architecture (§16–17) and update `AGENTS.md` / `docs/SPEC.md` if the tree changes.

---

## Build, Test, and Development Commands

- **Full gate (format, lint, test, build):** `Scripts/full_gate.sh`  
  Runs: SwiftFormat → SwiftLint → `swift test` → `swift build`. Use this to verify the project after changes.
- **Desktop deps (workspace):** `bun install`
- **Desktop shell dev:** `bun run desktop:dev`
- **Desktop shell dev with HMR:** `bun run desktop:dev:hmr`
- **Desktop shell (Windows stub):** `bun run desktop:dev:windows-stub`
- **Desktop shell (Linux stub):** `bun run desktop:dev:linux-stub`
- **Desktop shell test:** `bun run desktop:test`
- **Desktop shell coverage:** `bun run desktop:test:coverage`
- **Build:** `swift build`
- **Test:** `swift test`
- **Format:** `swiftformat .` (config: `.swiftformat`)
- **Lint:** `swiftlint` (config: `.swiftlint.yml`)

---

## Agent Task Verification

**After every task completed, run `Scripts/full_gate.sh` to verify that what the agent built is actually working.**

Do not consider a task done until the full gate passes. If it fails, fix the issues (format, lint, tests, or build) and run the gate again before reporting completion.

---

## Platform & Stack

- **macOS baseline (v1):** 13.0+ (stretch: validate 12.3+ video-only).
- **Desktop shell:** Electrobun + React + Tailwind + shadcn base components.
- **Native media engine:** Swift.
- **Protocol:** Zod (TypeScript) + Swift wire codec.
- **Capture:** ScreenCaptureKit (video + system audio where supported), AVFoundation (microphone).
- **Encoding/muxing:** AVFoundation.
- **Rendering:** Metal preferred, Core Image acceptable for MVP.

---

## Conventions to Follow

- **Native macOS:** Follow Apple HIG; system typography (SF), standard controls, document-based workflow. Respect Reduce Motion, Increase Contrast, Reduce Transparency.
- **Determinism:** Pre-encode frame buffers must be deterministic (same project + version + settings + hardware class ⇒ pixel-identical frames). Encoding bytes are not guaranteed identical. Tests hash pre-encode frames; update rendering determinism tests when changing the pipeline.
- **Permissions:** Screen Recording required; Microphone and Input Monitoring only when those features are enabled. If Input Monitoring is denied, recording continues but auto-zoom/click highlights are disabled—UI must show degraded mode clearly.
- **Versioning:** Project schema always migrates forward on load; never write older schema versions.
- **Mezzanine (v1):** H.264 mezzanine, high bitrate, short GOP / frequent keyframes.

---

## Phased Delivery Context

- **Phase 1:** Display/window capture, mic audio, trim + export, project save/load + versioning.
- **Phase 2:** Input Monitoring–gated event tracking, auto-zoom, background framing, vertical export with re-planned camera.
- **Phase 3:** Motion blur controls, per-segment overrides, Simulator auto-crop, optional ProRes mezzanine.

When adding features, align with the current phase and the capability matrix in the spec (§5).

---

## Testing Guidelines

- Determinism validated by hashing pre-encode frames; update `Tests/renderingDeterminismTests/` when changing the pipeline.
- Baseline targets (Apple Silicon M1/M2): capture dropped frames ≤ 0.5%, avg CPU ≤ 20%; export ≤ 1.5× realtime for 1080p/60.
- Tag issues/PRs appropriately: `bug`, `feature`, `good first issue`, `help wanted`, `design`, `performance`.
- Run `Scripts/full_gate.sh` before pushing when you touch Swift logic; CI runs the same gate (see `.github/workflows/full_gate.yml`).
- Run `bun run desktop:test:coverage` when touching `apps/desktop-electrobun` or `packages/engine-protocol`.
- Pure test additions/fixes generally do **not** need a changelog entry unless they alter user-facing behavior.

---

## Commit & Pull Request Guidelines

- Prefer concise, action-oriented commit messages (e.g. `Capture: add keyframe interval to mezzanine`, `UI: respect Reduce Motion in preview`).
- Group related changes; avoid bundling unrelated refactors.
- PRs should summarize scope, note testing performed (including full gate), and mention any user-facing changes.
- Before merging: run `Scripts/full_gate.sh` locally; ensure CI passes.
- Changelog: keep latest released version at top; add entries for user-facing changes and reference issues/PRs as in `CONTRIBUTING.md`.

---

## Agent-Specific Notes

- **Vocabulary:** “Guerilla Glass” / “Guerillaglass” for the product; `guerillaglass` for bundle/binary/paths as used in the project.
- Never edit generated or vendored artifacts outside the documented workflows; prefer project scripts and configs.
- When working on a GitHub Issue or PR, print the full URL at the end of the task.
- When answering questions, respond with high-confidence answers only; verify in code when possible.
- **Full gate:** After every completed task, run `Scripts/full_gate.sh` to verify the build and tests; do not report task completion until the gate passes.
- Lint/format churn: if changes are formatting-only, auto-resolve without asking; only ask when changes are semantic (logic/data/behavior).
- Focus reports on your edits; when multiple agents touch the same area, continue if safe and note “other files present” only if relevant.
- Bug investigations: read relevant source and dependencies before concluding; aim for high-confidence root cause.
- Do not change version numbers or release artifacts without explicit approval; see `CONTRIBUTING.md` and the spec for release steps.
