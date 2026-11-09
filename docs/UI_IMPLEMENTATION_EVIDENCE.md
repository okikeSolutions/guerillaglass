# UI implementation evidence

Implementation and verification on 2026-11-08 and 2026-11-09. Comparison baseline is main `45245daf360d0bd352f28da39b5ddec6978931c1`. The [ledger](UI_REVIEW_LEDGER.md) preserves the original findings; the [inventory](UI_REVIEW_INVENTORY.md) preserves the original screen/component inspection. This document records the fixing pass. It does not complete the later Phase 2 performance/accessibility gate.

## Review gate

The user requires three independent reviewers, each rating the complete change **strictly above 9.5/10**, before preparing a PR. Initial reviews of the moving tree scored 6.8, 7.0 and 7.1. Frozen commit `0131236` subsequently scored [8.7 for correctness](audits/2026-11-09-ui-correctness-review.md), [9.0 for standards](audits/2026-11-09-ui-standards-review.md) and [8.4 for product](audits/2026-11-09-ui-product-review.md). All failed the gate. Commit `8bdd37b` then failed at [9.2 correctness](audits/2026-11-09-ui-round2-correctness-review.md), [9.3 standards](audits/2026-11-09-ui-round2-standards-review.md) and [9.1 product](audits/2026-11-09-ui-round2-product-review.md). Commit `7adcc9b` received [9.3 correctness](audits/2026-11-09-ui-round3-correctness-review.md), [9.6 standards](audits/2026-11-09-ui-round3-standards-review.md) and [9.4 product](audits/2026-11-09-ui-round3-product-review.md). Only standards passed individually, so the combined gate failed. These reports remain historical evidence, including the defects they identified. Follow-up changes require fresh independent reviews of a frozen commit and its evidence. No earlier score authorizes PR preparation. Reviewers must report unresolved findings without rounding a failing score up.

## Current workflows

Capture, Edit and Deliver have visible labels. Recording has explicit Record/Stop actions, selected-source semantics, a timer and permission states. Project identity and saved state remain visible. Essentials start expanded; technical details are optional. Preferences are available from every route. The header prioritizes capture actions in Capture and project file commands in one consistent location. Edit/Deliver use the program transport, and Deliver owns its primary Export action. Timeline file-action duplicates were removed; proposal review starts from a compact trigger.

The editor has bounded history for timeline, auto zoom and background framing, replacement protection, scene numbers and source intervals, real decoded thumbnails, camera indicators and an inspector with source-time camera values and undoable camera reset. The ruler, tracks and playhead share their scroll/zoom origin. Unsupported mixer controls and event-derived audio waveforms are removed. Media failures show Retry; a refreshed media lease can recover without losing the document. Player controls stay outside camera transforms. Preview-only volume and mute survive Edit/Deliver navigation without changing saved/exported audio. The fullscreen wrapper includes both the camera composition and external controls; its transport uses two responsive rows with a reserved time readout. Audio presentation distinguishes loading, known no embedded audio, silent decoded data, unavailable decoding and a real waveform. Unknown track presence is not treated as absence, and embedded-track metadata does not claim that separate audio sidecars are absent.

Deliver keeps the composition preview and one output form. Full program and Selected range are explicit. Both effective endpoints reach export, including zero. Range fields reference their associated error message, and the Export action remains in the form footer while its settings scroll. Empty, inverted and out-of-bounds ranges cannot export. Result actions are enabled only for a succeeded job and refer to the host-owned completed output. Native macOS Save As accepts a filename; export uses a separately titled folder chooser.

The public website renders without hosted auth, describes current source-build availability, and shows the actual editor and a native-rendered demo. Static light/dark colors replace the shader dependency. Mobile navigation uses a modal dialog; FAQ answers expand beside their questions. English and German server rendering use request-scoped locale state.

## Native verification

The development app was rebuilt through `bun run desktop:acceptance`. The permissioned Peekaboo GUI bridge supplied native-window screenshots and interactions. CUA supplemented keyboard/menu and native file-picker interaction. Tests ran sequentially with at most two workers where configurable.

