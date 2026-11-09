# UI review ledger

Reviewed 2026-11-08 against merged main `45245daf360d0bd352f28da39b5ddec6978931c1`.

The UI has a usable editor foundation, but too many controls expose implementation state instead of a clear user workflow. The first improvement pass should make actions trustworthy and discoverable. A visual restyle alone would leave the most serious problems in place.

## Scope and evidence

Every authored desktop/web TSX and stylesheet module was inspected, including all 43 shared component modules, their named subcomponents, providers, diagnostic canvas and native menu/dialog integration. The [coverage inventory](UI_REVIEW_INVENTORY.md) lists all 85 modules plus the desktop HTML entry, supporting logic, route/state coverage and verification gaps. Library-only controls were reviewed in source, not presented as live product screens.

The packaged macOS app was exercised with the permissioned Peekaboo GUI bridge and native accessibility controls. Evidence includes empty Capture/Edit, expanded panels, a saved synthetic project, scene selection, invalid and validated agent proposals, delivery presets and a successful native export. The source is an 8-second synthetic color recording; the edited program is 2.75 seconds. It proves UI behavior, not production editorial quality.

The existing development bundle from PR #189 was reused. Its reviewed UI source baseline `ba4c848` has no desktop/web/shared UI source differences from the merge commit above. No application rebuild was performed for this documentation pass.

The real web root failed while its configured local auth service was offline. Public components were then rendered unchanged in an ignored Vite/React fixture with the shared stylesheet, at 1280x800 and 390x844. All `web-*` images except `web-auth-unavailable.png` are component-fixture evidence. They do not establish deployed-site behavior or authenticated flows. The shader did not supply a visible background in that browser.

Native active recording, granted-source picking, VoiceOver, smaller native windows, light/contrast modes, reduced-motion emulation, Linux/Windows native behavior and persistent-media failure recovery were not live-verified. Those limits are explicit in the inventory. No new system permissions were granted and no production UI was changed.

## Tracking rules

- P1: incorrect output expectations, loss/recovery risk, blocked core task or serious accessibility failure. Resolve before calling the relevant workflow polished.
- P2: repeated confusion, avoidable work, missing orientation or significant visual/readability problems.
- P3: consistency or library maintenance without a demonstrated core-task failure.
- Status starts at `Open`. Use `In progress`, `Ready for verification`, `Verified` or `Deferred` with a reason. Add owner, PR and dated proof below the finding; retain the ID. A merged fix alone does not change the status to Verified.
- Findings describe one baseline. Reproduce before implementation if related code changes. Source-only findings need live regression proof as part of the fix.

## Implementation pass, 2026-11-08 and 2026-11-09

The current pass implements the [research direction](UI_IMPROVEMENT_RESEARCH.md). The [implementation evidence](UI_IMPLEMENTATION_EVIDENCE.md) records current fixes, packaged/browser proof and remaining acceptance limits for every ID. Findings are Ready for verification where implementation has matching evidence. The final pass added complete visual-setting history and explicit native quit protection. Remaining acceptance limits stay visible in the proof matrix. No finding is Verified solely because its source changed or a test passed. The final three-reviewer gate remains pending.

- Desktop work includes visible workflow/actions and project state, timeline Undo/Redo, replacement protection, truthful audio presentation, shared ruler/track geometry, scene/camera inspection, isolated proposal preview, consolidated output configuration and explicit export ranges.
- The website now renders independently of hosted auth, uses static contrast-safe styling, exposes honest source-build actions, removes unshipped paid claims, and uses accessible native navigation/FAQ controls. Its exported example uses browser source, not proof of native capture permissions.
- Three initial independent reviews scored the moving implementation 6.8, 7.0 and 7.1 out of 10. All failed the user's strictly-greater-than-9.5 PR gate. Their findings are being fixed. Final ratings must identify a frozen source revision and its verification evidence; no PR is prepared before all three pass.
- Native testing exposed an additional UI-019 data-safety blocker: Save As of a reopened project omitted its source assets. The fix also protects in-place Save and preflights missing sidecars before replacing destination files. Closing UI-019 requires native reopen/export proof, not just the new filename panel.
- Recent-project metadata does not grant filesystem access. Opening a recent package now requests a native picker grant for that host session instead of failing after the click or silently expanding authority.
- Saving an empty timeline is blocked because the existing persisted/native legacy format interprets an empty timeline as full source. Undo restores the draft. Export rejects empty and invalid ranges before opening the destination picker.

Validation, screenshots, render receipts and final review records will be reconciled here before PR preparation. Active native capture remains limited by the engine app's missing Screen Recording permission; the Peekaboo GUI bridge has its own granted observation/input permissions.

## Findings index

