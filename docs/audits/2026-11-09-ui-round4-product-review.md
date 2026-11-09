# Independent product and visual UI review, round four

Reviewed 2026-11-09.

Frozen HEAD: `a7c53575a1cbcc253e5be1d3446ec7e2cb17d8e8`.

Comparison baseline: `45245daf360d0bd352f28da39b5ddec6978931c1`.

Overall rating: **9.6/10**. Strictly greater than 9.5 gate: **PASS** for this independent product and visual review.

This assessment covers the complete baseline-to-HEAD change, including the public website and supporting native workflows. It is not a rating of only the last commit. I did not read peer round-four reports or receive their ratings. The score is my judgment of this change's product quality, not an average, a rounded result or a release certification.

## Prioritized findings

No remaining P1 or P2 product/visual defect found. I found no concrete P3 defect that needs a change before this review can pass. The acceptance limits below remain real limits; they are not evidence of an additional defect.

The editor now makes the task and document state legible. Capture, Edit and Deliver have visible labels, ordinary file operations have one consistent home, and the primary action belongs to the current task. The center preview remains dominant. Timeline labels, thumbnails and source intervals establish a useful connection to the selected scene. The right inspector is still dense when a scene contains many camera keys, but it scrolls independently and has an explicit return to project settings. I consider that a reasonable workstation layout, not a new required redesign.

The public page explains the currently available product without selling absent plans or presenting a repository link as an installer download. Product imagery and the silent native-rendered example replace decorative filler. The mobile opening exposes the build action, FAQ answers stay beside their questions, and About/recovery pages share the same readable theme. This is a coherent improvement across the whole workflow.

## Latest correction verified

The round-three product finding is addressed at the layer that caused it:

- `apps/desktop-electrobun/src/mainview/app/studio/hooks/core/useStudioController.ts:698` derives inspector selection from the current lanes and includes those lanes in its dependencies.
- `apps/desktop-electrobun/src/mainview/app/studio/domain/inspectorSelectionModel.ts:51` resolves current clip existence and program timing. It returns an empty selection when the selected scene no longer exists. Marker details also come from the current lanes.
- `apps/desktop-electrobun/tests/ui/editor-export-timeline.browser.test.tsx:2226` checks the rendered project inspector after Undo removes a selected split scene. The surviving-scene regression at line 2248 checks visible Start/End values through Undo and Redo.
- I inspected `docs/evidence/ui-pass/undo-selection.png` with `view_image`. The original three scenes are present, the header says Saved, the scene inspector has returned to project controls, and Redo is available. The retained native observation describes the temporary split/select/Undo sequence and explicitly says that temporary edit was not saved.

I also checked generated-source refinement because an editor cannot be trustworthy if Refresh can remove the draft. `apps/desktop-electrobun/src/mainview/app/studio/hooks/timeline/useEditorDocumentHistory.ts:56` selects generated-timeline rebasing rather than replacing the edited document with native defaults. `apps/desktop-electrobun/src/mainview/app/studio/domain/editorDocumentHistory.ts:33` refines only snapshots whose timeline still matches the untouched previous generated timeline. It preserves local cuts, visual settings and both history directions. The controller/browser regression at `apps/desktop-electrobun/tests/ui/editor-export-timeline.browser.test.tsx:2151` exercises start, stop, edit, Refresh, export, Undo, Redo and Save with native default settings. The retained passing model and browser results support this correction. Granted native capture remains unclaimed.

## Complete product scope

I read the root and desktop/web agent guides, `REVIEW.md`, verification selection, the relevant spec workflow/layout/accessibility requirements, all 40 ledger entries, the current 89-module inventory, the improvement research, the Emil Kowalski guidance and the implementation evidence. I examined the full baseline comparison rather than limiting review to previously reported defects. The source pass covered every changed authored route, panel, component and stylesheet, plus the history, playback, media, permission, localization, file-dialog, menu, native save and recording changes that determine their behavior. Library-only inventory entries are not extra shipped screens or live proof.