| Workflow | Observed result |
| --- | --- |
| Capture with denied engine permission | Explicit Screen not granted/Input Monitoring unknown. No false Ready badge. No permission granted for this pass. |
| Open edited project | Three scenes, 12-second program, actual source metadata and real thumbnails. Preview/camera shows the selected source interval. |
| Save As reopened project | Named `UI-release-proof.gglassproj` in the ignored test directory. Recording bytes and project document copied; header becomes Saved; copied media previews. Original project retained. |
| Undo/Redo | Native menu and keyboard restore/reapply scene edits. Visual-setting Undo/Redo also changes Saved/Unsaved correctly, including after Save As to a copied source. This machine uses QWERTZ; synthetic physical Y generates logical Z. No layout-specific product workaround was added. |
| Small desktop window | At 1100x760, Edit controls and two-row clock fit. Deliver shows all three lanes and its fixed Export footer. The timeline has a source-level overflow path; manual Events-lane scrolling was not established because the UI driver failed to target the wheel event. |
| Same-package replacement | With unsaved Auto zoom enabled, Escape cancels the application confirmation and preserves the draft. Explicit Discard changes followed by native Open of the same Website package restores saved Auto zoom disabled, Saved state, disabled Undo and Full program range 0..12. No window.confirm is used. |
| Fullscreen and preview audio controls | The actual native wrapper enters/exits 1920x1080 fullscreen with the camera composition and controls. Preview volume/mute state survives Edit to Deliver while the project remains Saved. The source has no audio, so this is control-state proof, not audible playback proof. |
| History selection after Undo | Temporarily split native Scene 2 at program 6 seconds, select the new 6..7-second Scene 3, then use the visible Undo action. The deleted ID no longer appears in the inspector; project settings return, the original three scenes remain and the header returns to Saved. The temporary edit was not saved. |
| Second-review native follow-up | At exact 12-second EOF, Play preview restarts at 0.13 seconds. Scrubbing pauses at 6 seconds. Show project panel restores the collapsed rail through a reserved row without overlapping the stage; collapsed content is inert. Missing-field storyboard `{}` reports version specifically. The original demo remains Saved. Native Home/End key targeting was not established by the UI driver; real browser keyboard coverage supplies that proof. |
| Audio-free source | Native WebKit reports zero embedded tracks and the lane says No audio. Unknown, failed and silent decode states have separate source/browser coverage. |
| Proposal import/review | Imported through native file picker. Source and saved revision validated; 12-second current program compared with an 11-second proposal. Scene camera/timing differences are readable. |
| Isolated scene playback | Native Scene 1 preview stops at 2.00/2.00 without changing the main program transport. The preview identifies its scene and Before/Proposed version; selected rows and focus movement have browser coverage. The proposal was not applied to the original demonstration project. |
| Selected-range output | Native UI export of program 0..5 produced a 5.000-second, 1920x1080, 30 fps MP4. Open video launched QuickTime; Show in folder selected the output in Finder. |
| Pending-picker shutdown | File > Quit with destination picker pending removed launcher, host, native engine and osascript helper. Final console search found no unhandled rejection, disposed-runtime error, panic or fatal match. |

Save As verification found and fixed underlying native asset-copy defects, including copying a reopened project's media and avoiding deletion when source and destination match. Native tests also remove the original source before reading/exporting the copy, reject missing declared audio before replacing destination assets, and cover successful/failed/duplicate recording transitions.

The combined dirty-work/pending-picker shutdown test observed processes 69851, 69852, 69860 and 79964, then verified all four absent after explicit Discard changes and quit. An expected late shell notification logged a disposed-runtime warning; the host now refuses new shell work once quit is approved. The final rebuilt-app recheck started launcher 88250, host 88251, engine 88256 and pending folder helper 90542. Command-Q removed all four; the console contained no unhandled, disposed-runtime, panic, fatal or shell-effect failure match. The UI driver timed out because the target app had exited; process and console checks establish the result. This does not claim crash or forced-termination recovery.

## Corrections after the failed frozen reviews

The reports above describe `0131236`, not the later source. Follow-up changes address their concrete findings:

