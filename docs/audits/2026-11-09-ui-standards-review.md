# Frozen standards review

Reviewer: independent standards, Effect, security, accessibility and localization review.

Frozen head: `013123631c5402304bf9f8837de83b35f978cc56`.
Baseline: `45245daf360d0bd352f28da39b5ddec6978931c1`.
Reviewed comparison: `git diff 45245daf360d0bd352f28da39b5ddec6978931c1...013123631c5402304bf9f8837de83b35f978cc56`.

Overall score: **9.0/10**. The strict **>9.5/10 gate fails**. Do not prepare the requested PR on this review's authority.

## Main findings

1. **P2: Recording start discards configured visual settings.** `apps/desktop-electrobun/src/mainview/app/studio/hooks/core/useStudioMutations.ts:547-548` replaces the fresh cache's explicitly retained `autoZoom` and `backgroundFraming` with native `projectCurrent()`. The new native transition resets `currentProjectDocument = ProjectDocument()` at `engines/macos-swift/EngineService+CaptureRecording.swift:150`, whose visual fields are defaults. History hydration then restores those defaults into the form. Disable auto zoom or configure framing before Record and that choice disappears after recording starts. Preserve the selected settings while clearing old project/source authority. The browser test at `tests/ui/editor-export-timeline.browser.test.tsx:569-574` masks this by returning current form settings from its native stub. Hard standards: root AGENTS rules 7 and change discipline, REVIEW correctness, and the research's visible cause-and-effect requirement.

2. **P2: Failed permission checks still receive denied-permission instructions.** `apps/desktop-electrobun/src/mainview/app/studio/routes/CaptureRoute.tsx:403-411` treats missing query data, including loading and an engine/request failure, like a denial and tells users to allow Screen Recording in system settings. Header and rows show only Unknown for these cases. There is no distinct failed-check recovery state. Branch on query status, show checking/check-failed messages and a Retry action, and reserve OS instructions for a successful denied result. Hard standard: REVIEW requires actionable degraded/loading states; UI-004 explicitly requires failed-check Retry. `UI_IMPLEMENTATION_EVIDENCE.md` currently overstates the distinct loading/error treatment.

3. **P3: New native task errors bypass localization.** `src/bun/path/nativeSaveDialog.ts:32,45`, `nativeFolderDialog.ts:31,43`, `session/exportResultActions.ts:18,28` and `session/ProjectSessionElectrobun.ts:79,91,254` introduce English descriptions shown verbatim by `useStudioController.ts:157-165`. German users therefore receive English Save/Open/Reveal failures. Map typed reasons to shared English/German messages and test these failed actions. Hard standard: root AGENTS rule 8, desktop/web guides, REVIEW localization and UI-039.

These are concrete behavior/standards findings, not optional smell heuristics. None is a formatting/lint issue. The change is substantially better, but the recording regression and recovery gap prevent a near-perfect score.

## Supporting review coverage

Read root/nested AGENTS guides, REVIEW.md, docs/EFFECT_PRACTICES.md, verification selection, accessibility policy, research, ledger, evidence and relevant existing/new tests. Applied the Effect skill and service/layer/schema references against installed Effect **4.1.2**, including its child-process scope types. No requirement was inferred from a conflicting version of the skill.

Reviewed host/session/dialog/media/security changes, bridge contract/registry changes, document history/controller/mutations, timeline/thumbnails, preview/proposal/delivery, shared primitives, web routing/localization/appearance and native project/capture changes. Inspected all 14 committed `docs/evidence/ui-pass` screenshots with `view_image`, including the small packaged editor, German Preferences, denied Capture, proposal comparison/playback, vertical Deliver, native Save As/quit guard and German web/error routes.

The reviewed host changes retain one managed Effect runtime and thin schema-decoding handlers. Dialog subprocesses require Scope and ChildProcessSpawner, run under Effect.scoped and receive user-controlled values as argv. No new direct Node path/filesystem/crypto application dependency was introduced. Export-result opening uses a host-owned completed path, rather than accepting a renderer-supplied path. The media change preserves token authorization and origin/host checks, adds only the exact bundled views origin and reflects accepted origins after authorization. No generated protocol/Paraglide source changes appear in this comparison.

Shared fields now have useful names and toggle state; menus, dialogs and static web styling improve keyboard/reduced-motion behavior. Screenshots support a clearer desktop layout and readable German public routes. They do not establish every assistive-technology or error-state guarantee.

Optional maintainability judgment: the two new osascript dialog adapters duplicate subprocess reading, exit handling and cancellation mapping. A small private helper could keep their lifecycle/error behavior aligned. This is not a hard-standard violation and does not independently affect the gate.

## Validation and limits

Reviewer ran `git rev-parse HEAD` to confirm the freeze and `git diff --check <baseline>...<head>`, which passed. No product edits, commits, app/browser interactions, builds or test suites were performed during this review. No other reviewer reports were read.

The author reports 77 browser tests, 144 focused desktop unit tests, 12 selected Swift tests, fast Swift compile, web tests/typecheck/build, shared UI typecheck and repository/docs/format/lint checks. These are author evidence, not reviewer reruns. No additional resource-heavy test run was needed to establish the source-trace findings above. Native granted recording/audio, VoiceOver listening, expanded German error states, Windows/Linux behavior and full CI remain unverified here. These disclosed limits should remain explicit after fixes. PR screenshot attachment and unresolved-thread gates apply when a PR is eventually authorized.
