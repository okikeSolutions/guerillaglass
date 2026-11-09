# Independent standards and Effect review, round 6

Reviewed 2026-11-09.

- Frozen HEAD: `57a47cae10441f75f6f32459ba34cd97071c4c5c`.
- Baseline: `45245daf360d0bd352f28da39b5ddec6978931c1`.
- Complete comparison: `git diff 45245daf360d0bd352f28da39b5ddec6978931c1...57a47cae10441f75f6f32459ba34cd97071c4c5c`, 194 changed files.
- Overall rating: **9.6/10**.
- Strictly greater than 9.5 gate: **PASS** for this independent review.

This is a reassessment of the full UI change against the original baseline. I found no P0, P1 or P2 defect. One P3 standards issue remains. I assessed the frozen change and its evidence directly, without averaging ratings, rounding a failing score or consulting peers' round-6 reports.

## Remaining finding

### P3: Desktop components still import generated messages outside the localization facade

`apps/desktop-electrobun/src/mainview/app/studio/panels/ProgramPreviewControls.tsx:4` imports generated Paraglide messages directly and supplies locale options within the component. The same pattern appears at `apps/desktop-electrobun/src/mainview/app/studio/routes/DeliverRoute.tsx:10` and other changed desktop components. This does not follow `docs/CHANGE_MAP.md:106`, which directs desktop messages through the existing localization model.

The messages have matching shared English/German sources, and the reviewed locale paths render correct localized copy. This is a low-risk maintenance deviation, not a localization failure. Consolidation through the existing facade would remove repeated locale plumbing. UI-039 and the implementation evidence now explicitly track it; tracking does not mean it is resolved. It does not block this change under my assessment.

## Full-scope reassessment

The preceding round's full source review remains relevant because I verified the delta from `aaa61bcb9f8500253783987a15b228843206eb65` to this freeze. It changes documentation, one web regression and archived reports. Desktop, web and shared production source and native engine code are byte-unchanged. I examined the complete baseline-to-head changed-file inventory, the entire new non-archive delta, current key ownership/security/history/proposal paths and current validation logs. I did not substitute a review of the small documentation patch for assessment of the complete implementation.

The standards basis remains root/desktop/web/native AGENTS, REVIEW, EFFECT_PRACTICES, ARCHITECTURE, DESKTOP_ACCESSIBILITY and CHANGE_MAP verification selection. The Effect schema/service/layer guidance, installed Effect 4.1.2 process source, unslop and React review guidance informed the source assessment. The ledger's 40 findings, 89-module inventory, improvement research and implementation evidence define the UI scope and its remaining acceptance work.

Effect ownership and typed boundaries remain sound. Host bridge adapters decode schemas and call services through the existing scoped runtime. ProjectSession owns dialogs, access grants and completed-export actions. Native dialogs use fixed AppleScript with user values in argv, typed PathPickerError recovery and scoped Effect child processes supplied through the Node platform layer. Graceful quit disposes the runtime outside that same runtime and coalesces native/menu requests. The Promise boundary returns an unavailable envelope when teardown interrupts instrumentation. No new runtime, direct Node filesystem/path/crypto application dependency, broad Effect cast, hidden authority default or parallel wire DTO was introduced.

Security and persistence conclusions remain unchanged. Media CORS follows the metadata guard and capability-token lookup, including the exact bundled `views://mainview` origin. Export Open/Reveal accepts an action rather than an arbitrary renderer-selected path. Native Save As resolves reopened-project assets, preflights missing declared sources, retains symlink/traversal checks and protects in-place source media. These follow root AGENTS architecture rules and REVIEW's Security, Desktop and Project persistence sections.

The complete editor change includes bounded timeline/visual-setting history, explicit-save history preservation, committed-replacement reset, generated-source refinement that preserves edited drafts, current-lane selection reconciliation, camera inspection/reset, and program-clock playback through gaps and EOF replay. Preview listening state stays separate from saved/exported settings. Export range mode and both endpoints are explicit, with invalid ranges rejected before the picker. Truthful audio states replace disconnected mixer controls and event-derived waveforms. Serialized thumbnail decoding and cleanup remain bounded. Relevant pure, controller/browser and native tests address these cross-boundary behaviors.

Capture/Edit/Deliver, preferences, file actions and empty/recovery states remain navigable and named. Collapsed panes are inert and have restore controls; export errors are associated with their fields; dialogs require localized close labels. Pointer/keyboard paths and focus/reduced-motion conventions remain present. The web retains static appearance backgrounds, request-scoped localization, auth-independent public rendering, modal menu containment/Escape/focus return and adjacent FAQ answers. These support REVIEW's source and browser accessibility requirements, without claiming the unperformed assistive-technology checks below.

Product truth is now internally consistent on the macOS deployment minimum. SPEC's two production capture rows at `docs/SPEC.md:133` and `:134` say 14+, matching Package.swift, README, SPEC's current baseline and both FAQ translations. The expanded test at `apps/web/tests/public-pages.test.tsx:49` derives the minimum from Package.swift and requires each of those claims to match, including exactly two capture rows. It would fail on the former production-13 labels. SPEC's remaining macOS 13 sample reference is explicitly historical, not an application compatibility promise.

The previous accessibility-guide finding is resolved. `docs/DESKTOP_ACCESSIBILITY.md:74` now names global Preferences, matching the checkbox at `apps/desktop-electrobun/src/mainview/app/studio/layout/StudioShellHeader.tsx:445`. Native proposal recovery remains code/task-based localized copy with six real EngineResponseError German cases and retained native stale-project proof. The website accurately describes source-build availability, experimental Windows/Linux engines and unavailable hosted/paid offerings. No engine wire contract or generated native/Paraglide source changed. Roadmap and evidence continue to distinguish this unmerged UI pass from the later Phase 2/release gates.

## Verification and limits

I ran read-only exact-HEAD/status and diff probes, source searches and `git diff --check` for the full frozen range. The whitespace check passed. I launched no browser/app, ran no build or suite, spawned no agents and changed no product file. Only this report was written.

I inspected the round-6 logs for nine web tests across three files, web localization/typecheck, type-aware lint, repository invariants, docs and formatting. They pass. The test and documentation delta does not require another packaged-app build because production application code is unchanged.

Unchanged implementation retains the inspected round-5 evidence of 124 browser tests across ten files and passed packaged runtime smoke with cleanup and zero fatal matches, plus the separate Peekaboo native-window evidence. Earlier scoped evidence includes 159 focused units, 11 history/selection model tests, native engine compilation and twelve selected ProjectStore/EngineProjectSave tests. Overlapping focused/browser runs are not added as unique totals. These are inspected author receipts, not suites independently rerun by this reviewer.

Previously viewed native screenshots establish German stale-proposal recovery, Undo selection/Saved state and small Deliver layout. The mobile web screenshot supports its disclosed layout revision. No screenshot is treated as proof of all behavior. Granted native capture, audible native playback, VoiceOver listening, every German failure/layout combination, native high-zoom/Events-lane interaction, rendered vertical-output comparison, full CI and Windows/Linux runtime remain unclaimed. These are acceptance limits rather than defects invented from missing testing.

The full change earns 9.6 for its architecture, corrected data-safety paths and matching behavioral/native evidence, while retaining the P3 facade issue and stated verification limits. Resolving the stale guide and remaining compatibility matrix improves consistency without changing the implementation-risk assessment enough to warrant a higher numerical rating. This is a fresh overall judgment, not an automatic score carry-forward. This individual pass does not establish the user's combined three-reviewer gate. Full CI, rendered PR-summary attachments and zero unresolved review threads remain later requirements.