| Finding | Change and evidence | Limit |
| --- | --- | --- |
| Same-package Discard kept the draft | Successful native open advances the renderer project session and resets history/range/selection even when path and source match. A cancellable application dialog replaces window.confirm. Actual dialog browser tests cover approval, Escape, close, duplicate requests and unmount. Native same-package Discard/cancel proof is recorded above. | Failed/cancelled opens retain the current draft. Forced termination remains outside this guarantee. |
| Started recording lost its transition on refresh failure | A confirmed start commits its fresh document transition before fallible reconciliation; configured visual settings are retained rather than replaced by native defaults. Controller/native regressions cover success, failed start, repeated starts and post-start query failure. | Native granted recording remains unverified because engine Screen Recording permission is denied. |
| Static camera appeared inherited | Inspector distinguishes an absent override from an explicit empty/static camera, exposes Reset for either explicit override, and supports Undo. Rendered inspector regressions cover static/inherited states. | Full manual key authoring remains roadmap work. |
| Failed permission checks appeared denied | Capture and header distinguish checking, failed, unknown and denied states. Failed checks offer Retry; OS instructions apply to confirmed denial. | Native denied state and browser failures are proven; granted OS recovery is not. |
| Host failures appeared in English in German | Stable file-action error codes map to shared localized messages after real JSON bridge decoding. Host descriptions and paths do not become UI copy. | Unit transport coverage includes both languages; the complete German native failure matrix remains outstanding. |
| Audio lane implied sound; preview lost volume/fullscreen | Typed audio presentation preserves known absence versus silence/unavailable/loading. External preview-only audio and fullscreen controls remain outside camera transforms. Native zero-track and fullscreen proof is recorded above. | Audible native recording and external-audio decoding remain release checks. |
| Toolbar duplication and proposal orientation | File commands have one header home, route-specific actions replace unrelated recording controls, and Deliver owns Export. Proposal titles, selected rows and predictable preview focus restore context. | First-time-user observation and long-project usability remain open. |
| Slider gestures flooded history | A visual-edit gesture groups intermediate form changes into one history entry, with browser drag/history regressions. | Full assistive-technology interaction remains unverified. |

The second frozen review found six further interaction defects. The follow-up makes explicit scrubbing pause and seek the source, restarts completed programs including fractional durations/trailing gaps, and keeps queued native pause/seek notifications from overriding newer program commands. Play request failures are tied to their current generation. Successful Open/Recent/new recording clears the previous export result; cancelled or failed replacement preserves it. Permission recovery names Input Monitoring precisely and explains the separate Screen/Microphone settings categories. Local storyboard diagnostics distinguish JSON syntax, unsupported version, missing/invalid field paths, duplicate scene positions and the 2 MiB import limit. Blade keyboard activation cuts at the playhead while pointer cuts retain their location. Labeled edge buttons restore collapsed panes, and narrow clips hide secondary duration/camera counts before losing scene identity. Focused browser regressions cover these paths.

The third frozen review found passive refresh could erase edits/history on an unsaved generated timeline and Undo/Redo could leave stale scene selection/timing in the inspector. The follow-up preserves edited timelines, visual settings and both history directions during generated-source refinement. Only untouched generated timeline snapshots adopt refined metadata. Inspector selection now resolves current IDs and timings from current lanes, returning to project controls for an absent scene. Browser regressions exercise a real controller start/stop, edit, native-default refresh, Undo/Redo, export and Save, plus the rendered inspector after split/removal and ripple restoration. Granted native capture remains unclaimed.

These corrections do not change the historical ratings or mark any finding Verified. The acceptance matrix below retains the remaining limits.

## Demonstration provenance

The website sample is a real 12-second native render of a browser-recorded FAQ interaction. Engine Screen Recording permission was unavailable, so it is explicitly not evidence of native capture. A storyboard agent and editing agent produced the editable project and a reviewed revision through the existing agent workflow. No time-saving benchmark or user study is claimed.

The 36-second source becomes three scenes at source 15.5..17.5, 18..23 and 29..34 seconds. Scene 2 moves from 1x to 1.6x; Scene 3 stays at 1.6x. The native output is 1920x1080 at 30 fps with no audio. All 360 decoded frames and the changing-frame contact sheets were inspected, along with full-size answer frames.

- Project revision `0b4248b2ac05be85e7828bc9e9f07c1c57549348e6febbc3c5c526ae5cec371b`.
- Source revision `adc04388a1fa8be4433d01fa76d12dd9a77aaff756f52197f57058e6b25420ef`.
- Render ID `09fad41e-685d-47f7-9e8a-b089daf21328`.
- Committed output [demo.mp4](../apps/web/public/demo.mp4), 1,530,691 bytes. The output poster is a decoded frame at 3.5 seconds. The [website screenshot](../apps/web/public/studio-preview.png) is the latest packaged-app capture of the same real editor project.