| Area and ledger coverage | Assessment |
| --- | --- |
| Shell, orientation and state, UI-001 through UI-007 | Visible route labels, task actions, project identity, dirty state and history are consistent. Source choice is distinct from the explicitly named recording commands. Replacement decisions have safe initial focus and preserve work on cancellation/failure. Successful same-package Open resets the document session. Native quit protection is explicit. |
| Audio, duration and playback, UI-008 through UI-012 | Unsupported mixer/mute/solo controls no longer promise output changes. Waveforms come from decoded audio; missing, unknown, silent and unavailable states stay distinct. Program duration comes from the edited document. External transport and fullscreen include the composition without inheriting camera transforms. Ruler, lanes and overlays share one scroll/zoom origin. Scrub and EOF regressions cover the previously reported transport failures. |
| Timeline, selection and camera, UI-013 through UI-015 | Scene number, source interval, real source frames, gaps and camera metadata give clips meaning. Narrow clips suppress secondary duration/camera data before scene identity in current source and focused browser coverage. Selection resolves against current lanes. Explicit static camera overrides differ from inherited settings and Reset is undoable. Full manual camera authoring is not claimed. |
| Delivery and project IO, UI-016 through UI-019 | One output form accompanies the composition preview. Full program and Selected range expose their effective scope, including zero as a real endpoint. Invalid/empty ranges fail before destination selection. Fields reference their error. The fixed Export footer remains reachable while settings scroll. Pending and returned job states are truthful, with Open/Reveal only after success. Native Save As accepts a filename and reopened assets survive copying. |
| Feedback, proposal and layout, UI-020 through UI-024 | Routine notices use allocated space and can be dismissed. Proposal diagnostics identify syntax, version, field paths, duplicate scene positions and size limits. Before/proposed scene review has titles, selection indication, focus movement and bounded isolated playback. Route layouts and labeled pane restoration preserve orientation. Source provides timeline overflow at `panels/TimelineDock.tsx:237`; the remaining native Edit wheel-scroll check is disclosed below. |
| Accessibility, preferences and recovery, UI-025 through UI-028 | Shipped fields have names and selected/tool controls expose state. Global Preferences supports locale, density and shortcut changes, cancellation, conflict feedback and reset. Replacement dialogs use shared modal behavior. Missing media has an explicit retry path. Brand spelling and appearance ownership are clear. Focus and reduced-motion conventions remain in source; screenshots alone do not prove assistive-technology behavior. |
| Public website, UI-029 through UI-040 | Public routes no longer await hosted auth. Hero, workflow, demo, build information, FAQ and footer have distinct purposes. Actions are real links with honest availability copy. Native dialog navigation closes on selection/Escape and restores focus; native details/summary keeps answers adjacent. About, 404 and error recovery are finished. Shared English/German copy, request-scoped server locale and static light/dark colors address the original reliability, localization and contrast failures. |

This follows the research direction without adding motion that delays repeated editing. Scene selection, seeking and history respond directly; dialogs and notices explain decisions and state. The change does not claim a measured speedup or user-study result.

## Images inspected

I used `view_image` on all 20 retained current-state images under `docs/evidence/ui-pass`:

- Desktop routes and sizes: `desktop-edit.png`, `desktop-capture-denied.png`, `desktop-deliver.png`, `desktop-deliver-vertical.png`, `desktop-small.png`, `desktop-deliver-small.png`, `desktop-fullscreen.png`.
- Proposal and recovery: `proposal-review.png`, `proposal-preview.png`, `proposal-diagnostic.png`, `restore-panel.png`, `undo-selection.png`.
- Preferences and decisions: `preferences-de.png`, `replacement-confirmation.png`, `quit-guard.png`, `save-as.png`.
- Built web routes: `web-mobile-de-dark.png`, `web-faq-de-dark.png`, `web-about-de-light.png`, `web-not-found-de-light.png`.

The small Edit image does not expose the Events lane; the small Deliver image does. The evidence does not establish native wheel scrolling in the former. The German Preferences and proposal images show scrollable content extending beyond the initial viewport, not a claim that every row is simultaneously visible.

The mobile-home image contains the older editor illustration, as disclosed. I checked the current shipped `apps/web/public/studio-preview.png` against `docs/evidence/ui-pass/desktop-edit.png`; both have SHA-1 `4f870906d8ea684e046041406c6e834248f7a989`. The old built-page image is evidence of page layout, not proof of the later asset revision. The demonstration provenance identifies browser-recorded source and native export; it does not imply granted native capture.

## Validation and limits

I confirmed the frozen HEAD, ran `git diff --check` over the exact baseline range and checked the illustration hashes. I launched no application/browser, spawned no agents, ran no build or test suite and edited no product file. This report is the only file written by this review.

I inspected the retained round-four logs. Integrated `desktop:acceptance` records 10 browser files and 118 passing tests, packaged runtime smoke passed, process cleanup passed and zero fatal matches. The focused history/selection browser run records 63 passes and its model run records 11 passes. These overlap other coverage and are not summed. Current typecheck, lint, repository, documentation and formatting results pass. Typecheck includes schema-brand suggestions; the packaged build includes chunk-size and development-icon notices. Neither establishes a product interaction failure.

The implementation evidence separately records the applicable earlier 159 desktop unit passes, 12 Swift save/store passes, eight web test passes, web/shared typechecks and the production web build. These are author-run results, not suites rerun by this reviewer. Native-window evidence and its observations are distinct from the packaged smoke report, whose automated screenshot is unavailable.

Granted native capture and source picking, audible native audio and sidecar playback, VoiceOver listening, every pane/height/focus combination, native Edit Events-lane wheel scrolling, system reduced-motion/contrast testing, a rendered vertical-file comparison, full CI and Windows/Linux runtime remain unclaimed. The ledger should retain its acceptance limits. This review does not mark all 40 findings Verified or complete the later Phase 2 release-polish gate.

My overall 9.6 reflects clear task hierarchy, truthful current state, reversible editing, consistent preview/delivery context and a coherent public page, with no remaining required product fix found in this pass. It clears this review's strict threshold. PR preparation still depends on the other two independent frozen reviews also exceeding 9.5; merge remains subject to repository CI and review-thread requirements.
