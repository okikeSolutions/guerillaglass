# Independent product and visual UI review, round three

Reviewed 2026-11-09.

Frozen HEAD: `7adcc9b07cf1d5691aa68941f41b01d341d244c5`.
Comparison baseline: `45245daf360d0bd352f28da39b5ddec6978931c1`.
Review scope: the complete literal 180-file change, its current UI, supporting behavior and evidence. No peer round-three report or score informed this assessment.

**Overall rating: 9.4/10. Strictly greater than 9.5 gate: FAIL.**

The main workflows now read clearly and the five product findings from round two have matching corrections. One remaining editor interaction breaks the relationship between the visible timeline and its inspector after Undo/Redo. That is a concrete product defect in the new history workflow, so I cannot rate this complete change above 9.5. The disclosed native acceptance limits below are separate from that finding.

## Finding

### P2: Undo and Redo leave a stale or nonexistent scene selected in the inspector

Evidence:

- `apps/desktop-electrobun/src/mainview/app/studio/hooks/timeline/useEditorDocumentHistory.ts:144` commits history without reconciling selection. Redo follows the same pattern at line 150.
- `apps/desktop-electrobun/src/mainview/app/studio/hooks/core/useStudioController.ts:697` normalizes selection using only mode and the old selection. The timeline is absent from its dependencies. Line 995 stores the clip's start/end as a snapshot at selection time.
- `apps/desktop-electrobun/src/mainview/app/studio/domain/inspectorSelectionModel.ts:51` checks route compatibility, but neither clip existence nor current program timing.
- `apps/desktop-electrobun/src/mainview/app/studio/panels/inspector/SelectionDetails.tsx:55` can find no clip, yet continues rendering the selected-scene inspector. Lines 88 and 93 display the old selection timing rather than the current compiled clip timing.

Reproduction with an existing clip: start with a four-second scene A followed by a six-second scene B. Ripple-delete A, select B, then Undo. The timeline correctly restores B at program 4..10, but the inspector retains Start 0 and End 6. The selected scene exists, yet its displayed program location disagrees with the timeline. Another route is to split a scene, select the newly created right-hand scene, then Undo. The selected ID disappears from the timeline while the inspector still presents its old timing and editing actions. Redo has the corresponding problem when it removes or moves a selected scene.

I exercised the exact history, timeline command, compilation and selection-normalization functions with two lightweight `bun -e` reproductions. The first returned `selectedClipExists: false` with `inspector.id: timelineClipVideo` after undoing a split. The second returned selection `b` at 0..6 while the restored compiled clip `b` was at 4..10. This is source-derived controller/UI evidence with executable domain confirmation, not a claim that I reproduced it in the packaged app during this review.

Reconcile selected IDs and timings whenever the timeline changes, or explicitly clear timeline selection on history traversal. If selection is preserved, derive its location from the current compiled document. Add a rendered controller regression for selecting a new split scene before Undo and for selecting a surviving moved scene before Undo/Redo. The expected result must include the inspector's visible state, not only the restored document. This affects UI-007, UI-014 and UI-015. I found no evidence of saved-project or exported-media corruption from this defect.

## Round-two fix verification

The previous product review's concrete findings no longer apply to this frozen source:

| Previous finding | Current assessment |
| --- | --- |
| General settings action opens Input Monitoring | The action now says Open Input Monitoring Settings. The permission pane explains separate Screen Recording and Microphone recovery. The current denied screenshot shows the correct label and instructions. |
| Generic storyboard schema failure | The schema diagnostic model distinguishes JSON, version, field path and duplicate scene positions; the panel explains the 2 MiB limit. The current native diagnostic names the missing `version` field. |
| Blade keyboard activation cuts at the clip boundary | `TimelineSurface` uses the current playhead for a keyboard-generated click and retains pointer-based cuts. Focused browser coverage exercises that path. |
| No labeled collapsed-pane restoration | The workspace supplies labeled restoration buttons in allocated rows and makes collapsed content inert. The current restoration screenshot does not overlap the stage. |
| Narrow clips prioritize optional metadata | Container sizing suppresses duration/camera counts before scene identity. Source and focused browser coverage address this; normal proportional source-range truncation remains an expected timeline constraint. |

I also inspected the separate transport/result corrections. Explicit program seeking pauses first, the store restarts at exact EOF, paused end-frame sampling preserves the exact program clock, and delayed media events do not overwrite newer commands. Committed Open/Recent/new recording resets the renderer export result, while cancelled or failed replacement returns without doing so. The latest acceptance and native observations support those changes. They do not cover the selection problem above.

## Complete product scope

I read the root and subsystem agent guides, `REVIEW.md`, the spec's workflow/layout/accessibility requirements, all 40 ledger entries, the 89-module coverage inventory, the improvement research, the Emil Kowalski audit and the implementation evidence. I inspected the full changed route/component code and supporting history, transport, media, permissions, diagnostics, localization, host menu/dialog and native save/recording changes. The inventory's library-only entries are not extra shipped product screens.