## Browser verification

The actual built TanStack application ran at localhost with the configured auth service unavailable. This pass uses the real routes, rather than the baseline audit's component fixture. Desktop 1280-wide and mobile 390x844 states were inspected.

- Root, About and missing-route content render independently of auth. The missing route returns HTTP 404 intentionally and fills the viewport.
- English and German requests return their own locale and copy. Concurrent request checks did not leak locale. Responses vary on Cookie and Accept-Language; an explicit locale cookie takes precedence over the language header.
- Auto appearance follows live system changes; an explicit stored preference takes precedence. German mobile dark, About light and missing-route light screenshots are retained. The retained mobile-home capture predates the latest editor illustration; the current website image is identical to the current packaged editor capture. The earlier built-home screenshot proves page layout, not that later asset revision.
- Modal navigation focuses its close action on open, wraps Tab/Shift+Tab, closes with Escape and returns focus to its trigger. FAQ expansion keeps focus beside the answer. No horizontal overflow at 390 px.
- Actual composited light text contrast ratios were 14.71 for primary, 6.30 for secondary and 7.30 for CTA text. Dark ratios were 16.73, 8.77 and 7.45. Public content has no active CSS entrance animation or WebGL dependency. Reduced-motion rules were inspected in source, not emulated in the native system.

## Finding-by-finding proof

Ready for verification means implementation and the cited checks exist. It does not mean every baseline acceptance clause has been certified. Remaining acceptance limits are explicit below and in the ledger.

