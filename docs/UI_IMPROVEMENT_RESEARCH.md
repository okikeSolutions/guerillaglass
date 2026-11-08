# UI improvement research and proposed direction

Research date: 2026-11-08. Product baseline: merged main `45245daf360d0bd352f28da39b5ddec6978931c1`. Related evidence: [40-finding ledger](UI_REVIEW_LEDGER.md), [complete screen/component inventory](UI_REVIEW_INVENTORY.md), and [Emil Kowalski research](audits/2026-11-08-emil-kowalski-ui-guidance.md).

The editor needs clearer actions, reliable state and a stable workspace before it needs decorative polish. Keep Capture, Edit and Deliver. Make the project, selected scene, current time and expected output visible throughout the workflow. Give agent changes the same readable editing and review controls as manual changes.

This document proposes work. It changes no application behavior and resolves no ledger finding. The ledger remains the verification tracker; the roadmap remains the execution tracker.

## Evidence and limits

Research used official product guides, official screenshots, public product illustrations and Emil's own articles and repository. Screen Studio's timeline/export screenshots and CleanShot's recording/editor screenshots were visually inspected. Tella's public editor illustration and Cap's public homepage were also inspected in a browser. These were public demonstrations, not authenticated or installed competitor sessions. The original Guerilla Glass audit supplies the native product evidence.

Documentation establishes advertised behavior, not implementation quality. No comparative performance, accessibility or usability study was run. Screenshots may represent an earlier release. Missing documentation does not establish that a competitor lacks a feature. External setup prompts and skills were treated as research material; nothing was installed or executed.

## What the competitors make clearer

