# Independent product and visual UI review

Reviewed 2026-11-09.

Frozen HEAD: `8bdd37b19b04f1aa2004eb9de6821f8091528f3d`.
Comparison baseline: `45245daf360d0bd352f28da39b5ddec6978931c1`.
Scope: the complete 169-file change, with emphasis on current product behavior, visual hierarchy, discoverability and the 40-finding UI ledger. No other new independent review or score informed this assessment.

**Overall score: 9.1/10. Strictly greater than 9.5 gate: FAIL.**

The editor now has a coherent Capture/Edit/Deliver workflow, protected project replacement, useful scene information and stable playback controls. The website communicates the product and its availability honestly. The remaining defects concern recovery and keyboard operation, rather than a need for another visual redesign. Those defects, together with incomplete native acceptance coverage, prevent a near-perfect rating.

## Prioritized findings

### P2: The general permission recovery button opens the wrong settings category

Evidence: `apps/desktop-electrobun/src/mainview/app/studio/routes/CaptureRoute.tsx:167` through `174`; `engines/macos-swift/modules/inputTracking/InputPermissionManager.swift:36` through `41`. Screenshot: `docs/evidence/ui-pass/desktop-capture-denied.png`.

The denied Capture screenshot shows Screen not granted, Mic not granted and a generic Open Settings action. That action always invokes `openInputMonitoringSettings`, whose destination explicitly contains `Privacy_ListenEvent`. A person trying to enable screen recording or microphone access is sent to Input Monitoring. Request Screen and Request Mic are separate actions, but that does not make this general recovery action truthful.

Give each denied permission its matching recovery action, or label this button Open Input Monitoring Settings and supply clear screen/microphone recovery instructions. This survives from the older UI and remains relevant to UI-004. The destination mismatch is established in source. I did not open System Settings or grant permissions during this review.

### P2: Storyboard schema failures still conceal the actionable reason

Evidence: `apps/desktop-electrobun/src/mainview/app/studio/panels/AgentProposalPanel.tsx:135` through `142`; `messages/en-US.json:294`; `packages/engine-contract/src/domains/editWorkflow.ts:20` through `32`. Regression expectation: `apps/desktop-electrobun/tests/ui/agent-proposal.browser.test.tsx:109` through `124`.

Bad JSON, unsupported version, missing required fields and duplicate scene IDs all receive the same message, "Invalid storyboard. Check its version, scene IDs, ranges and required fields." The schema already distinguishes a literal version failure and duplicate IDs. The renderer discards that information. It also gives an oversized file the same message, without explaining the size limit.

This leaves a user or editing agent guessing which part to repair. UI-021 explicitly requires these cases to explain a specific recovery step. Retaining native validation descriptions improves later failures, but does not fix the local decode branch. Map schema failures to concise localized reasons with a field or scene reference, and explain the import limit separately. The existing browser test establishes safety against applying invalid input, but currently locks in the generic feedback.

### P2: Keyboard activation of a clip in Blade mode cuts at its boundary and does nothing

Evidence: `apps/desktop-electrobun/src/mainview/app/studio/panels/TimelineSurface.tsx:966` through `975`; `apps/desktop-electrobun/src/mainview/app/studio/hooks/core/useStudioController.ts:742` through `753`.

The clip is a keyboard-focusable Button. In Blade mode, every click calculates the cut from `event.clientX`. A keyboard-generated click has no pointer position and uses zero. With the clip positioned to the right of the viewport origin, the ratio clamps to zero, so the requested cut is exactly the clip start. A boundary cut cannot split the clip. Enter or Space therefore silently fails instead of using the playhead or another keyboard-defined position.

Keep pointer cuts at the pointer. Handle keyboard activation with an explicit playhead-based command, or preserve selection and expose the keyboard split action clearly. A separate inspector Split clip at playhead action exists, so this does not block all keyboard editing. It is still a broken activation path in a core tool and an unresolved part of UI-025. This is a source-derived surviving defect, not a newly observed native regression. Add one real browser keyboard case before considering it resolved.

### P3: Collapsed panes still have no labeled edge restoration action

Evidence: `apps/desktop-electrobun/src/mainview/app/studio/layout/EditorWorkspace.tsx:68` through `89`, `108` through `120`, and `137` through `148`; `apps/desktop-electrobun/src/mainview/app/studio/layout/StudioShellHeader.tsx:399` through `414`.

Collapsed panes have size zero and retain only resize separators. Restoring them requires the View menu and a generic Toggle left/right pane or timeline command. The new defaults expose essentials and the View menu is a useful improvement, but the labeled edge restore affordance in UI-003's acceptance criterion is absent. This is a discoverability refinement, not a core-task blocker.