| ID | Fix and proof | Remaining verification |
| --- | --- | --- |
| UI-001 | Labeled route/action header; packaged editor and Capture screenshots; shell browser tests. | First-time-user observation. |
| UI-002 | Explicit Record/Stop, selected target retained, timer; header/controller tests and denied Capture state. | Granted native recording start/stop. |
| UI-003 | Expanded essentials, reset/pane defaults; layout tests and packaged routes. | Fresh-profile and restored-layout combinations. |
| UI-004 | Explicit checking/check-failed/unknown/denied states, Retry and denial-only OS instructions; native denied state and browser regressions. | Granted OS permission recovery without new permissions in this pass. |
| UI-005 | Task-oriented localized copy and working Open/Capture actions in empty previews; source and shell route tests. | First-time-user comprehension and full copy review. |
| UI-006 | Saved/Unsaved identity, application replacement dialog, successful-open session reset and native same-package Escape/Discard proof. Native Save As and approved pending-picker quit are proven. | Forced termination and every replacement/failure combination remain outside this proof. |
| UI-007 | Bounded history, semantic no-op handling, source/save rebase, document hotkeys/menu; unit/browser/native keyboard proof. | Interleaved visual/timeline history and copied-source Save As passed in browser and native checks. No release-wide history claim beyond persisted editor fields. |
| UI-008 | Unsupported gain/mute/solo presentation removed. Export audio semantics unchanged. | Real audible recording remains release verification. |
| UI-009 | Typed loading/no-audio/unavailable/silent/decoded states; native zero-track source says No audio; browser/model fixtures preserve unknown and separate-sidecar uncertainty. | Broader native audible, sidecar and undecodable fixtures. |
| UI-010 | Saved timeline owns program duration; imported metadata and media duration fallback; native three-scene 12-second project. | Broader mixed-source duration fixtures. |
| UI-011 | Camera transforms only media. External two-row transport, preview volume/mute, seek and fullscreen have browser coverage. Native 1920x1080 fullscreen includes camera/controls; route changes preserve preview listening state and Saved. | Every aspect ratio/maximum zoom and audible native playback remain checks. |
| UI-012 | Shared ruler/track/playhead origin and zoom transform; timeline browser interaction tests. | Native high-zoom scrolling matrix. |
| UI-013 | Scene number/interval, actual thumbnails, camera-key count; WebKit native thumbnails and browser decode tests. | Long-project usability and scene naming beyond stable scene numbers. |
| UI-014 | Named selection, Back to project, route-specific inspector; selection model and shell tests. | VoiceOver route transitions. |
| UI-015 | Named scene/source interval, camera values, distinct inherited/static states and undoable Reset; rendered inspector and history coverage. | Full manual camera key authoring remains a roadmap feature. |
| UI-016 | Explicit range/endpoints, invalid guards and associated field errors, Edit trim; browser tests and exact 5-second native output. Native Discard resets range to Full program 0..12. | Rendered vertical-file comparison remains separate from horizontal range proof. |
| UI-017 | Shared Deliver composition preview, selected output size and one settings location; route/browser tests. | Native 9:16 preset visibly changes the output composition; a rendered vertical-file comparison remains a release check. |
| UI-018 | Pending and returned job states, safe Open/Reveal; host unit tests, native output/actions. | Long-running percentage/cancellation are not advertised. |
| UI-019 | Filename Save As and titled export-folder chooser; picker tests, native Save As and selected export. | Windows/Linux keep truthful fallback dialogs. |
| UI-020 | Fixed notice area, dismiss action, retained errors; native before/after route evidence and shell tests. | Long validation/error text at minimum pane sizes. |
| UI-021 | Readable validation reason and recovery copy; invalid/version/stale/range tests and native valid import. | Every error family in German native rendering. |
| UI-022 | Current/proposed summary, scene/version preview heading, selected row, focus movement and isolated playback; browser apply and native 12-to-11-second review. | Native apply is not performed against the preserved original demo. |
| UI-023 | Revised pane defaults, stable notices, two-row transport and fixed Export footer; native 1100x760 Edit and Deliver show usable controls and all three Deliver lanes. | Manual Events-lane scrolling was not established. Every pane combination, minimum-height scroll/focus and long-project layout remain acceptance work. |
| UI-024 | Shared property rows, typography/control spacing, quieter nested borders; packaged screenshots and source rules. | Independent visual judgment. |
| UI-025 | Field labels, pressed state, separators, focus/error semantics; keyboard/browser and native AX inspection. | VoiceOver listening, contrast preference and full assistive-tech matrix. |
| UI-026 | Global Preferences, localized binding/current-default description, conflict/reset tests; native/browser settings. | German native Preferences layout is captured; full error/conflict matrix remains a release check. |
| UI-027 | Explicit media error/Retry, automatic new-lease recovery; real browser video error/retry regression. | Native source-file removal during an open session. |
| UI-028 | Visible Guerilla Glass brand, desktop fixed-dark policy, web auto/explicit policy; system-change tests/browser proof. | Development executable remains Guerillaglass-dev for bundle compatibility. |
| UI-029 | Public root decoupled from auth, real root/About/404 and outage unit tests. | Deployed hosting environment. |
| UI-030 | Replaced inactive pricing with actionable source/build information. | External GitHub installation availability remains upstream-owned. |
| UI-031 | Explicit Build from source CTA and platform guidance. No installer download claim. | Signed release packaging remains roadmap work. |
| UI-032 | Removed unshipped paid/team/hosted-product claims, source-reviewed localized copy. | Copy review against the shipped feature set. |
| UI-033 | Current packaged screenshot and actual native-rendered 12-second demonstration. | Native capture is not proven by browser-recorded source. |
| UI-034 | Shorter hero and visible first action at desktop/mobile sizes; actual route screenshots. | First-time-user observation. |
| UI-035 | Immediate static content, no shader/entrance chain; CSS/browser inspection. | Native OS reduced-motion emulation not performed. |
| UI-036 | Native dialog modal navigation, keyboard trap/Escape/return focus verified on real mobile-sized route. | Mobile screen-reader listening. |
| UI-037 | Inline details/summary FAQ, German mobile keyboard expansion and focus proof. | Mobile screen-reader listening. |
| UI-038 | Finished About/recovery pages; actual German About/404 at 390 px, full-viewport canvas. | Exhaustive light/dark route matrix. |
| UI-039 | Shared English/German copy, localized native dialogs/defaults and code-based host failures through JSON bridge transport; request-scoped web SSR, typecheck and native German Preferences. | Complete German native error/expanded-layout matrix. |
| UI-040 | Static local-asset backgrounds, actual composited contrast in both themes; no shader or remote imagery needed. | Full route/state contrast-preference matrix. |

## Selected checks

The listed checks passed on the implementation stages they cover. The integrated acceptance row reflects the second-review follow-up, including the six reproduced interaction defects. The focused unit rows identify their tested stages. Logs are retained under ignored `.tmp/ui-research`; screenshots below are committed so review does not depend on that directory. Follow-up edits must rerun affected checks.

