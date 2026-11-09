# Frozen UI standards and Effect review

Reviewed 2026-11-09.

- HEAD: `8bdd37b19b04f1aa2004eb9de6821f8091528f3d`
- Baseline main: `45245daf360d0bd352f28da39b5ddec6978931c1`
- Comparison: `git diff <baseline>...<head>`, 169 changed files.
- Overall readiness: **9.3/10**.
- Strictly greater than 9.5 gate: **FAIL**.

The earlier recording, permission-check and localized file-error findings have substantive fixes. The host/service boundaries and the new public website are sound in the paths inspected. One remaining delivery-state defect prevents my approval at the requested threshold. This is my independent assessment, without averaging or rounding against another review.

## Finding

### P2: Export completion and file actions survive replacement with a different project

Primary location: `apps/desktop-electrobun/src/mainview/app/studio/routes/DeliverRoute.tsx:185-202`.

After successfully exporting project A, open project B through Project files or Recent Projects, then visit Deliver. The footer still displays A's `Export complete` result and enabled `Open video` / reveal actions beside B's preview and output settings. Those actions open A's video. The footer does not identify a previous project, filename, output path or exported revision, so users cannot tell that the apparent completion belongs to a different document.

The source trace is complete:

- The controller owns `useStudioMutations` across routes. Its successful-open and successful-recording callbacks only reset document history at `hooks/core/useStudioController.ts:948-949`.
- Open resets range, playback, query data and selection, but never resets the export mutation at `hooks/core/useStudioMutations.ts:647-672` and `:689-714`. No `exportMutation.reset` exists in application source.
- Deliver renders any retained successful `exportMutation.data` without checking its document/session identity at `routes/DeliverRoute.tsx:185-215`.
- `src/bun/session/exportResultActions.ts:10-24` keeps one host-wide completed output path and uses it for both actions. Opening a different project does not clear or rebind it.

Clear the displayed result on a committed project replacement/new recording, or retain explicit result metadata and present it as a previous export with its project/output identity. Keep failed and cancelled opens from clearing a result that still belongs to the retained document. Add a browser regression that exports A, opens B, and checks the completion/action state. This was established by source tracing, not by a new live-app reproduction.

Standards: `REVIEW.md`, Universal review requires correct boundary states and truthful behavior across architectural boundaries. Its Desktop and UI section requires meaningful interaction coverage. `docs/UI_REVIEW_LEDGER.md`, UI-018 requires meaningful export completion and file actions. `docs/UI_IMPROVEMENT_RESEARCH.md`, Deliver requires the output path as secondary completion information. This finding concerns misleading product state and the wrong document's output, rather than an Effect style preference.

## Review coverage and standards assessment

Read root and relevant desktop/web/native `AGENTS.md`, `REVIEW.md`, `docs/EFFECT_PRACTICES.md`, verification selection, desktop accessibility policy, the research/ledger/inventory/evidence documents, and the historical failed standards review. Read the Effect skill and its service/layer and schema references. Confirmed installed Effect 4.1.2 and checked the installed child-process source, whose command effects require the spawner and Scope. I did not read any peer's new review report or exchange ratings.

Reviewed the host/session/dialog/quit changes, bridge definitions and error transport, media CORS/metadata guard, history and recording/open/save transitions, timeline and decoded media helpers, preview/proposal/delivery controls, inspector fields, shared dialog/theme changes and public routing/localization/appearance. Cross-checked the Record -> Edit -> Deliver product requirements and the Phase 2 limits. The UI work does not claim to finish camera authoring, hosted collaboration or native Windows/Linux media parity.

The inspected changes retain one scoped Effect runtime. Bridge handlers decode and delegate; they do not introduce a second host application layer. Native dialogs execute fixed AppleScript with user-controlled values supplied as argv, use scoped child processes and map expected failures into tagged errors. Application IO still uses the existing Effect services and no-follow adapter. Completed-export opening accepts a narrow action rather than a renderer-supplied filesystem path. The finding above is about result identity, not a new arbitrary-path authority bypass.

The media route still requires token authorization and the metadata guard before reflecting an accepted origin. The exact bundled `views://mainview` origin is narrowly permitted. No engine-contract/generated binding or generated Paraglide changes appear in the comparison. Protocol regeneration is therefore not required by this diff.

Both message sources cover the new product copy. File-action errors now map stable codes after JSON bridge transport, with English/German regressions. Permission loading, failure, unknown and confirmed-denied states have distinct branches and recovery. New fields and toggles have useful names/state, replacement confirmation uses the application dialog, and preview controls sit outside the camera transform. Public pages use static theme colors, localized request-scoped SSR, native modal navigation and adjacent FAQ answers. These changes address concrete baseline problems.

Viewed seven committed evidence images directly: packaged Edit, small Deliver, German Preferences, proposal scene preview, denied Capture, German mobile dark homepage and German light missing-route page. They support the improved hierarchy, responsive composition and localized controls. They do not prove a full screen-reader or platform matrix.

## Validation assessment and limits

Reviewer ran `git rev-parse HEAD` and `git diff --check <baseline>...<head>`. The frozen HEAD matched and the diff check passed. No product edits, app launches, browser sessions, heavy suites or subagents were used. Only this report was written.

Inspected existing validation logs rather than rerunning their suites. They record 103 tests across 10 desktop browser files, packaged runtime smoke with process cleanup and zero fatal matches, 159 focused desktop unit tests across 27 files, 12 native tests across EngineProjectSaveTests and ProjectStoreTests, eight web tests, and passing repository invariants. The Swift log includes unrelated targets with zero selected tests, but the two intended suites each execute six tests. The evidence also records desktop/web/shared UI typechecks, lint/format/docs checks, native engine compile and production web build. This selection covers the changed subsystems and the native persistence consumers without unnecessary protocol generation.

The tests cover many important transition failures, but do not cover the export-A/open-B result identity case. Existing success-only export-authority tests cannot establish that UI behavior.

Granted native capture, audible native playback, VoiceOver listening, the wider German failure/layout matrix, manual Edit Events-lane wheel targeting, Windows/Linux runtime behavior and full CI remain explicit acceptance limits. I do not treat their absence alone as a demonstrated regression or require unrelated Phase 2 features to pass this review. PR screenshot attachment and unresolved-thread checks remain later PR/merge obligations. The score fails because of the concrete retained-result defect above, while those disclosed limits constrain what this review certifies.
