# Frozen correctness review

Review date: 2026-11-09. Reviewer focus: correctness, document safety, media, native project IO and export agreement.

- Baseline: `45245daf360d0bd352f28da39b5ddec6978931c1`.
- Reviewed head: `013123631c5402304bf9f8837de83b35f978cc56`.
- Reviewed diff: `git diff 45245daf360d0bd352f28da39b5ddec6978931c1...013123631c5402304bf9f8837de83b35f978cc56`.
- Confirmed the merge base equals the stated baseline and workspace HEAD equals the frozen head.
- Score: **8.7/10**.
- Gate: **FAIL**. My score is not strictly greater than 9.5/10. This review does not authorize preparing a PR.

The pass improves the core workflow and has useful native and browser evidence. Explicit range export, real thumbnails, visible project state, host-owned export actions, isolated scene playback and reopened-project Save As are worthwhile corrections. The unresolved replacement bug breaks an explicit editing-safety promise. The other two findings leave important states inconsistent with the native document or the inspector's explanation.

## Required corrections

### P1: Reopening the current project ignores confirmed Discard

Locations: `apps/desktop-electrobun/src/mainview/app/studio/hooks/timeline/useEditorDocumentHistory.ts:44`, `apps/desktop-electrobun/src/mainview/app/studio/hooks/core/useStudioMutations.ts:581`, and the corresponding recent-project success handler at line 608.

Reproduction:

1. Open saved project A.
2. Split a scene or change background framing so A has an unsaved draft.
3. Open A again through Open Project or Recent Projects and accept the discard confirmation.
4. The native project opens its saved document, but the renderer retains the unsaved draft and history.

`projectIdentity` contains the project path and recording URL. Reopening A leaves both unchanged. The saved baseline signature is also unchanged, so the history hook selects `draft.history` at lines 46-48. Successful-open callbacks update query data without resetting document history or advancing a project-session identity.

The user has explicitly discarded these edits, yet a later Save can write them over the saved project. This also makes the success message and native state disagree with the editor. Reset document history after a successful explicit open, even when path, source and saved content match. Failed or cancelled opens must preserve the existing draft. Preserve the separate Save As rebase behavior. Add a regression that invokes the actual open mutation with the same package, rather than only replacing query data with a different path. The existing browser test named "project replacement resets history even with the same source and timeline" changes the project path, so it misses this case.

### P2: A failed post-start status refresh skips the new-recording transition

Location: `apps/desktop-electrobun/src/mainview/app/studio/hooks/core/useStudioMutations.ts:495`.

Reproduction: with saved project A open, let native `startRecording` succeed and return `isRecording: true`, then reject the first follow-up `captureStatus` request.

The mutation publishes the successful capture snapshot, then awaits `syncCaptureStatus` at line 496. That rejection exits the success callback before lines 530-546 clear A's project path, history, selected range and transport. Native `beginProjectForRecording` has already retired A and created a new document. The renderer still shows A's identity and draft while the recording is active, and reports an error for an operation that actually started.

Commit the transition established by the returned start result before fallible follow-up queries. Treat reconciliation failure as a separate recoverable status problem. Cover successful start followed by status-query failure, alongside failed native start which must preserve A. I am not claiming this single failure alone destroys recording bytes; it leaves document ownership and UI state inconsistent.

### P2: An explicit static scene camera is mislabeled as inherited and cannot be reset

Location: `apps/desktop-electrobun/src/mainview/app/studio/panels/inspector/SelectionDetails.tsx:108` and line 136. Related text: `messages/en-US.json:383` and `messages/de-DE.json:383`.

Reproduction: open or apply a valid scene with `camera: []`, select it, and inspect Scene camera.

Both presentation and Reset availability use `camera?.length`. An empty explicit override therefore displays "Uses project camera settings" and hides Reset. The native export selects the explicit-camera path whenever the camera exists, including an empty array. Its empty array uses the base transform rather than inherited automatic camera behavior. The pure `resetTimelineClipCamera` command correctly distinguishes `undefined` from `[]`, and the new unit tests explicitly cover that distinction, but the UI makes the supported reset unreachable.

Use camera presence to determine override/reset availability, with separate localized text for inherited and explicit static states. Add rendered inspector coverage for both `camera: []` and missing camera, including Undo after resetting the static override.

## Evidence assessed

Read root and desktop/web/native agent guides, `REVIEW.md`, the UI research, ledger and implementation evidence, and the relevant architecture, specification, timeline and verification requirements. Inspected changed production code across the renderer, host bridge, native project/capture changes, public website, localization and shared UI primitives, plus dependencies and focused regression tests for the critical paths.

Visually inspected all 14 retained images in `docs/evidence/ui-pass` through `view_image`. They support the shown native editor, small-window, denied-capture, Deliver, proposal, Preferences, Save As, quit guard and public web states. They do not prove same-package discard behavior or failed post-start reconciliation.

Read the supplied logs. `unit-final.log` records 24 files and 144 passing tests; `desktop-acceptance.log` records 9 browser files and 77 passing tests plus packaged runtime smoke; `swift-save-as-final.log` records 6 ProjectStore and 6 EngineProjectSave passing tests. Web logs record 3 files and 8 passing tests and a completed production build. Reviewed desktop typecheck output, final lint output and the native shutdown record. Ran only static repository commands and `git diff --check` for the frozen range, which passed. Did not rerun builds or suites, change product code, or interact with apps or browsers.

Native Save As now resolves assets from reopened packages, preflights declared source existence and avoids deleting an asset when saving it in place. The native tests exercise copied media after source removal and missing declared sidecars. Selected export endpoints retain zero and validate ordering/duration before destination selection. Host-owned completion actions retain path-policy authority. No engine wire contract changed, and no unexpected generated protocol changes are present.

## Optional matters and coverage limits

The documented remaining live checks should stay explicit: granted native capture and audible recordings, missing source during an open native session, vertical rendered-file comparison, high-zoom native scrolling and VoiceOver listening. These are coverage limits, not invented defect findings. Windows/Linux remain nonproduction media shells and full CI remains pending. The supplied evidence appropriately avoids claiming those checks passed.

The later Phase 2 performance/accessibility gate remains open. I have no additional optional code-change request in this review. Fix the three concrete findings, rerun the affected checks, and obtain new independent reviews tied to a new frozen commit.