| ID | Priority | Area | Finding | Status |
| --- | --- | --- | --- | --- |
| [UI-001](#ui-001) | P2 | Orientation | The workflow is hidden behind icons | Ready for verification |
| [UI-002](#ui-002) | P1 | Capture | The recording action reads like a source selector | Ready for verification |
| [UI-003](#ui-003) | P1 | Orientation | Essential setup is hidden by default | Ready for verification |
| [UI-004](#ui-004) | P1 | State truth | Permission status can say ready when capture is unavailable | Ready for verification |
| [UI-005](#ui-005) | P2 | Language | User-facing copy describes implementation details | Ready for verification |
| [UI-006](#ui-006) | P1 | Project safety | Project identity and unsaved edits are not visible | Ready for verification |
| [UI-007](#ui-007) | P1 | Project safety | Timeline editing has no Undo/Redo history | Ready for verification |
| [UI-008](#ui-008) | P1 | State truth | Audio mixer and mute/solo controls are not connected to output | Ready for verification |
| [UI-009](#ui-009) | P1 | State truth | The audio waveform can depict mouse activity instead of sound | Ready for verification |
| [UI-010](#ui-010) | P1 | State truth | Saved projects report the wrong duration | Ready for verification |
| [UI-011](#ui-011) | P1 | Playback | Camera transforms also zoom and clip player controls | Ready for verification |
| [UI-012](#ui-012) | P1 | Timeline | The ruler and tracks use different coordinate systems | Ready for verification |
| [UI-013](#ui-013) | P2 | Timeline | Clips and gaps do not explain the story | Ready for verification |
| [UI-014](#ui-014) | P2 | Inspector | Selection replaces the inspector without a clear way back | Ready for verification |
| [UI-015](#ui-015) | P2 | Inspector | Applied scene cameras cannot be inspected in the editor | Ready for verification |
| [UI-016](#ui-016) | P1 | Delivery | Trim semantics are hidden and zero means two things | Ready for verification |
| [UI-017](#ui-017) | P2 | Delivery | Delivery duplicates metadata and removes the visual reference | Ready for verification |
| [UI-018](#ui-018) | P2 | Delivery | Export has no meaningful progress or completion actions | Ready for verification |
| [UI-019](#ui-019) | P2 | Project IO | Save As and export use a dialog titled Open | Ready for verification |
| [UI-020](#ui-020) | P2 | Feedback | Notices permanently move the workspace | Ready for verification |
| [UI-021](#ui-021) | P2 | Agent editing | Proposal validation hides the actionable reason | Ready for verification |
| [UI-022](#ui-022) | P2 | Agent editing | Proposal review requires interpreting a technical diff | Ready for verification |
| [UI-023](#ui-023) | P2 | Layout | Route changes can leave panels too small to use | Ready for verification |
| [UI-024](#ui-024) | P2 | Visual system | Borders and small type flatten the hierarchy | Ready for verification |
| [UI-025](#ui-025) | P1 | Accessibility | Several fields and mode toggles lack complete semantics | Ready for verification |
| [UI-026](#ui-026) | P2 | Settings | Application preferences are buried in Capture | Ready for verification |
| [UI-027](#ui-027) | P2 | Recovery | Missing media looks like an ordinary empty preview | Ready for verification |
| [UI-028](#ui-028) | P3 | Visual system | Brand and appearance conventions differ across the product | Ready for verification |
| [UI-029](#ui-029) | P1 | Web reliability | Auth failure can blank the public website | Ready for verification |
| [UI-030](#ui-030) | P1 | Web actions | Pricing buttons do nothing | Ready for verification |
| [UI-031](#ui-031) | P2 | Web actions | Download means visit the repository | Ready for verification |
| [UI-032](#ui-032) | P1 | Product truth | The website sells hosted features that have no product screens | Ready for verification |
| [UI-033](#ui-033) | P2 | Web design | The landing page never demonstrates the product | Ready for verification |
| [UI-034](#ui-034) | P2 | Web layout | The hero hides the useful first action below long copy | Ready for verification |
| [UI-035](#ui-035) | P2 | Motion | Animation delays access and ignores reduced motion | Ready for verification |
| [UI-036](#ui-036) | P1 | Web accessibility | The mobile drawer is not an accessible modal navigation | Ready for verification |
| [UI-037](#ui-037) | P2 | Web accessibility | Mobile FAQ questions and answers are separated | Ready for verification |
| [UI-038](#ui-038) | P2 | Web completeness | About and error pages retain starter-template content | Ready for verification |
| [UI-039](#ui-039) | P2 | Localization | Web and shared defaults bypass product localization | Ready for verification |
| [UI-040](#ui-040) | P1 | Web contrast | There is no safe background when the shader is absent | Ready for verification |

## Recommended implementation order

The [UI improvement research](UI_IMPROVEMENT_RESEARCH.md) maps official competitor patterns and [Emil Kowalski's guidance](audits/2026-11-08-emil-kowalski-ui-guidance.md) to all 40 findings. It proposes screen behavior, component rules and focused implementation slices. Research does not change finding status; the acceptance criteria below still require implementation and dated proof.

1. **Trust and recovery.** Permission state, real audio/waveform behavior, program/source duration, unsaved-work protection, undo and stable playback controls. Resolve the ruler/trim inconsistencies in the same editor workstream.
2. **The main workflow.** Labeled Capture/Edit/Deliver, explicit Record/Stop, exposed source setup and project entry, clear empty states, usable persisted layouts and task-oriented copy.
3. **Editing and delivery.** Scene identity, inspector continuity, inspectable cameras, visual proposal review, one coherent export configuration, progress and completion actions.
4. **The visual system.** Readable type, fewer nested containers, consistent controls, reliable focus/state labels, preferences and localized copy. Apply this across workflows rather than redesigning isolated cards.
5. **The public website.** Auth-independent public rendering, honest availability, working CTAs/downloads, real product footage, mobile navigation/FAQ, restrained motion and safe contrast.

Keep these as separate reviewable slices. The existing Phase 2 roadmap remains the feature tracker; this ledger records UI defects and acceptance criteria. The later complete Phase 2 polish/performance/accessibility gate remains open.

## Detailed findings

<a id="ui-001"></a>

### UI-001: The workflow is hidden behind icons

P2 · Orientation · Ready for verification

Capture, Edit and Deliver are 28 px icon links. Save, export, refresh and layout controls form another undifferentiated icon row. The selected icon does not explain the current task.

Native + source. Source: [StudioShellHeader.tsx:85](../apps/desktop-electrobun/src/mainview/app/studio/layout/StudioShellHeader.tsx). Screenshot: [desktop-initial.png](evidence/ui-review/desktop-initial.png).

**Improvement:** Use labeled workflow navigation and a separate, quieter utility group.

**Acceptance:** A first-time user can identify the current step and reach the next one without hovering.

Owner: UI improvement pass. Fix PR: not prepared, three-reviewer gate pending. Verification: [2026-11-09 implementation evidence and remaining limits](UI_IMPLEMENTATION_EVIDENCE.md#finding-by-finding-proof).

<a id="ui-002"></a>

### UI-002: The recording action reads like a source selector

P1 · Capture · Ready for verification

The primary recording button says Window or Display. Clicking it starts recording. The adjacent arrow offers three start-recording actions. A play icon sits beside it, despite controlling timeline playback.

Native + source. Source: [StudioShellHeader.tsx:287](../apps/desktop-electrobun/src/mainview/app/studio/layout/StudioShellHeader.tsx). Screenshot: [capture-permissions.png](evidence/ui-review/capture-permissions.png).

**Improvement:** Separate source choice from a labeled Record action. Show the exact target, microphone state and recording status together.

**Acceptance:** Source selection does not start recording; Record and Stop have explicit visible labels and distinct states.

Owner: UI improvement pass. Fix PR: not prepared, three-reviewer gate pending. Verification: [2026-11-09 implementation evidence and remaining limits](UI_IMPLEMENTATION_EVIDENCE.md#finding-by-finding-proof).

<a id="ui-003"></a>

### UI-003: Essential setup is hidden by default

P1 · Orientation · Ready for verification

All route presets collapse the left pane. Every ordinary DesktopPanelSection also starts closed. Capture source and permissions, project open/recents, and delivery summary require discovering a toolbar icon and then opening a section. Reset Layout restores this.

Native + source. Source: [studioLayoutModel.ts:113](../apps/desktop-electrobun/src/mainview/app/studio/contracts/studioLayoutModel.ts). Screenshot: [desktop-initial.png](evidence/ui-review/desktop-initial.png).

**Improvement:** Keep essential controls exposed. Collapse optional detail rather than the route entry point.

**Acceptance:** Fresh launch and Reset Layout expose source setup or Record/Open actions. A collapsed pane has a labeled restore affordance at its edge.

Owner: UI improvement pass. Fix PR: not prepared, three-reviewer gate pending. Verification: [2026-11-09 implementation evidence and remaining limits](UI_IMPLEMENTATION_EVIDENCE.md#finding-by-finding-proof).

<a id="ui-004"></a>

### UI-004: Permission status can say ready when capture is unavailable

P1 · State truth · Ready for verification

The native accessibility tree says Screen Permission Ready while the capture panel says Screen not granted and Input Monitoring unknown. The badge always renders the ready label. Loading, denied and failed queries also lack a distinct setup state.

Native + source. Source: [StudioShellHeader.tsx:491](../apps/desktop-electrobun/src/mainview/app/studio/layout/StudioShellHeader.tsx). Screenshot: [capture-permissions.png](evidence/ui-review/capture-permissions.png).

**Improvement:** Model checking, granted, denied and unavailable states separately. Make the badge open the relevant recovery instructions.

**Acceptance:** Badge, source list and permission panel agree; screen-reader text matches the visible state; failed checks offer Retry without pretending a permission decision occurred.

Owner: UI improvement pass. Fix PR: not prepared, three-reviewer gate pending. Verification: [2026-11-09 implementation evidence and remaining limits](UI_IMPLEMENTATION_EVIDENCE.md#finding-by-finding-proof).

<a id="ui-005"></a>

### UI-005: User-facing copy describes implementation details

P2 · Language · Ready for verification

Edit says Capture and recording state is live from the native engine. Deliver says Type-safe delivery form with validation-ready shape. Empty Edit tells users to Start preview without an in-screen action. Project inspector repeats live-preview copy for saved footage.

Native + source. Source: [en-US.json:39](../messages/en-US.json). Screenshot: [deliver.png](evidence/ui-review/deliver.png).

**Improvement:** Write each state around the current task and provide its next action. Remove implementation commentary and duplicate subtitles.

**Acceptance:** Every empty state offers a working action; saved-project copy describes editing; no production UI says type-safe, validation-ready, scaffold or native engine.

Owner: UI improvement pass. Fix PR: not prepared, three-reviewer gate pending. Verification: [2026-11-09 implementation evidence and remaining limits](UI_IMPLEMENTATION_EVIDENCE.md#finding-by-finding-proof).

<a id="ui-006"></a>

### UI-006: Project identity and unsaved edits are not visible

P1 · Project safety · Ready for verification

The window title is always Guerillaglass. The project name lives in a hidden panel. Dirty timeline state exists for proposal gating, but the shell has no saved/unsaved indicator. Open Project and Open Recent replace the draft without a dirty-project decision in their renderer flow.

Source; identity also native. Source: [useStudioMutations.ts:536](../apps/desktop-electrobun/src/mainview/app/studio/hooks/core/useStudioMutations.ts).

**Improvement:** Keep project name and save state in the shell. Add a Save/Discard/Cancel decision before replacing unsaved work or quitting.

**Acceptance:** Modify a clip or visual setting, then open another project or quit. Save preserves the edit, Discard is explicit, Cancel keeps the current workspace. Opening is tested separately from overwriting a destination.

Owner: UI improvement pass. Fix PR: not prepared, three-reviewer gate pending. Verification: [2026-11-09 implementation evidence and remaining limits](UI_IMPLEMENTATION_EVIDENCE.md#finding-by-finding-proof).

<a id="ui-007"></a>

### UI-007: Timeline editing has no Undo/Redo history

P1 · Project safety · Ready for verification

The native Edit menu uses generic undo/redo roles. Timeline commands replace a single draft without an edit-history stack or app undo command. Lift, delete, split and move are exposed as ordinary actions.

Source. Source: [useStudioController.ts:365](../apps/desktop-electrobun/src/mainview/app/studio/hooks/core/useStudioController.ts).

**Improvement:** Add document-level undo/redo and wire menu, keyboard and visible action state to it.

**Acceptance:** Split, move, lift, delete and effect changes can each be undone and redone with matching preview and persisted output. Disabled history actions accurately reflect availability.

Owner: UI improvement pass. Fix PR: not prepared, three-reviewer gate pending. Verification: [2026-11-09 implementation evidence and remaining limits](UI_IMPLEMENTATION_EVIDENCE.md#finding-by-finding-proof).

<a id="ui-008"></a>

### UI-008: Audio mixer and mute/solo controls are not connected to output

P1 · State truth · Ready for verification

Master/Mic gain and mute are local React state. Lane mute/solo likewise update UI state; mute changes track styling. These values do not reach the player, save or export request. Mixer VU levels are deliberately fixed at zero. Lane locking does affect selection and commands and is not part of this finding.

Native control inspection + source trace. Source: [useStudioTimeline.ts:99](../apps/desktop-electrobun/src/mainview/app/studio/hooks/timeline/useStudioTimeline.ts).

**Improvement:** Wire supported audio operations through preview, persistence and export, or remove/disable the controls with an honest explanation. Do not display zero as a measured signal.

**Acceptance:** An audible fixture proves each supported gain/mute/solo operation in preview and exported audio after reopening. Unsupported controls cannot appear functional.

Owner: UI improvement pass. Fix PR: not prepared, three-reviewer gate pending. Verification: [2026-11-09 implementation evidence and remaining limits](UI_IMPLEMENTATION_EVIDENCE.md#finding-by-finding-proof).

<a id="ui-009"></a>

### UI-009: The audio waveform can depict mouse activity instead of sound

P1 · State truth · Ready for verification

When audio decoding fails or has not completed, useTimelineWaveform falls back to buildEventWaveform. Cursor/click density is then drawn in the Audio lane using the same waveform treatment, with no visible provenance.

Source. Source: [useTimelineWaveform.ts:175](../apps/desktop-electrobun/src/mainview/app/studio/hooks/timeline/useTimelineWaveform.ts).

**Improvement:** Show loading, no-audio and unavailable-waveform states. Keep event density in the Events lane.

**Acceptance:** Silent, audio-free, undecodable and audible fixtures are visually distinguishable. An Audio waveform always derives from decoded audio.

Owner: UI improvement pass. Fix PR: not prepared, three-reviewer gate pending. Verification: [2026-11-09 implementation evidence and remaining limits](UI_IMPLEMENTATION_EVIDENCE.md#finding-by-finding-proof).

<a id="ui-010"></a>

### UI-010: Saved projects report the wrong duration

P1 · State truth · Ready for verification

An 8-second source with a 2.75-second program reports Duration 00:00:00 in Edit, Project and Deliver. Those read the live capture duration rather than saved media or timeline duration. Recording URL is given more prominence than useful project information.

Native + source. Source: [EditRoute.tsx:178](../apps/desktop-electrobun/src/mainview/app/studio/routes/EditRoute.tsx). Screenshot: [edit-loaded.png](evidence/ui-review/edit-loaded.png).

**Improvement:** Expose program duration and source duration with clear labels, backed by authoritative metadata. Move paths into file details with reveal/copy actions.

**Acceptance:** Reopen a reordered/trimmed project. All program-duration readouts agree with the timeline and export; source duration stays distinct and never silently becomes zero.

Owner: UI improvement pass. Fix PR: not prepared, three-reviewer gate pending. Verification: [2026-11-09 implementation evidence and remaining limits](UI_IMPLEMENTATION_EVIDENCE.md#finding-by-finding-proof).

<a id="ui-011"></a>

### UI-011: Camera transforms also zoom and clip player controls

P1 · Playback · Ready for verification

Scene camera CSS transforms the video element that owns native controls. In the loaded 2x scene, the giant play overlay is clipped against the right edge. Native source transport also competes with the timeline transport.

Native + source. Source: [useSceneCameraPreview.ts:55](../apps/desktop-electrobun/src/mainview/app/studio/hooks/useSceneCameraPreview.ts). Screenshot: [edit-loaded.png](evidence/ui-review/edit-loaded.png).

**Improvement:** Transform only image content. Place stable program-time transport outside the transformed video and crop.

**Acceptance:** Play, pause, seek, volume and fullscreen remain visible and usable for every camera key and aspect ratio, including at 3x zoom and across cuts/gaps.

Owner: UI improvement pass. Fix PR: not prepared, three-reviewer gate pending. Verification: [2026-11-09 implementation evidence and remaining limits](UI_IMPLEMENTATION_EVIDENCE.md#finding-by-finding-proof).

<a id="ui-012"></a>

### UI-012: The ruler and tracks use different coordinate systems

P1 · Timeline · Ready for verification

The ruler spans the entire pane, including the 152 px lane-label gutter. Clips and playhead start after that gutter. Zoom expands only the scrollable tracks while the ruler remains outside the scroller. Zero and clip boundaries therefore disagree with the printed time axis.

Native + source. Source: [TimelineSurface.tsx:1117](../apps/desktop-electrobun/src/mainview/app/studio/panels/TimelineSurface.tsx). Screenshot: [export-result.png](evidence/ui-review/export-result.png).

**Improvement:** Put ruler, tracks, overlays and pointer conversion on one shared time origin and scroll/zoom model.

**Acceptance:** At 100%, 200% and 300%, known boundaries align with ruler ticks before and after horizontal scrolling. Zero is fully visible and seeking matches the labeled time.

Owner: UI improvement pass. Fix PR: not prepared, three-reviewer gate pending. Verification: [2026-11-09 implementation evidence and remaining limits](UI_IMPLEMENTATION_EVIDENCE.md#finding-by-finding-proof).

<a id="ui-013"></a>

### UI-013: Clips and gaps do not explain the story

P2 · Timeline · Ready for verification

Every clip says VIDEO or AUDIO plus duration. Gaps use the same lane label. There are no thumbnails, scene titles, source ranges or visible camera indicators. A successful agent handoff loses its editorial meaning once the modal closes.

Native + source. Source: [TimelineSurface.tsx:882](../apps/desktop-electrobun/src/mainview/app/studio/panels/TimelineSurface.tsx). Screenshot: [export-result.png](evidence/ui-review/export-result.png).

**Improvement:** Use a distinct gap label, scene names and useful visual or source context. Preserve scene identity through proposal, timeline and inspector.

**Acceptance:** A user can locate a named proposed scene and an intentional pause without memorizing durations. Camera overrides are indicated; labels remain legible at supported zoom levels.

Owner: UI improvement pass. Fix PR: not prepared, three-reviewer gate pending. Verification: [2026-11-09 implementation evidence and remaining limits](UI_IMPLEMENTATION_EVIDENCE.md#finding-by-finding-proof).

<a id="ui-014"></a>

### UI-014: Selection replaces the inspector without a clear way back

P2 · Inspector · Ready for verification

Selecting a clip removes global Effects controls. Carrying that selection into Deliver shows clip actions instead of export context. The escape path is blank-space clicking or Escape, neither explained in the inspector.

Native + source. Source: [InspectorPanel.tsx:32](../apps/desktop-electrobun/src/mainview/app/studio/panels/InspectorPanel.tsx). Screenshot: [deliver-selected.png](evidence/ui-review/deliver-selected.png).

**Improvement:** Separate document settings from selected-item properties. Provide visible deselection/back context and reset incompatible selections on mode changes.

**Acceptance:** Select video, audio, marker and preset states, then navigate modes. Current selection is named, global settings remain discoverable, and Deliver opens relevant delivery controls.

Owner: UI improvement pass. Fix PR: not prepared, three-reviewer gate pending. Verification: [2026-11-09 implementation evidence and remaining limits](UI_IMPLEMENTATION_EVIDENCE.md#finding-by-finding-proof).

<a id="ui-015"></a>

### UI-015: Applied scene cameras cannot be inspected in the editor

P2 · Inspector · Ready for verification

A selected camera-bearing clip exposes lane, timing and structural actions only. It gives no camera summary, reset/inheritance state or keyframe view. This is the remaining inspector work already acknowledged in the roadmap.

Native + source; planned authoring gap. Source: [SelectionDetails.tsx:44](../apps/desktop-electrobun/src/mainview/app/studio/panels/inspector/SelectionDetails.tsx).

**Improvement:** Add an inspectable per-scene camera section before a larger camera authoring tool. Distinguish automatic camera, inherited settings and explicit overrides.

**Acceptance:** Select scenes with different cameras and verify readable values, preview correspondence, reset behavior and persistence. No manual-authoring completion is claimed until controls exist.

Owner: UI improvement pass. Fix PR: not prepared, three-reviewer gate pending. Verification: [2026-11-09 implementation evidence and remaining limits](UI_IMPLEMENTATION_EVIDENCE.md#finding-by-finding-proof).

<a id="ui-016"></a>

### UI-016: Trim semantics are hidden and zero means two things

P1 · Delivery · Ready for verification

Trim tools and handles appear only in Deliver. Trim Out displays 0 in the form, summaries and footer, yet the overlay spans the full program and export omits zero to mean full duration. The UI suggests a zero-length range while exporting 2.75 seconds.

Native + source. Source: [useStudioMutations.ts:651](../apps/desktop-electrobun/src/mainview/app/studio/hooks/core/useStudioMutations.ts). Screenshot: [export-result.png](evidence/ui-review/export-result.png).

**Improvement:** Display the effective program range, duration and scope. Place ordinary scene trimming in Edit and make export-range trimming explicit.

**Acceptance:** A default export visibly states the whole program. In/out ordering is validated inline. Handles, fields, keyboard actions, duration and the resulting file agree.

Owner: UI improvement pass. Fix PR: not prepared, three-reviewer gate pending. Verification: [2026-11-09 implementation evidence and remaining limits](UI_IMPLEMENTATION_EVIDENCE.md#finding-by-finding-proof).

<a id="ui-017"></a>

### UI-017: Delivery duplicates metadata and removes the visual reference

P2 · Delivery · Ready for verification

Preset and trim settings appear in the center, left summary, right inspector and footer. The center contains large full-width form fields while users must switch back to Edit to inspect framing for a new aspect ratio. Capture Resolution in the right inspector actually shows 16:9.

Native + source. Source: [DeliverRoute.tsx:20](../apps/desktop-electrobun/src/mainview/app/studio/routes/DeliverRoute.tsx). Screenshot: [deliver.png](evidence/ui-review/deliver.png).

**Improvement:** Make one delivery configuration with an output preview and a compact destination/range/format summary. Show pixel dimensions, frame rate and codec accurately.

**Acceptance:** Changing 16:9 to 9:16 shows the resulting composition before export. Each setting has one editing location; summaries carry distinct useful information.

Owner: UI improvement pass. Fix PR: not prepared, three-reviewer gate pending. Verification: [2026-11-09 implementation evidence and remaining limits](UI_IMPLEMENTATION_EVIDENCE.md#finding-by-finding-proof).

<a id="ui-018"></a>

### UI-018: Export has no meaningful progress or completion actions

P2 · Delivery · Ready for verification

During a native export the controls disabled, without an operation label or progress presentation. Success became a persistent sentence containing a raw file path. There is no Open file, Reveal in Finder, cancel or job history.

Native + source. Source: [useStudioMutations.ts:623](../apps/desktop-electrobun/src/mainview/app/studio/hooks/core/useStudioMutations.ts). Screenshot: [export-result.png](evidence/ui-review/export-result.png).

**Improvement:** Add an export operation state and an actionable completion result. Use indeterminate progress if reliable percentage is unavailable.

**Acceptance:** A longer export clearly shows running/success/failure states. Users can locate or open the output and retry a failure without re-entering settings.

Owner: UI improvement pass. Fix PR: not prepared, three-reviewer gate pending. Verification: [2026-11-09 implementation evidence and remaining limits](UI_IMPLEMENTATION_EVIDENCE.md#finding-by-finding-proof).

<a id="ui-019"></a>

### UI-019: Save As and export use a dialog titled Open

P2 · Project IO · Ready for verification

The host uses openFileDialog for project Save As and export destination selection. Save As infers the package name from the existing project or a fixed fallback, so there is no normal filename entry. The native export destination dialog says Open.

Native export/open + source Save As. Source: [picker.ts:263](../apps/desktop-electrobun/src/bun/path/picker.ts).

**Improvement:** Use a named save flow for projects and a clearly labeled destination choice for export. Explain package behavior and overwrite choices in product language.

**Acceptance:** Save As lets the user name a new project and see the full intended target before committing. Cancel and overwrite behave predictably; export destination selection is unmistakable.

Owner: UI improvement pass. Fix PR: not prepared, three-reviewer gate pending. Verification: [2026-11-09 implementation evidence and remaining limits](UI_IMPLEMENTATION_EVIDENCE.md#finding-by-finding-proof).

<a id="ui-020"></a>

### UI-020: Notices permanently move the workspace

P2 · Feedback · Ready for verification

Project opened and Export complete occupy the same full-width persistent Alert strip used for errors. It changes the available editor height and does not offer dismissal. Success, information and actionable failure lack different lifetimes.

Native + source. Source: [StudioShellLayout.tsx:70](../apps/desktop-electrobun/src/mainview/app/studio/layout/StudioShellLayout.tsx). Screenshot: [export-result.png](evidence/ui-review/export-result.png).

**Improvement:** Use quiet nonblocking success feedback and persistent, dismissible recovery messages where necessary. Reserve layout space for state that affects work.

**Acceptance:** Opening, saving and exporting do not unexpectedly resize preview/timeline. Errors retain recovery actions and success can be dismissed or expires accessibly.

Owner: UI improvement pass. Fix PR: not prepared, three-reviewer gate pending. Verification: [2026-11-09 implementation evidence and remaining limits](UI_IMPLEMENTATION_EVIDENCE.md#finding-by-finding-proof).

<a id="ui-021"></a>

### UI-021: Proposal validation hides the actionable reason

P2 · Agent editing · Ready for verification

Malformed JSON gets a generic checklist. Native validation errors are caught and reduced to Proposal validation failed, discarding whether the source changed, the revision is stale or a range is invalid. Apply failure is similarly generic.

Native invalid state + source. Source: [AgentProposalPanel.tsx:126](../apps/desktop-electrobun/src/mainview/app/studio/panels/AgentProposalPanel.tsx).

**Improvement:** Preserve structured failure reasons and identify affected scenes/fields. Distinguish stale project/source from invalid content.

**Acceptance:** Bad JSON, unsupported version, duplicate scene, out-of-range source, stale revision and busy project each explain a specific recovery step.

Owner: UI improvement pass. Fix PR: not prepared, three-reviewer gate pending. Verification: [2026-11-09 implementation evidence and remaining limits](UI_IMPLEMENTATION_EVIDENCE.md#finding-by-finding-proof).

<a id="ui-022"></a>

### UI-022: Proposal review requires interpreting a technical diff

P2 · Agent editing · Ready for verification

The modal leads with Import and JSON. Review is a small four-column table of IDs, source seconds and camera key counts. Camera values are hidden in per-cell details. There is no proposed program preview, thumbnail comparison, duration summary or jump to a scene.

Native validated state + source. Source: [AgentProposalPanel.tsx:245](../apps/desktop-electrobun/src/mainview/app/studio/panels/AgentProposalPanel.tsx). Screenshot: [agent-proposal.png](evidence/ui-review/agent-proposal.png).

**Improvement:** Lead with brief, changed-scene summary and previewable before/after evidence. Keep JSON and raw camera keys as optional details. Retain revision validation and explicit apply confirmation.

**Acceptance:** A user can review one changed scene visually, identify additions/removals/reorders, see total duration change and apply only the validated proposal.

Owner: UI improvement pass. Fix PR: not prepared, three-reviewer gate pending. Verification: [2026-11-09 implementation evidence and remaining limits](UI_IMPLEMENTATION_EVIDENCE.md#finding-by-finding-proof).

<a id="ui-023"></a>

### UI-023: Route changes can leave panels too small to use

P2 · Layout · Ready for verification

After Capture to Edit, the timeline shrank so only the top of its first lane was visible until Reset Layout. Reopening a left pane produced a roughly 150 px column with wrapped labels and clipped path cards. The toolbar and timeline hide horizontal scrollbars. Narrow native-window behavior remains a follow-up verification item.

Native at default window + source. Source: [EditorWorkspace.tsx:21](../apps/desktop-electrobun/src/mainview/app/studio/layout/EditorWorkspace.tsx). Screenshot: [edit-loaded.png](evidence/ui-review/edit-loaded.png).

**Improvement:** Give every mode a usable minimum layout and a visible overflow policy. Persist intentional pane changes without importing unusable route dimensions.

**Acceptance:** Repeated Capture/Edit/Deliver navigation, hide/show and reset keep all lanes and required controls reachable at the documented minimum window size and at 1320x860.

Owner: UI improvement pass. Fix PR: not prepared, three-reviewer gate pending. Verification: [2026-11-09 implementation evidence and remaining limits](UI_IMPLEMENTATION_EVIDENCE.md#finding-by-finding-proof).

<a id="ui-024"></a>

### UI-024: Borders and small type flatten the hierarchy

P2 · Visual system · Ready for verification

Tiny uppercase section bars, framed option cards, framed toolbar groups and individual bordered buttons repeat at every level. Section headings are 10 px; metadata is often 11-12 px. A large empty inspector can coexist with controls hidden in accordions.

Native + source. Source: [index.css:329](../apps/desktop-electrobun/src/mainview/index.css). Screenshot: [capture-permissions.png](evidence/ui-review/capture-permissions.png).

**Improvement:** Define readable type, spacing, control and pane tiers. Use plain aligned rows for ordinary properties; reserve containers and emphasis for actual groups and primary actions.

**Acceptance:** Capture, selected clip, effects, proposal and Deliver use the same documented type/spacing/control scale. Essential labels remain readable in comfortable mode without opening every section.

Owner: UI improvement pass. Fix PR: not prepared, three-reviewer gate pending. Verification: [2026-11-09 implementation evidence and remaining limits](UI_IMPLEMENTATION_EVIDENCE.md#finding-by-finding-proof).

<a id="ui-025"></a>

### UI-025: Several fields and mode toggles lack complete semantics

P1 · Accessibility · Ready for verification

Native AX exposes unnamed Window/Preset selects, filename and numeric fields. FieldLabel is a sibling without htmlFor at these call sites. Select/Blade/Snap/Ripple buttons indicate state mainly through color without aria-pressed. Both lanes reuse Lock lane/Mute lane/Solo lane labels without naming the lane.

Native AX + source. Source: [InspectorPrimitives.tsx:195](../apps/desktop-electrobun/src/mainview/app/studio/panels/inspector/InspectorPrimitives.tsx).

**Improvement:** Associate every field with a stable label and description, expose toggle/tool state and include item context in repeated action names.

**Acceptance:** Keyboard and VoiceOver identify every field, active tool, snap/ripple state and lane control unambiguously. Errors are associated with their fields. Selection and focus remain distinguishable.

Owner: UI improvement pass. Fix PR: not prepared, three-reviewer gate pending. Verification: [2026-11-09 implementation evidence and remaining limits](UI_IMPLEMENTATION_EVIDENCE.md#finding-by-finding-proof).

<a id="ui-026"></a>

### UI-026: Application preferences are buried in Capture

P2 · Settings · Ready for verification

Shortcut customization lives under Capture > Advanced. Each of eight cards repeats the same long workstation explanation. Every change button is named Record, which competes with the product recording action. Language and density are menu-only; no common preferences location exists.

Native + source. Source: [ShortcutOverridesSection.tsx:52](../apps/desktop-electrobun/src/mainview/app/studio/panels/inspector/ShortcutOverridesSection.tsx). Screenshot: [capture-shortcuts.png](evidence/ui-review/capture-shortcuts.png).

**Improvement:** Provide an accessible Preferences/Shortcuts destination. Explain recording a key once, use Change shortcut labels and keep recording-only settings in Capture.

**Acceptance:** From Edit or Deliver, users can find shortcut/language/density settings without switching into recording. Conflict, cancel, reset and the current/default binding are clear.

Owner: UI improvement pass. Fix PR: not prepared, three-reviewer gate pending. Verification: [2026-11-09 implementation evidence and remaining limits](UI_IMPLEMENTATION_EVIDENCE.md#finding-by-finding-proof).

<a id="ui-027"></a>

### UI-027: Missing media looks like an ordinary empty preview

P2 · Recovery · Ready for verification

Media resolver failures become null and therefore fall into the same No active preview branch as an empty project. A video error triggers one lease refresh, but persistent failure has no visible problem state or recovery action. Media Bin availability checks only whether a path string exists.

Source. Source: [useRecordingMediaSource.ts:26](../apps/desktop-electrobun/src/mainview/app/studio/hooks/useRecordingMediaSource.ts).

**Improvement:** Distinguish empty project, resolving media, missing file, decoder failure and engine unavailable. Offer retry/relink/reopen as supported.

**Acceptance:** A saved project with missing or unreadable media explains the failure without asking the user to record again. A successful retry clears the error and preserves the document.

Owner: UI improvement pass. Fix PR: not prepared, three-reviewer gate pending. Verification: [2026-11-09 implementation evidence and remaining limits](UI_IMPLEMENTATION_EVIDENCE.md#finding-by-finding-proof).

<a id="ui-028"></a>

### UI-028: Brand and appearance conventions differ across the product

P3 · Visual system · Ready for verification

The desktop title is Guerillaglass, the public brand is Guerilla Glass, and app strings also include Desktop Editor Shell. Desktop starts with a hard-coded dark root, while web initializes an automatic theme and shared providers use different preference conventions. Shared theme-provider does not observe system changes while mounted.

Native + fixture + source. Source: [theme-provider.tsx:29](../packages/ui/src/desktop/theme-provider.tsx).

**Improvement:** Choose canonical naming and an explicit theme ownership policy for each app. Treat the unused provider as library debt rather than a proven desktop runtime bug.

**Acceptance:** Product names are consistent. Each supported theme has a defined owner, persisted preference and tested live system-change behavior.

Owner: UI improvement pass. Fix PR: not prepared, three-reviewer gate pending. Verification: [2026-11-09 implementation evidence and remaining limits](UI_IMPLEMENTATION_EVIDENCE.md#finding-by-finding-proof).

<a id="ui-029"></a>

### UI-029: Auth failure can blank the public website

P1 · Web reliability · Ready for verification

The actual / route rendered only a developer-tools button after getToken failed against the configured local Convex auth service on 127.0.0.1:3211. The root beforeLoad awaits authentication before any public content. This is a local outage reproduction, not a claim about the deployed website.

Web route failure + source. Source: [__root.tsx:56](../apps/web/src/routes/__root.tsx). Screenshot: [web-auth-unavailable.png](evidence/ui-review/web-auth-unavailable.png).

**Improvement:** Keep public marketing routes renderable when hosted auth is unavailable. Add deliberate loading/error/retry treatment to authenticated routes.

**Acceptance:** With the auth service offline, /, /about and a missing route still render useful public content and navigation.

Owner: UI improvement pass. Fix PR: not prepared, three-reviewer gate pending. Verification: [2026-11-09 implementation evidence and remaining limits](UI_IMPLEMENTATION_EVIDENCE.md#finding-by-finding-proof).

<a id="ui-030"></a>

### UI-030: Pricing buttons do nothing

P1 · Web actions · Ready for verification

Choose Creator Pro, Choose Studio and Talk to Sales are ordinary buttons with no handler, link or submission. Clicking Choose Studio produced no next step. The surrounding page repeatedly asks users to buy.

Fixture click + source. Source: [Pricing.tsx:147](../apps/web/src/components/Pricing.tsx). Screenshot: [web-pricing.png](evidence/ui-review/web-pricing.png).

**Improvement:** Connect available purchase/contact paths, or present an honest unavailable/waitlist state until those flows exist.

**Acceptance:** Every CTA has an observable, intended outcome, accessible pending/error feedback where applicable, and a valid back path.

Owner: UI improvement pass. Fix PR: not prepared, three-reviewer gate pending. Verification: [2026-11-09 implementation evidence and remaining limits](UI_IMPLEMENTATION_EVIDENCE.md#finding-by-finding-proof).

<a id="ui-031"></a>

### UI-031: Download means visit the repository

P2 · Web actions · Ready for verification

All download CTAs open the repository root instead of a compatible release or an installation page. The main button also includes an unrelated Picsum image. There is no visible architecture, version or installation guidance.

Fixture link inspection + source. Source: [Hero.tsx:15](../apps/web/src/components/Hero.tsx).

**Improvement:** Send users to a supported release/download page with clear platform and installation requirements. Remove placeholder imagery.

**Acceptance:** Download for macOS reaches a usable release or explicit installation guide. Unsupported machines receive clear guidance before download.

Owner: UI improvement pass. Fix PR: not prepared, three-reviewer gate pending. Verification: [2026-11-09 implementation evidence and remaining limits](UI_IMPLEMENTATION_EVIDENCE.md#finding-by-finding-proof).

<a id="ui-032"></a>

### UI-032: The website sells hosted features that have no product screens

P1 · Product truth · Ready for verification

Hero, Features, FAQ and Pricing describe available review links, comments, presence, templates, seats and paid plans. The web route tree has only home, about and auth API; the roadmap still lists hosted sharing and billing rollout as unfinished. The page does not label these capabilities as planned.

Source + fixture. Source: [Pricing.tsx:17](../apps/web/src/components/Pricing.tsx). Screenshot: [web-pricing.png](evidence/ui-review/web-pricing.png).

**Improvement:** Align public claims and purchasing options with shipped capabilities. Separate future plans and external-agent review files from hosted collaboration.

**Acceptance:** Every available-feature claim maps to a working user journey. Planned features and prices cannot be mistaken for purchasable current functionality.

Owner: UI improvement pass. Fix PR: not prepared, three-reviewer gate pending. Verification: [2026-11-09 implementation evidence and remaining limits](UI_IMPLEMENTATION_EVIDENCE.md#finding-by-finding-proof).

<a id="ui-033"></a>

### UI-033: The landing page never demonstrates the product

P2 · Web design · Ready for verification

A full-screen animated shader, mountain photography, unrelated FAQ photos and decorative cards stand in for editor footage. Repeated workflow claims do not show capture setup, a timeline edit, camera polish or the resulting video.

Fixture + source. Source: [Features.tsx:24](../apps/web/src/components/Features.tsx). Screenshot: [web-product.png](evidence/ui-review/web-product.png).

**Improvement:** Use a real recording/editor/output demonstration as the main proof. Give each section a distinct question to answer and remove stock filler.

**Acceptance:** Within one screen and one short demo, a visitor can see what Guerilla Glass does, how the editor works and what its output looks like.

Owner: UI improvement pass. Fix PR: not prepared, three-reviewer gate pending. Verification: [2026-11-09 implementation evidence and remaining limits](UI_IMPLEMENTATION_EVIDENCE.md#finding-by-finding-proof).

<a id="ui-034"></a>

### UI-034: The hero hides the useful first action below long copy

P2 · Web layout · Ready for verification

At desktop size the first viewport is almost entirely headline. On mobile the hero is about 2139 px tall, with its download action far below the initial viewport. Each later section and even the small footer also reserves at least a viewport.

Fixture at 1280x800 and 390x844 + source. Source: [Hero.tsx:186](../apps/web/src/components/Hero.tsx). Screenshot: [web-mobile-hero.png](evidence/ui-review/web-mobile-hero.png).

**Improvement:** Shorten the promise, use a product visual and keep the primary action in the opening viewport. Size later sections to their content.

**Acceptance:** At common desktop and 390 px mobile sizes, product identity, a clear benefit, proof and the main action are visible without scrolling through a wall of headline.

Owner: UI improvement pass. Fix PR: not prepared, three-reviewer gate pending. Verification: [2026-11-09 implementation evidence and remaining limits](UI_IMPLEMENTATION_EVIDENCE.md#finding-by-finding-proof).

<a id="ui-035"></a>

### UI-035: Animation delays access and ignores reduced motion

P2 · Motion · Ready for verification

TimelineAnimation delays each item by animationNum * 0.5 seconds and initially hides/blurs content. Hero/footer children reach delays of 7.5 seconds. Shader animation is always on, FAQ panels slide, and MotionDrawer has spring/drag effects without a reduced-motion branch. Desktop has CSS motion accommodations; this finding concerns web.

Source; normal-motion fixture inspected. Source: [timeline-animation.tsx:31](../apps/web/src/components/timeline-animation.tsx).

**Improvement:** Make critical content immediately available, shorten nonessential entrances and honor reduced-motion preferences across JavaScript and shader animation.

**Acceptance:** With reduced motion, content and actions render immediately with no shader/slide/scale sequence. Normal motion never delays interaction or hides required information.

Owner: UI improvement pass. Fix PR: not prepared, three-reviewer gate pending. Verification: [2026-11-09 implementation evidence and remaining limits](UI_IMPLEMENTATION_EVIDENCE.md#finding-by-finding-proof).

<a id="ui-036"></a>

### UI-036: The mobile drawer is not an accessible modal navigation

P1 · Web accessibility · Ready for verification

Open/close icon buttons have no accessible names. The drawer lacks expanded/controls state, modal semantics, focus containment and Escape handling. Clicking FAQ navigates behind the still-open drawer; Escape did not close it. Background page content remains exposed.

Fixture interaction + source. Source: [motion-drawer.tsx:199](../apps/web/src/components/motion-drawer.tsx). Screenshot: [web-mobile-drawer.png](evidence/ui-review/web-mobile-drawer.png).

**Improvement:** Use the shared dialog/drawer behavior or implement equivalent keyboard, focus and background-inert handling. Close on navigation.

**Acceptance:** Keyboard and screen-reader users can open, navigate and close the menu. Escape closes it, focus returns to the trigger, and link selection reveals the destination.

Owner: UI improvement pass. Fix PR: not prepared, three-reviewer gate pending. Verification: [2026-11-09 implementation evidence and remaining limits](UI_IMPLEMENTATION_EVIDENCE.md#finding-by-finding-proof).

<a id="ui-037"></a>

### UI-037: Mobile FAQ questions and answers are separated

P2 · Web accessibility · Ready for verification

The stacked layout puts all six questions before the answer. At the FAQ anchor, the selected answer heading begins about 921 px down, beyond the 844 px viewport. Question buttons expose neither selected/expanded state nor the answer relationship; hover can replace the answer on desktop.

Fixture + source. Source: [FAQ.tsx:90](../apps/web/src/components/FAQ.tsx). Screenshot: [web-mobile-faq.png](evidence/ui-review/web-mobile-faq.png).

**Improvement:** Use inline accordions on small screens and explicit tab/selection semantics if the desktop split view remains. Remove unrelated answer imagery.

**Acceptance:** Activating any mobile question reveals its answer next to the question. Focus does not jump unexpectedly; the current answer is announced and navigation remains usable.

Owner: UI improvement pass. Fix PR: not prepared, three-reviewer gate pending. Verification: [2026-11-09 implementation evidence and remaining limits](UI_IMPLEMENTATION_EVIDENCE.md#finding-by-finding-proof).

<a id="ui-038"></a>

### UI-038: About and error pages retain starter-template content

P2 · Web completeness · Ready for verification

/about says A small starter with room to grow and describes TanStack Start. About and 404 reference page-wrap/island-shell/display-title and sea-ink variables without matching definitions in the loaded global stylesheet. The 404 hard-codes white text although the root can choose light mode.

Source; normal routes blocked by auth outage. Source: [about.tsx:13](../apps/web/src/routes/about.tsx).

**Improvement:** Replace starter copy with product/help content and design intentional missing-page and failure layouts using actual theme tokens.

**Acceptance:** About and 404 render correctly in light/dark and narrow layouts, explain the product or recovery path, and offer working navigation.

Owner: UI improvement pass. Fix PR: not prepared, three-reviewer gate pending. Verification: [2026-11-09 implementation evidence and remaining limits](UI_IMPLEMENTATION_EVIDENCE.md#finding-by-finding-proof).

<a id="ui-039"></a>

### UI-039: Web and shared defaults bypass product localization

P2 · Localization · Ready for verification

All public web copy is inline English, while the repo requires en-US/de-DE sources. Shared Dialog inserts Close; Spinner defaults to Loading; command/breadcrumb defaults contain more English. The native overwrite dialog hard-codes Replace Project/Replace/Cancel.

Source. Source: [dialog.tsx:65](../packages/ui/src/components/dialog.tsx).

**Improvement:** Move shipped copy to the common message sources and allow localized labels for shared defaults. Keep unused-library defaults in scope when they first ship.

**Acceptance:** German/English passes cover the complete shipped flow, including dialogs, accessible names, errors and expanded layouts. No generated Paraglide files are edited by hand.

Owner: UI improvement pass. Fix PR: not prepared, three-reviewer gate pending. Verification: [2026-11-09 implementation evidence and remaining limits](UI_IMPLEMENTATION_EVIDENCE.md#finding-by-finding-proof).

<a id="ui-040"></a>

### UI-040: There is no safe background when the shader is absent

P1 · Web contrast · Ready for verification

The fixture rendered a gray background when the shader supplied no visible image. Body defaults to white in light mode and each section overlays black at 45%, with white text above it. White on the observed #8c8c8c fallback is about 3.36:1, below 4.5:1 for normal body copy; translucent secondary text is worse. The default 404 has the same light-background risk.

Fixture fallback + source. Source: [Hero.tsx:74](../apps/web/src/components/Hero.tsx). Screenshot: [web-hero.png](evidence/ui-review/web-hero.png).

**Improvement:** Give text a deterministic contrast-safe base independent of WebGL, remote assets or theme timing. Treat the shader as optional decoration.

**Acceptance:** With WebGL disabled/unavailable and external imagery blocked, all body and control text meets its contrast target in both themes. Verify actual composited colors rather than tokens alone.

Owner: UI improvement pass. Fix PR: not prepared, three-reviewer gate pending. Verification: [2026-11-09 implementation evidence and remaining limits](UI_IMPLEMENTATION_EVIDENCE.md#finding-by-finding-proof).

## Keep what already works

The contiguous preview/timeline/inspector layout is a useful base. Shared controls already provide many focus, disabled and keyboard behaviors; the timeline uses pointer capture and throttling, and desktop CSS includes reduced-motion, high-contrast and forced-color provisions. Tokenized media access and local editing/export should remain intact. Proposal validation is tied to the exact source, saved revision and editor state, and applying requires explicit confirmation. Preserve those safeguards while making the review easier to understand.

## Validation of this audit

`bun run repo:check`, `bun run docs:check` and `git diff --check` passed. A separate coverage/link check confirmed all 85 inventoried modules, 40 unique finding IDs and the linked evidence files. No application code changed, so application builds, packaged acceptance and regression suites were not rerun. Live app observations are evidence for findings, not a substitute for regression tests when implementing fixes.
