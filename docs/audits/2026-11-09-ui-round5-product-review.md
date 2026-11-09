# Independent product and visual review, round 5

Reviewed 2026-11-09. Frozen HEAD `aaa61bcb9f8500253783987a15b228843206eb65` against main `45245daf360d0bd352f28da39b5ddec6978931c1`.

Overall rating: **9.5/10. FAIL** against the required **strictly greater than 9.5/10** threshold. This is an independent judgment of the complete change, without averaging or rounding. I did not read another round 5 review or receive another reviewer's score.

The interface is coherent and substantially more trustworthy than the baseline. I found no new P1 or P2 interaction defect in the inspected desktop or public web implementation. One product-truth correction remains incomplete in the normative specification. That prevents me from rating the complete change above the requested threshold.

## Finding

### P2: The capability matrix still advertises production capture on macOS 13

`docs/SPEC.md:133` and `docs/SPEC.md:134` still label display and window capture `Production (13+)`. `Package.swift:7` requires macOS 14. The same specification now correctly says macOS 14 at lines 38 and 102, and README and both public FAQ translations are also corrected.

This is a pre-existing claim left behind by this change's compatibility correction, not a new capture regression. It nevertheless leaves two contradictory answers in the normative product requirements. Someone using the capability matrix to assess their machine can still conclude that the shipped native capture path supports macOS 13. The matrix calls this production behavior; the surrounding parity-target heading does not make that an explicit future compatibility goal.

Change both matrix entries to agree with the deployment target. The new regression at `apps/web/tests/public-pages.test.tsx:49` reads `Package.swift` and checks both FAQ translations, but it does not detect these remaining specification claims. Extend the consistency check or otherwise cover the authoritative documentation. No native target change is needed.

Evidence is source text, not an inferred screenshot defect. Reproduction: `rg -n 'Production \(13\+\)|macOS 14|\.macOS\(\.v14\)' docs/SPEC.md README.md Package.swift`.

## Product and visual assessment

I read AGENTS.md, both affected app guides, REVIEW.md, the verification selection guidance, all 40 ledger findings, the complete 89-module inventory, UI improvement research, the Emil guidance audit and the implementation evidence. The comparison used the literal baseline-to-HEAD diff, rather than only the latest corrective commit. Source inspection covered the full route/panel/component scope and the supporting history, selection, media, file-action, native menu/dialog and localization paths. Unused shared components remain library scope; I do not treat their unrendered variants as demonstrated product screens.

| Scope and ledger findings | Assessment |
| --- | --- |
| Orientation, Capture, preferences, UI-001 through UI-005 and UI-026 | Labeled Capture/Edit/Deliver links and task-specific actions establish the workflow. Source and permission setup are exposed. Checking, failed, denied and unknown permission states are distinct; failed checks have Retry. German Preferences has readable rows and explicit shortcut changes. Denied Capture is native evidence; granted capture remains unproven. |
| Project safety and history, UI-006 and UI-007 | Identity and Saved/Unsaved state stay visible. Replacement offers an explicit decision with a safe initial focus. Successful same-package Open resets the document session; failed/cancelled Open retains it. History includes visual settings, groups slider gestures and preserves cuts through passive generated-source refinement. Undo selection resolves current IDs and timings. The native undo-selection capture shows project controls after the selected split is removed. |
| Audio, duration, playback and media recovery, UI-008 through UI-012 and UI-027 | Unsupported mixer output controls are removed. Audio absence, silence, loading and decoding uncertainty are not interchangeable. The main transport is outside camera transforms, includes preview-only listening controls and remains inside fullscreen. Ruler, tracks and playhead share the scroll origin. Tests cover active seeks, EOF replay, trailing gaps and renewed media leases. Audible native playback is not claimed. |
| Scene identity, inspector and proposals, UI-013 through UI-015, UI-021 and UI-022 | Thumbnails and source intervals supply concrete scene context. The inspector names its scene, exposes cameras and offers a visible return to project settings. Proposal review shows the brief, duration change, readable scene changes and isolated Before/Proposed playback. Preview focus moves predictably; confirmation remains bound to validated text and editor state. Schema diagnostics identify actionable fields. The actual stale German proposal has localized recovery and no appended English engine description. |
| Deliver and project IO, UI-016 through UI-019 | One configuration form sits beside the output composition. Full program and Selected range are explicit; zero endpoints survive the request. Invalid ranges block export before the picker. The Export footer remains visible while settings scroll. Completion actions refer to a succeeded host-owned output. Save As names an editable project. Native five-second output and Open/Reveal evidence support the demonstrated horizontal export path. |
| Feedback, layout and shared presentation, UI-020 and UI-023 through UI-025 | Routine notices occupy stable space. Property rows and restrained borders improve scanning. Selected state, keyboard labels and field-error relationships are explicit. Native normal/small/fullscreen states keep transport usable, and the small Deliver capture shows all lanes and its Export footer. Labeled restore controls occupy their own row and collapsed content is inert. Manual Events-lane scrolling and VoiceOver listening are still acceptance limits. |
| Brand, public routes and content, UI-028 through UI-040 | The built website has a clear source-build action, an actual editor image and a native-rendered demo with honest provenance. It makes no purchasable-plan or cross-platform media-parity claim. Public routing does not await hosted auth. Static theme colors, native modal navigation, inline FAQ answers and finished About/recovery routes form a consistent design. Request-local locale isolation and live automatic appearance have focused tests. The remaining macOS claim is the specification finding above. |

I actually opened every image in `docs/evidence/ui-pass` with `view_image`: desktop-edit, desktop-small, desktop-fullscreen, desktop-capture-denied, desktop-deliver, desktop-deliver-small, desktop-deliver-vertical, proposal-review, proposal-preview, proposal-diagnostic, proposal-stale-de, undo-selection, restore-panel, preferences-de, replacement-confirmation, quit-guard, save-as, web-mobile-de-dark, web-faq-de-dark, web-about-de-light and web-not-found-de-light.

These images support a consistent hierarchy across the editor, proposal dialogs and public pages. The mobile-home capture contains the disclosed older editor illustration. I did not use that embedded illustration to judge current editor controls. SHA-256 comparison confirms `apps/web/public/studio-preview.png` and the viewed `desktop-edit.png` are identical. Retained native captures span the fixing pass; screenshots establish the pictured state, while the frozen source and later behavioral checks establish subsequent corrections.

## Validation and limits

I ran `bun run repo:check` and the literal baseline-to-HEAD `git diff --check`; both passed. I inspected the retained round 5 logs, including 124 browser acceptance cases in 10 files, packaged runtime smoke with cleanup and zero fatal matches, 15 proposal cases including six real EngineResponseError cases in German, nine web tests, web build, both app typechecks, lint, formatting and docs checks. These are author-run results that I reviewed, not suites I independently reran. Earlier focused native/history/controller checks remain scoped evidence and are not added to those counts.

I launched no app or browser, granted no permission, ran no heavy suite and changed no product source. This review uses retained real packaged-app and built-site evidence plus source inspection. Native granted recording, audible native audio and sidecars, rendered vertical-output comparison, VoiceOver listening, full CI, deployed hosting and Windows/Linux runtime behavior remain unclaimed. Those release checks are distinct from the concrete documentation defect above. The later Phase 2 performance/accessibility gate and full manual camera authoring remain open roadmap work.

The requested PR gate remains unmet by this review. Correct the two compatibility matrix entries and obtain fresh independent assessment of the next frozen revision.
