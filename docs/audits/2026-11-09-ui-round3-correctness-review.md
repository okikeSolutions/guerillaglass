# Independent correctness review, round 3

Reviewed 2026-11-09.

- Frozen HEAD: `7adcc9b07cf1d5691aa68941f41b01d341d244c5`.
- Baseline: `45245daf360d0bd352f28da39b5ddec6978931c1`.
- Reviewed range: literal `git diff 45245daf360d0bd352f28da39b5ddec6978931c1...7adcc9b07cf1d5691aa68941f41b01d341d244c5`.
- Overall readiness rating: **9.3/10**.
- Strictly greater than 9.5/10: **FAIL**.

This is an independent assessment of the complete change. I did not read another reviewer's round 3 report or obtain their rating. The score reflects the remaining draft-loss defect below; earlier scores and the requested threshold did not determine it.

## P1: Refresh before the first save can erase timeline edits and their undo history

Primary location: `apps/desktop-electrobun/src/mainview/app/studio/hooks/timeline/useEditorDocumentHistory.ts:49-50`.

Related locations:

- `apps/desktop-electrobun/src/mainview/app/studio/hooks/core/useStudioController.ts:424-431` marks the document as generated whenever the native project timeline is empty, including after the user has edited its renderer draft.
- `apps/desktop-electrobun/src/mainview/app/studio/hooks/core/useStudioMutations.ts:560-565` overlays configured visual settings on the native project's query-cache snapshot after recording transitions.
- `apps/desktop-electrobun/src/mainview/app/studio/hooks/core/useStudioMutations.ts:381-389` refetches the native project without that overlay during View > Refresh.
- `engines/macos-swift/EngineService+CaptureRecording.swift:146-150` creates the new native document with default visual settings after recording starts. Those settings are not persisted from the renderer until Save.

Reproduction established by the current source and a deterministic hook probe:

1. Start with no project, turn Auto zoom off, then record and stop a take. The renderer intentionally preserves this setup, while the new native document still has its default Auto zoom value and an empty persisted timeline.
2. In Edit, split, lift or shorten the generated full-source timeline. Leave the project unsaved.
3. Choose View > Refresh. The project query receives the native default Auto zoom value. Project identity and source remain unchanged, but the baseline document signature changes.
4. The `generatedTimeline` branch replaces the draft timeline with the generated full source and constructs an empty history. The cuts disappear and Undo cannot recover them. Draft visual settings survive, which makes this particularly easy to miss.

The branch treats any baseline signature change as permission to regenerate the timeline. That signature includes visual settings, so the timeline need not have changed at all. Source-duration refinement takes the same branch if media metadata supplies a different duration after editing starts.

I executed the current transpiled `useEditorDocumentHistory` body with the real history/signature helpers, stable hook-state shims, a fixed project identity, and a generated 8-second timeline. I shortened it to 4 seconds, then changed only the baseline Auto zoom value, matching the fresh-recording refresh path. Output:

```json
{"stage":"before native settings refresh","end":4,"past":1}
{"stage":"after native settings refresh","end":8,"past":0,"preservedDraftZoom":false}
```

A separate probe changing the generated baseline duration from 8 to 8.1 seconds also replaced the 4-second draft and reduced its undo entries from one to zero. These are code-level reproductions, not claims of a granted native recording session or a live-browser reproduction. Neither probe wrote product files or launched an application.

Only regenerate an untouched generated timeline. Preserve an edited draft and its history across same-session baseline updates, and reconcile metadata/settings without replacing its timeline. Add a controller/browser regression that carries nondefault pre-record settings into a take, edits the generated timeline, refetches native defaults before the first Save, and verifies both the cuts and Undo. Existing tests cover retaining pre-record settings and ordinary saved-timeline refreshes separately, but not this combination.

## Earlier findings checked

The last frozen review's active-playback scrubbing and EOF replay defects are corrected in source. Explicit controller seek/nudge commands pause before seeking, slider keyboard/pointer input pauses, and Play rewinds an exact completed program. The current browser regressions exercise reordered source intervals, a gap, natural completion, explicit EOF and a trailing gap. The play-generation guard prevents an old rejected play request from stopping a newer one. Queued native pause/seeked events no longer own program transport state.

Successful Open, Recent Open and new recording reset the renderer's previous export result; failed or cancelled opens retain it. Result file actions continue to use a host-owned completed output. Permission recovery now names Input Monitoring and explains the other settings categories. Local storyboard diagnostics distinguish syntax, version, missing/invalid schema paths, duplicate scene IDs and size limits. Keyboard Blade activation uses the program playhead. Collapsed panes have labeled restoration buttons and inert contents; narrow scene buttons drop secondary duration/camera information first.

The earlier same-package replacement, recording-reconciliation, static-camera and reopened Save As fixes remain present. Their regression coverage exercises actual mutation paths, source-copy independence, in-place media preservation, missing declared sidecars, duplicate recording transitions, visual/timeline history and save rebasing.

## Scope and validation

I read the root and nearest desktop/web/native AGENTS instructions, `REVIEW.md`, verification selection, the research, all-40-finding ledger, 89-module inventory and implementation evidence. I reviewed the full 180-file changed inventory and production changes across document history, mutations and reconciliation; file replacement and native capture transitions; preview transport, camera/framing, audio presentation and decoded thumbnails; timeline/inspector and selected-range export; proposal validation/adoption/isolated playback; host bridge, picker authority, loopback CORS/security, output actions and quit cleanup; native project IO; public routing, request localization, appearance, navigation and shared controls. Tests, fixtures, localization, assets and documentation were checked as supporting changes. No protocol or generated binding change is present.

I inspected retained native Edit and small-window Deliver screenshots. They show the documented composed preview, scene inspector, timeline lanes and Export footer. The written native evidence also records denied Capture, same-package cancellation/discard, Save As, isolated scene playback, export actions, fullscreen, EOF replay/scrubbing and pane restoration. I did not relabel browser/source proof as native proof.

Retained logs reviewed:

- `round3-acceptance.log`: 115 browser tests in 10 files passed, packaged smoke passed, cleanup passed, zero fatal-pattern matches.
- `round3-unit.log`: 10 focused transport/diagnostic tests passed. `unit-final.log`: 159 earlier focused tests in 27 files passed.
- `swift-save-as-final.log`: six EngineProjectSave tests passed. The implementation evidence also records the six ProjectStore tests. `swift-fast.log` records a successful engine build.
- `web-tests.log`: eight tests in three files passed. `web-build.log`: production build completed.
- `round3-typecheck-final.log`, `round3-lint-final.log`, `round3-repo.log`, `round3-docs.log` and `round3-format-check.log` record the applicable successful checks. Typecheck suggestions remain informational.

I ran `git diff --check` for the frozen range successfully and the two lightweight deterministic hook probes above. I did not rerun heavy suites, launch an app, open another browser, spawn reviewers or edit product code. Only this report was written.

Granted native capture, audible native audio/sidecars, rendered vertical-file comparison, broader native pane/high-zoom and VoiceOver verification remain explicitly unclaimed release checks. Full CI and Windows/Linux checks still belong before merge. These limits are separate from the concrete new draft-loss defect. Future PR screenshot attachment and the zero-unresolved-review-thread merge gate remain required.

The playback and interaction fixes substantially improve readiness. The remaining loss of unsaved cuts with no Undo recovery prevents this revision from passing the requested rating gate.