| Area | Review coverage and product assessment |
| --- | --- |
| Desktop entry, routing and providers | App bootstrap, benchmark separation, localized Capture/Edit/Deliver and legacy redirects, persistent route state and context. No new product defect found. |
| Shell and workspace | Project identity/Saved state, route priorities, recording and permission states, Project files/View, Preferences, replacement dialog, feedback, diagnostics, pane resize/collapse/restore, keyboard/inert behavior and persisted layout bounds. The dominant preview and persistent timeline remain intact. |
| Capture | Loading/failed/unknown/denied/granted branches, source radio/selects, microphone/input options, FPS, effects, live/saved/empty preview and media retry. Denied recovery is accurate in current evidence. Active granted recording remains an acceptance limit. |
| Edit and playback | Shared program preview, framing/camera separation, media lease renewal, empty/error/loading states, external play/seek/clock/listening controls, fullscreen and route continuity. The current native screenshots show controls outside the transformed picture. |
| Timeline and inspector | Both route toolbars, selection/trim/blade, snap/ripple, zoom/rate, ruler/track/playhead origin, all three lanes, real thumbnails, truthful audio states, gaps, markers, lock controls, drop affordances, camera metadata and every inspector dispatch branch. The history/selection finding is the remaining inconsistency. |
| Project utility and safety | Project/program duration and source metadata, Advanced/Media Bin/recents branches, successful/cancelled/failed replacement, native save filename and overwrite prompts, reopened asset copying and native quit protection. No additional product defect found in this pass. |
| Proposal review | Import/JSON entry, size and schema diagnostics, unavailable/dirty/busy/stale gates, editorial intent, current/proposed duration and scene rows, camera details, selected row/focus movement, isolated before/proposed playback, confirm/apply/result states. The review preserves context and gives understandable recovery. |
| Deliver | Shared composition preview, one output form, effective full/selected ranges including zero, field-error association, fixed Export footer, pending/queued/running/failed/succeeded states and host-owned Open/Reveal. Preview/export/persistence evidence is scoped honestly. |
| Preferences and shared UI | Global availability, locale/density, shortcut capture/default/custom/conflict/reset behavior; changed dialog/command/spinner defaults, property rows and theme provider. I checked shared primitive use against the complete 43-component inventory and five desktop composition modules plus token stylesheet. Unchanged dormant wrappers have no new rendered product claim; no exhaustive prop gallery is claimed. |
| Public website | Root/auth isolation, Hero, workflow, demonstration, source-build information, FAQ, Footer, native-dialog mobile navigation, retained TimelineAnimation helper, appearance, About, missing/error recovery, server locale boundary, stylesheet and both locales. No unshipped paid-plan or installer-download promise remains in the current copy. |

The source follows the research direction well. Ordinary editing avoids decorative entrance sequences, feedback has allocated space, file utilities have one home, and task-specific primary actions carry visible labels. The website uses a static canvas and product imagery with a visible source-build action. In the editor, the left metadata column and long camera inspector remain dense, but their scrolling and pane controls make that a reasonable tradeoff. I do not report density preference as another defect.

## Images actually inspected

I used `view_image` on all current retained packaged evidence: `desktop-edit.png`, `desktop-capture-denied.png`, `restore-panel.png`, `proposal-diagnostic.png`, `desktop-deliver.png`, `desktop-deliver-small.png`, `desktop-deliver-vertical.png`, `desktop-small.png`, `desktop-fullscreen.png`, `proposal-review.png`, `proposal-preview.png`, `preferences-de.png`, `replacement-confirmation.png`, `quit-guard.png` and `save-as.png` under `docs/evidence/ui-pass`.

I also used `view_image` on the built-site `web-mobile-de-dark.png`, `web-faq-de-dark.png`, `web-about-de-light.png` and `web-not-found-de-light.png`. These show readable hierarchy, consistent appearance, inline answers and finished recovery pages. The mobile-home image contains the older editor illustration, as explicitly disclosed. I independently checked that current `apps/web/public/studio-preview.png` and current packaged `desktop-edit.png` have identical SHA-1 `4f870906d8ea684e046041406c6e834248f7a989`. The older mobile capture is a limit on exact current built-page evidence, not a current asset defect.

The small Edit screenshot does not expose the Events lane; the smaller Deliver screenshot does. This matches the documented remaining native Edit wheel-scroll check. Screenshots establish the rendered composition, not focus trapping, audible playback or motion performance by themselves.

## Validation and limits

I ran frozen-range `git diff --check`, confirmed the frozen HEAD, checked the image bytes and executed the two isolated domain reproductions described above. I launched no app or browser, ran no build or test suite, spawned no agents and changed no product source.

I read the retained round-three acceptance, unit, transport, repository, documentation and typecheck results. The final integrated acceptance log records 10 browser files and 115 passing tests, packaged runtime smoke passed, process cleanup passed and zero fatal matches. The focused diagnostic/transport units record 10 passes. The earlier failed browser recheck is superseded for those same areas by final acceptance; I did not treat that historical failure as a current regression or add overlapping test counts together. The implementation evidence separately records the earlier 159 desktop units, 12 native save/store tests, eight web tests and web build. These are author-run checks, not suites rerun by this reviewer.

The native record-to-export workflow with granted capture permission, audible native audio, VoiceOver listening, the complete pane/height/focus matrix, system reduced-motion behavior, rendered vertical-file comparison, full CI and Windows/Linux runtime remain unclaimed. These are disclosed release acceptance limits. They do not establish defects and are not substitutes for the concrete history/selection finding. The ledger can retain Ready for verification where acceptance work remains.

The change is substantially more usable and visually coherent than the baseline. My 9.4 rating reflects the complete current change and the unresolved inspector truth defect. It is not rounded, averaged with another review or raised to satisfy the requested threshold. This report does not authorize PR preparation under the user's gate.
