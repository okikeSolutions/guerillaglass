# Independent correctness review, round 4

Reviewed on 2026-11-09.

- Baseline: `45245daf360d0bd352f28da39b5ddec6978931c1`.
- Frozen HEAD: `a7c53575a1cbcc253e5be1d3446ec7e2cb17d8e8`.
- Comparison: `git diff 45245daf360d0bd352f28da39b5ddec6978931c1...a7c53575a1cbcc253e5be1d3446ec7e2cb17d8e8`.
- Overall rating: **9.6/10**.
- Strict individual gate: **PASS**, because 9.6 is strictly greater than 9.5. This is my independent overall assessment of this frozen change. It is not an average, a rounded score or approval based on another reviewer's score.

I found no actionable correctness regression in the reviewed change. There are no P0, P1 or P2 findings to reproduce or fix from this review. The remaining checks below limit release confidence; they are not presented as demonstrated product defects.

The last round's draft-loss defect is corrected. `apps/desktop-electrobun/src/mainview/app/studio/hooks/timeline/useEditorDocumentHistory.ts:45` now reconciles generated-source updates through `rebaseGeneratedTimeline`. In `domain/editorDocumentHistory.ts:34`, only snapshots whose timeline still matches the previous generated baseline adopt the refined timeline. Edited snapshots, visual settings and both history directions retain their content. Native defaults arriving before the first Save no longer become a replacement document. The controller regression at `tests/ui/editor-export-timeline.browser.test.tsx:2151` starts and stops a mocked native take, cuts it, refreshes native defaults, then checks export, Undo/Redo and Save.

The stale inspector defect is also corrected. `domain/inspectorSelectionModel.ts:68` resolves a selected clip against the current lane, updates its timing and returns to project controls when its ID is absent. The controller supplies current lanes. The rendered tests at `tests/ui/editor-export-timeline.browser.test.tsx:2226` and `:2248` exercise removal of a selected split scene and a surviving scene whose program timing changes through Undo/Redo. The retained native `docs/evidence/ui-pass/undo-selection.png` shows the project inspector and Saved state after Undo, with the original three scenes restored.

I reviewed the complete 184-file change inventory and its production paths, rather than limiting the pass to those two fixes. This included document identity, dirty state, bounded history, visual gesture grouping, external proposal adoption and Save As rebasing; recording start/stop, duplicate starts and failed reconciliation; Open/Recent cancellation and committed replacement; selection after timeline operations; program/source time mapping, gap playback, seeking, EOF replay and stale play requests; camera/framing composition, preview audio, isolated proposal playback, decoded audio presentation and thumbnails; full and selected-range export validation and result actions.

The host/native pass covered typed bridge changes, disposal envelopes, native picker arguments and scoped child-process cleanup, host-owned completed export paths, exact custom-scheme CORS acceptance after token authorization, quit confirmation and cleanup, native recording session retirement, reopened-project asset copying, in-place preservation and missing-sidecar failure. The web/shared pass covered public rendering without hosted auth, optional Convex configuration, request-scoped localization, appearance changes, modal navigation, FAQ/recovery routes, shared dialog labels and localized copy. No wire-contract or generated binding change is present.

I read the root and nearest desktop/web/native AGENTS instructions, `REVIEW.md`, verification selection, the 40-finding ledger, 89-module inventory, improvement research and implementation evidence. I applied unslop. Historical round-3 findings were used to check the fixes. I did not read peer round-4 reports.

Retained evidence checked:

- `round4-acceptance.log` records 118 browser tests across 10 files, followed by a successful packaged runtime smoke with process cleanup and zero fatal-pattern matches.
- `round4-browser.log` records 63 controller/browser cases; `round4-unit.log` records 11 history/selection model tests. These overlap acceptance and are not additional unique totals.
- `unit-final.log` records 159 earlier focused tests across 27 files. `swift-save-as-final.log` records six ProjectStore and six EngineProjectSave tests, including source removal after Save As. `swift-fast.log` records a successful engine build.
- `web-tests.log` records eight tests across three files; `web-build.log` records the production build. Current round-4 typecheck, lint, repository, documentation and formatting logs support their reported successful checks. Typecheck suggestions are informational.
- I visually inspected the retained packaged Undo-selection and small-window Deliver screenshots. I also checked the native console; its source-list failures are explicit Screen Recording permission denials, consistent with the stated native limit.

I independently ran `git diff --check` for the literal frozen range successfully. A lightweight Bun probe imported the production history and inspector functions and confirmed that generated-duration refinement retains edited content and Undo/Redo, current selection timing comes from current lanes, and a missing selected ID returns no selection. No browser or application was launched, no heavy suite was rerun, no subagent was spawned and no product file was edited. Only this report was written.

Granted native capture, audible native audio and sidecars, rendered vertical-file comparison, the broader native high-zoom/pane matrix and VoiceOver remain unclaimed. Full CI and Windows/Linux verification still belong before merge. The eventual PR must attach rendered packaged-app screenshots directly, and the zero-unresolved-review-thread merge gate still applies. This review does not mark ledger findings Verified or complete the later Phase 2 accessibility/performance release gate.

The rating reflects the absence of a concrete remaining regression after the full-range source review, focused independent probes and retained cross-layer evidence. It leaves room for the explicitly unperformed release checks.
