# PR 190 current product/spec/visual review

Frozen comparison: `45245daf360d0bd352f28da39b5ddec6978931c1...6ecb35e3f23527601168d193accbabcce2afa3a4`. Reviewed the range log and diff, requirements, inventory, ledger, research and retained implementation evidence. No app launch, build, test suite, source change or GitHub mutation was performed. Historical scored review reports and peer reports were excluded.

Overall PR-readiness score: **9.3/10. Request changes.** The user's requirement that all three scores exceed 9.5 is not met by this review.

## Finding

**P2: Record can use a different source/audio configuration from the visible setup.** In `apps/desktop-electrobun/src/mainview/app/studio/hooks/core/useStudioMutations.ts:490`, an already running preview bypasses `startCaptureInternal`. That is the only path that supplies source, microphone and capture FPS. The subsequent recording call at line 521 only supplies input tracking. Meanwhile `routes/CaptureRoute.tsx:198` permits changing the source, and `panels/inspector/InspectorModeContent.tsx:189` and line 211 permit changing microphone/FPS. The diagnostic rows at line 234 also describe the form values rather than the active stream configuration.

Trigger: choose source A with microphone disabled, use the native Capture > Start preview command, change to source B and enable microphone, then select Start Recording. The recording reuses A and the old audio setup. Changing these controls during recording similarly presents settings that do not affect that take. This is a source-derived defect, not a newly exercised native recording. It also exists on the base commit, so it is an unfulfilled UI-pass requirement rather than an introduced regression. SPEC §1.1 requires "Fast record entry and reliable source/audio control"; the current-pass evidence promises selected-source semantics. Reconcile or restart the preview before recording, or freeze and clearly label the active configuration. Add focused coverage for preview A -> select B/mic -> Record and active-recording controls.

## Product assessment and limits

The visual change is substantial. Labeled navigation, project identity/history, restrained property rows, real thumbnails, external transport, output preview and explicit range selection make Record -> Edit -> Deliver coherent. Proposal comparison now has readable intent, before/proposed playback and explicit apply confirmation. Native save/replacement dialogs and localized recovery improve trust. Public pages replace unsupported commercial claims with honest source-build guidance and real product evidence. These choices follow the practical principles in [Emil's guidance](https://emilkowal.ski/ui/you-dont-need-animations), [Screen Studio's export guide](https://screen.studio/guide/exporting-the-video), and [Cap's local-project workflow](https://cap.so/docs/recording/studio-mode). Competitor feature breadth is not a new requirement for this PR.

Some retained Deliver captures crowd short scene labels, while the current source hides secondary metadata using container queries. I treat that as a screenshot-freshness/polish follow-up, not a demonstrated current defect. Full manual camera authoring, captions and redaction remain correctly separate roadmap work.

Granted native capture/audio, VoiceOver listening, broader pane/height combinations and long-project usability remain release-verification limits. Green CI and retained native receipts do not establish those outcomes. No additional blocker was established in keyboard/focus, reduced-motion, localization, responsive recovery or hosted-offline behavior.

## Coverage

All 40 ledger acceptance statements were considered against the 89-module inventory. Source inspection concentrated on changed workflow routes, shell/preferences, timeline, inspector, proposal/media controls, mutations/hotkeys, shared dialogs/theme and public routes/styles. This is not a rendered gallery or a complete assistive-technology audit of every library prop combination.

Inspected actual images with `view_image`: current editor, denied Capture, Deliver, small Edit/Deliver, vertical output, proposal review/preview/diagnostics/German stale recovery, German preferences, dependency pane restoration, replacement confirmation, German mobile/FAQ/About/404, plus baseline editor/Capture/Deliver/mobile hero comparisons.

PR https://github.com/okikeSolutions/guerillaglass/pull/190, head `6ecb35e`, checks green, product review requests changes at 9.3/10.