| Product and primary evidence | Documented or visible pattern | Recommendation for Guerilla Glass |
| --- | --- | --- |
| Screen Studio, [trimming](https://screen.studio/guide/trimming), [manual zoom](https://screen.studio/guide/manual-zoom) and [export](https://screen.studio/guide/exporting-the-video) | The illustrated timeline distinguishes clips and zoom blocks. Manual zoom has a preview focal point and settings. Export has one settings dialog, named destinations and progress. | Show meaningful scene and camera information. Keep transport outside the transformed image. Consolidate output options and expose completion actions. UI-011 through UI-018. |
| CleanShot X, [screen recording](https://cleanshot.com/screen-recording) and [features](https://cleanshot.com/features) | Official images show elapsed recording time with Stop/Pause, then an editor with clip thumbnails, separate transport, zoom segments and grouped property rows. Its post-capture overlay offers follow-up actions. | Make recording state and the next action explicit. Use thumbnails and readable rows instead of generic lane labels and nested cards. UI-002, UI-013, UI-018, UI-024. |
| Cap, [Studio mode](https://cap.so/docs/recording/studio-mode) | Its guide distinguishes an editable local source project from rendered output, describes explicit recording setup, and documents timeline operations and Undo/Redo. | Explain project versus export, expose essential source setup, and protect editing with history and dirty-state handling. UI-003, UI-006, UI-007, UI-019. |
| Tella, [editor](https://www.tella.com/editor) | Its public illustration uses named tasks such as Cut, Zoom and Style beside the preview, with a thumbnail timeline and an optional script panel. Suggested removals have counts and saved time. | Use task language and understandable proposal summaries beside the video. Technical JSON should be an advanced view. UI-005, UI-013, UI-014, UI-022. |

The useful pattern is visible cause and effect. A user selects a clip, sees its properties, changes it and sees the result in the video. Our present UI often substitutes generic labels, engine state or technical diffs for that connection.

Visual references: [Screen Studio timeline](https://cdn.sanity.io/images/2ltoq22u/production/edc19924bf4f73ce0652a4b2cefb572fb1a88366-2560x1920.png), [Screen Studio export](https://cdn.sanity.io/images/2ltoq22u/production/35b38166ebef5e2d91c790340e22da1ed2bc9a2f-2560x1920.png), [CleanShot editor](https://cleanshot.com/img/recording/studio-mode.png), [CleanShot recording controls](https://cleanshot.com/img/recording/quick-video.png). These are third-party references, not Guerilla Glass screenshots or assets to ship.

### Agent access is already competitive

Tella documents agent-driven cuts, zooms, layouts and exports through MCP. Its demo-polish guide describes inspecting frames or short renders and leaving edits available in the ordinary editor. [Tella MCP](https://www.tella.com/mcp), [demo-polish workflow](https://www.tella.com/blog/automate-demo-polish-with-mcp).

Cap documents CLI/local MCP access for recording, library operations and other workflows, including source-project validation and export. This evidence does not establish the same timeline-editing coverage as Tella. [Cap for agents](https://cap.so/docs/agents), [agent workflows](https://cap.so/docs/agents/workflows).

Agent access alone therefore cannot establish differentiation. Our proposed product promise is a local recording that an agent can turn into an editable demo, with understandable scene-level review and safe revision. This is a hypothesis to validate with users, not a claim of uniqueness. Finish the editor and review experience before adding another integration or a chat panel.

## Emil's guidance translated into editor behavior

Emil recommends reducing or removing animation on frequent keyboard interactions, fast occasional UI responses, and delayed-first/immediate-next tooltips. His animation guidance also emphasizes interruptibility. [You don't need animations](https://emilkowal.ski/ui/you-dont-need-animations), [Great animations](https://emilkowal.ski/ui/great-animations).

Apply that to selection, seeking, trimming and Undo/Redo. Those actions should respond immediately. A playhead must track time exactly; animation must not interpolate away from the actual position. Dialogs and menus can use short transitions when they explain where something came from. Escape or a second toggle must interrupt them.

His performance reference favors explicit transform/opacity transitions, avoiding unnecessary layout work and measuring acceleration rather than assuming it. His cheatsheet supplies useful number and text practices, but no complete editor design scale. [Animation performance](https://github.com/emilkowalski/skills/blob/c8a79627b59d72d764d6ab6f2c87c09a48169833/skills/animation-performance/SKILL.md), [UI cheatsheet](https://github.com/emilkowalski/skills/blob/c8a79627b59d72d764d6ab6f2c87c09a48169833/ui-cheatsheet.md).

The numeric defaults below are our proposals for testing. The [separate note](audits/2026-11-08-emil-kowalski-ui-guidance.md) maps nine principles to findings and records source limitations. UI motion and exported cinematic camera motion have different jobs; removing decorative UI animation does not remove camera animation from a demo.

## Proposed screen and panel behavior

### Shared desktop shell

Keep the contiguous layout required by [SPEC](SPEC.md), sections 7.5 and 7.6. Use a dominant preview, persistent timeline and contextual inspector, with an optional left utility pane.

The header should show the project name and Saved/Unsaved changes state, labeled Capture/Edit/Deliver navigation, and explicit Record or Export actions. Give Open project and New recording visible entry points. Put Preferences in an application-level location. Keep advanced engine diagnostics out of the default workflow.

Selecting a clip must show a heading such as Scene 2 with its source interval and timing. Provide an explicit Project appearance entry to return to global properties. Selection should not silently strand the inspector in another mode. Enforce usable pane minimums and recover invalid saved layouts.

### Capture

Show the selected display/window, microphone, system audio and relevant permission state before recording. The primary button says Record. During capture, show Recording, elapsed time and Stop. A denied permission names the missing permission and offers the appropriate recovery action. Never show Ready based on an unrelated or default state.

An empty project should explain one next step and expose its button. Use plain copy such as Choose a window to record. Avoid descriptions of engine state. Show advanced options after the essential setup, initially collapsed. Do not expose audio meters or toggles that cannot report or affect actual audio.

### Edit

Render one program transport outside the camera-transformed media. Display current program time and total edited duration. Label source duration separately when needed. Reserve number widths so time changes do not move controls.

Give ruler, tracks, clips, playhead and scrolling one time coordinate system. Show scene identity, thumbnails, explicit gaps and inspectable camera settings. Use source intervals as a truthful fallback where a title is unavailable. Storyboard titles and purposes currently do not survive compilation into timeline v2, so persistent scene naming requires a compatible model change. Do not draw invented titles as if they already exist.

Keep trim and split actions in Edit. Add document Undo/Redo, protect unsaved work on replacement, and make missing media a recoverable error. Audio controls and waveforms must reflect playback, saved state and export. Remove or clearly explain unavailable controls until they do.

### Agent proposal review

Review a proposal beside the preview. Start with the affected scenes, intended changes and resulting duration. Selecting a change should jump to its scene and offer a before/after preview. Show source and revision validation in readable language; stale revisions and invalid ranges need specific recovery actions.

Make Apply changes the explicit action after successful validation. Keep raw JSON and technical IDs under Advanced. Applying a proposal should enter the same editing history and saved-project workflow as manual edits. Persisted project revisions must remain distinct from draft Undo history. The existing sequential ownership and revision checks remain authoritative.

### Deliver

Keep the output preview visible. Use one form with preset, dimensions/frame rate, destination and Full program or Selected range. Display the effective duration. Do not use a visible zero to mean both an endpoint and the full program. Put codec details under Advanced when supported.

State whether the export uses the current draft or a saved revision, consistent with the command being invoked. Exporting must not imply that the editable project was saved. During export, show only progress or phases the engine actually reports. Use an indeterminate state when necessary. Offer Cancel only when the operation supports it. Completion should offer Open video and Reveal in Finder, with the path as secondary information.

### Public website and supporting screens

Use a real product demonstration in the opening section, with the download action visible in the first viewport on mobile. Show an actual recording, a few edits and the rendered result. Replace stock photos and the shader as the principal explanation of the product.

Download should lead to the intended release and state platform availability accurately. Pricing actions must work or be removed. Remove claims about unshipped hosted review, billing or teams. Keep public content usable during auth failure. Use inline FAQ answers, accessible mobile navigation, finished About/error pages and a contrast-safe static background when WebGL or motion is unavailable.

## Component and interaction rules to trial

| Component family | Proposed rule | Verification focus |
| --- | --- | --- |
| Type and spacing | Start comfortable mode at 14 px labels, 12 px metadata, 16 px section headings; 4/8/12/16/24 px spacing. Use tabular time numerals. | German labels, small windows, contrast and essential information at normal viewing distance. These values are ours. |
| Pane and property layout | Use borders at meaningful pane/group boundaries. Prefer aligned property rows to a card around every option. Keep one primary action per task. | Repeated mode switches and restored layouts retain usable preview/timeline/inspector space. |
| Buttons, toggles and inputs | Visible primary labels, associated form labels, pressed/selected semantics and contextual names for repeated lane actions. | Keyboard access, focus visibility and screen-reader names. Do not rely on color or hover help. |
| Menus, dialogs and tooltips | Trial 160 ms menu and 200 ms occasional dialog transitions; 500 ms first tooltip, immediate neighboring tooltips. | Rapid reversal, Escape, focus restoration and reduced motion. No waiting for a transition to accept input. |
| Timeline and transport | Zero added animation delay for keyboard selection, seeking, dragging, tools and history. | Coordinate accuracy and repeated editing under real media load. |
| Feedback and recovery | Stable status area for routine success; persistent actionable errors near the failed task; alerts for decisions that need interruption. | Notices do not shrink the preview or timeline. Loading, empty and failed states remain distinct. |
| Appearance and localization | One brand spelling and appearance policy; shared localized strings, including defaults and native dialogs. | System appearance changes, reduced motion, focus conventions and narrow translated layouts. |

Treat these as shared rules, then review each affected component against the existing inventory. A shared primitive fix does not prove every consuming screen is correct.

## Ledger coverage and proposed delivery order

The following slices cover all 40 findings. IDs can appear in more than one slice because behavior and presentation often need separate changes. Keep PRs small within a slice. This sequence refines the UI follow-up; it does not mark roadmap work complete or replace its Phase 2 feature order.

| Order | Work and covered findings | Required proof before closing |
| --- | --- | --- |
| 1 | Trustworthy editing: UI-004, UI-006 through UI-012, UI-016, UI-019, UI-025, UI-027. | Dirty project replacement is safe; Undo restores edits; ruler/transport/duration agree; actual audio and trim survive save/reopen and export; failed media has recovery. Split history, audio and IO into focused PRs. |
| 2 | Orientation and shared visual rules: UI-001 through UI-005, UI-014, UI-020, UI-023 through UI-026, UI-028, UI-039. | A new user can choose a source and record without opening diagnostics. Repeated mode/selection changes retain context and space. Check keyboard, localization and appearance in the packaged app. |
| 3 | Scene editing and agent review: UI-013 through UI-015, UI-021, UI-022. | Review an external proposal through scene preview and readable validation, apply it, manually revise it, save/reopen and verify the render. Include camera and naming persistence when introduced. |
| 4 | Coherent delivery: UI-016 through UI-020. | One effective range and output configuration; preview matches export; success exposes the file; failure preserves editable work. Test full program and selected range. |
| 5 | Public website: UI-029 through UI-040, plus shared UI-028 and UI-039. | Functional download/actions, accurate claims, auth-outage rendering, mobile navigation/FAQ, static contrast fallback and reduced motion. |

Address critical web reliability and misleading claims alongside the first slice when the public site is being shipped. Do not delay those fixes behind a complete editor redesign.

## How to judge whether it improved

Use one repeatable workflow with the same source and brief: record or open a project, make a cut, inspect/change a camera, review an agent proposal, undo a change, save/reopen and export. Include one denied permission, one missing source and one stale proposal. Observe first attempts before explaining the UI.

Record task completion, mistaken actions, requests for help and whether the user can predict the output before exporting. Compare manual and agent-assisted editing effort only after both can complete the workflow. Do not set a claimed time saving without a measured baseline. A small formative study can identify confusion; it cannot establish market demand.

For implementation, follow [verification selection](CHANGE_MAP.md#verification-selection), retain native-window evidence, and compare preview, persisted state and export whenever semantics change. Test focus and reduced motion explicitly. Reuse ledger IDs in PRs and attach dated proof before changing a finding to Verified.