| Check | Result |
| --- | --- |
| `bun run desktop:typecheck` | Passed. |
| `bun run desktop:acceptance` | 10 browser files, 118 tests passed; packaged runtime smoke passed with fatal-pattern/process cleanup checks. |
| Focused desktop unit selection | 27 files, 159 tests passed covering menus, source/media security, host dialogs, history/session transitions, localized file errors, layout, inspector, export authority and shutdown. |
| Third-review history/selection follow-up | 63 controller/browser cases and 11 focused model tests passed. Cases overlap acceptance and prior tests; counts are not summed. |
| Second-review transport and diagnostics units | 2 files, 10 tests passed; overlap earlier transport coverage and are not summed as unique tests. |
| Replacement dialog/controller/shell follow-up | 61 selected browser cases passed, including actual application dialog behavior. These overlap acceptance and are not added as unique tests. |
| Bridge disposal/graceful quit/engine API follow-up | 3 files, 20 tests passed. Counts overlap the focused selection and are not summed as unique tests. |
| `bun run gate:swift:fast` | Engine product compiled. |
| `swift test -j 2 --no-parallel --filter 'EngineProjectSaveTests|ProjectStoreTests'` | 12 selected native tests passed. |
| `bun run web:typecheck` and web test selection | Typecheck passed; 3 files, 8 tests passed. |
| `bun run web:build` | Production client/server build passed. |
| Shared UI typecheck | Passed. |

Repository, documentation, formatting, lint and diff checks are repeated before freezing. No engine wire contract changed, so protocol binding regeneration is not required. Full local gate was not requested. Full CI, Windows/Linux runtime behavior, native granted capture/audio and VoiceOver remain unclaimed.

## Retained screenshots

These are native-window captures or actual built-site captures. They contain test-only project names. Native OS dialog labels belong to the OS language, independently of the product locale.

| State | Evidence |
| --- | --- |
| Editor with selected camera scene and Saved identity | [desktop-edit.png](evidence/ui-pass/desktop-edit.png) |
| Smaller native editor | [desktop-small.png](evidence/ui-pass/desktop-small.png) |
| Fullscreen composition and external transport | [desktop-fullscreen.png](evidence/ui-pass/desktop-fullscreen.png) |
| Application replacement confirmation | [replacement-confirmation.png](evidence/ui-pass/replacement-confirmation.png) |
| Smaller Deliver with all lanes and Export footer | [desktop-deliver-small.png](evidence/ui-pass/desktop-deliver-small.png) |
| Permission-denied Capture | [desktop-capture-denied.png](evidence/ui-pass/desktop-capture-denied.png) |
| Inspector after undoing a selected split | [undo-selection.png](evidence/ui-pass/undo-selection.png) |
| Labeled collapsed-pane recovery | [restore-panel.png](evidence/ui-pass/restore-panel.png) |
| Actionable storyboard diagnostic | [proposal-diagnostic.png](evidence/ui-pass/proposal-diagnostic.png) |
| Readable proposal comparison | [proposal-review.png](evidence/ui-pass/proposal-review.png) |
| Isolated scene preview | [proposal-preview.png](evidence/ui-pass/proposal-preview.png) |
| Delivery with composition preview | [desktop-deliver.png](evidence/ui-pass/desktop-deliver.png) |
| Vertical output composition | [desktop-deliver-vertical.png](evidence/ui-pass/desktop-deliver-vertical.png) |
| Unsaved-work native quit guard | [quit-guard.png](evidence/ui-pass/quit-guard.png) |
| Native Save As filename | [save-as.png](evidence/ui-pass/save-as.png) |
| German native Preferences | [preferences-de.png](evidence/ui-pass/preferences-de.png) |
| German mobile website, dark | [web-mobile-de-dark.png](evidence/ui-pass/web-mobile-de-dark.png) |
| Inline German FAQ, dark | [web-faq-de-dark.png](evidence/ui-pass/web-faq-de-dark.png) |
| German About, light | [web-about-de-light.png](evidence/ui-pass/web-about-de-light.png) |
| German missing route, light | [web-not-found-de-light.png](evidence/ui-pass/web-not-found-de-light.png) |