### P3: Narrow scene labels lose identity before secondary metadata

Evidence: `apps/desktop-electrobun/src/mainview/app/studio/panels/TimelineSurface.tsx:1014` through `1045`; `apps/desktop-electrobun/src/mainview/index.css:693` through `710`. Screenshots: `docs/evidence/ui-pass/desktop-edit.png` and `desktop-small.png`.

The first two-second clip truncates Scene 1 to a fragment while keeping the camera icon/count and duration. Some source-range truncation is expected on a proportional timeline. The priority within the clip can improve: preserve the scene number first, then suppress or move camera counts/duration as space becomes limited. The selected inspector and zoom controls provide workarounds. I would not block a PR solely on this refinement.

## Product and visual assessment

I read the ledger and its 89-module inventory, the implementation evidence, the competitor research and the Emil Kowalski guidance. I inspected the current desktop routes, shell, inspector dispatch and its selections, history/replacement entry points, timeline, proposal review and isolated preview, project utility, preferences, feedback, preview controls, public routes and shared component sources. Library-only controls are source coverage, not evidence of additional live product screens or every possible prop combination. Native dialogs, menus and data-safety behavior also have retained workflow evidence and focused tests.

I used `view_image` to inspect the current retained packaged screenshots for Edit, Deliver, 1100x760 Edit and Deliver, fullscreen, denied Capture, proposal review and preview, replacement confirmation and German Preferences. I also inspected the actual built-site screenshots for German mobile dark home and FAQ, light About and the missing route. These are real visual inspections, not conclusions drawn from filenames or test counts.

The strongest changes match the research well. The workflow has visible names; utility actions no longer dominate the header. The preview and transport remain separate from camera transforms, including fullscreen. Deliver gives one output configuration and a persistent Export footer. The denied state does not say Ready. The silent source no longer receives invented audio content. Proposal review has editorial intent, duration comparison, an identified before/proposed preview and explicit application. Preferences show readable labels and remain available across routes. About, FAQ and recovery pages now belong to the same visual system.

The screenshots also show the limits of the compact editor. The left project column consumes substantial space for metadata, and the selected camera inspector pushes editing actions below the fold. Those are reasonable density tradeoffs with scrolling and pane controls, not proven blockers. The 1100x760 Deliver screenshot keeps all three lanes and Export reachable. Edit does not show the Events lane in its retained small-window state; the evidence correctly leaves wheel-scrolling proof outstanding.

The public site has restrained typography, visible source-build action, inline FAQ answers, a static contrast-safe background and useful product imagery. There are no remaining paid-plan or installer-download promises in the current source. The site and ordinary editor interactions avoid decorative entrance sequences. Source reduced-motion/focus rules and immediate timeline transitions support Emil's guidance, but screenshots do not prove motion performance or a usability result.

## Validation assessment and acceptance limits

The retained `desktop-acceptance.log` records 103 browser tests and a passed packaged runtime smoke with zero fatal-pattern matches. `swift-save-as-final.log` contains six project-store tests and six engine-save tests passing, including copying reopened media and refusing missing declared audio before replacement. Repository invariant evidence passes. The implementation evidence also records 159 focused unit tests, web tests/build, typechecks, lint, docs and formatting. I did not add these counts together or rerun resource-heavy suites. I ran the frozen-range `git diff --check`, which passed.

These checks support the implementation but do not cover the three P2 behaviors above. In particular, the proposal test checks the generic message rather than diagnostic specificity. Native capture with granted permissions, audible native playback, VoiceOver listening, every pane/height combination, reduced-motion system behavior, a rendered vertical-output comparison, full CI and Windows/Linux runtime remain unclaimed. They are acceptance gaps, not fabricated regressions.

The built mobile-home screenshot contains an older editor illustration with the former crowded toolbar/audio blocks. The current `apps/web/public/studio-preview.png` is byte-identical to the updated `docs/evidence/ui-pass/desktop-edit.png`, so this is stale website screenshot evidence, not a current shipped-asset defect. Refresh the built-home capture before claiming exact current visual proof for that asset.

This review launched no app or browser, changed no product source, and ran no build or test suite. It does not independently certify the complete granted recording-to-audible-export workflow or all 89 modules in every rendered state. The ledger should retain Ready for verification where its stated acceptance work remains. The implementation is materially better, but the three P2 findings must be addressed before I would rate the complete product change strictly above 9.5/10.
