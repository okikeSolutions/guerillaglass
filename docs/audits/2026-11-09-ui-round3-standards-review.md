# Independent standards and Effect review, round 3

Reviewed 2026-11-09.

- Frozen HEAD: `7adcc9b07cf1d5691aa68941f41b01d341d244c5`.
- Baseline main: `45245daf360d0bd352f28da39b5ddec6978931c1`.
- Comparison: `git diff 45245daf360d0bd352f28da39b5ddec6978931c1...7adcc9b07cf1d5691aa68941f41b01d341d244c5`, 180 files.
- Overall rating: **9.6/10**.
- Strictly greater than 9.5 gate: **PASS** for this independent review.

I found no remaining concrete defect that warrants a prioritized finding in this frozen change. This is my assessment of the complete change against repository standards, rather than an average of other ratings or approval based only on the latest fixes. I did not read another reviewer's new round-3 report or exchange ratings before finishing.

## Findings and verified corrections

No P0, P1, P2 or P3 finding established in this pass.

The previous standards finding is fixed at `apps/desktop-electrobun/src/mainview/app/studio/hooks/core/useStudioMutations.ts:540`, `:653` and `:696`. Successful recording start, Open and Recent Open reset the export mutation. Cancelled and failed replacement retain the result for the retained document. The browser regression at `apps/desktop-electrobun/tests/ui/editor-export-timeline.browser.test.tsx:1999` exercises successful export followed by cancelled, failed and committed replacement, including the rendered Open video action. That satisfies the truthful result-ownership requirement in `REVIEW.md` and UI-018 without requiring the host to accept renderer-provided file paths.

The other historical round-2 findings also have direct changes. The preview seek input pauses before pointer or keyboard scrubbing, and the playback store restarts at EOF. Tests cover source reordering, gaps, fractional duration and natural completion. Permission recovery names Input Monitoring and separately explains Screen/Microphone settings. Storyboard decoding uses Result-based schema validation with localized syntax, version, missing-field, invalid-field, duplicate-scene and size diagnostics. Keyboard Blade activation uses the program playhead. Collapsed panes have labeled restoration buttons and inert contents. Narrow clips hide secondary metadata through a container query. These are substantive fixes, with regressions at the relevant model or browser layer.

## Architecture and standards assessment

I read root and desktop/web/native AGENTS instructions, `REVIEW.md`, `docs/EFFECT_PRACTICES.md`, verification selection, architecture and accessibility guidance. I assessed the 40-finding ledger, component inventory, UI research and implementation evidence against the full changed-file inventory. I read the Effect skill's schema and service/layer references, the unslop skill and the React review guidance. The installed desktop Effect version is 4.1.2. Its child-process implementation confirms command effects require the spawner and Scope.

Host requests retain schema decoding and thin adapters into the existing runtime. ProjectSession owns native file dialogs and completed-output actions. New dialog processes use fixed AppleScript with values passed through argv, scoped acquisition and typed PathPickerError mapping. Long-lived runtime ownership stays at the application root. Graceful quit runs disposal outside the runtime it closes, coalesces requests and permits cancelled/failed confirmation to retry. The final bridge boundary returns a safe unavailable envelope if disposal interrupts response instrumentation. No new direct Node filesystem/path/crypto dependency or second runtime appears in the change.

Media reads still require the metadata guard and capability-token lookup before accepted-origin CORS reflection. The added bundled origin is the exact `views://mainview` string. Completed-export actions accept only open/reveal and act on the host-owned validated output. Thumbnail decoding has one serialized decoder, bounded frame storage, cancellation and element cleanup. Audio decoding bounds input bytes and closes its AudioContext. Renderer hooks remain React/TanStack code, as permitted by the Effect practices document; they do not need application Effect services.

Editor history owns persisted timeline and visual settings together. Semantic signatures ignore native timestamp/key-order differences, preserve meaningful optional-field distinctions and keep explicit save rebasing separate from arbitrary query refresh. Successful replacement resets history even for the same package. Failed recording start retains the document, while successful native start establishes fresh ownership before fallible reconciliation. Native Save As resolves reopened-project assets, preflights missing declared assets, and avoids deleting an in-place source. The added native tests cover copied media, missing sidecars, source removal, in-place saving and recording-session transitions.

Both message sources cover new copy. File-action errors survive JSON bridge transport through stable localized codes. Fields and mode controls have names/state, dialogs provide focus handling, collapsed content is inert, and reduced-motion/focus conventions remain present. The public site uses request-scoped localization, static theme colors, a modal mobile menu and adjacent FAQ answers. It renders independently of hosted auth. Its source-build CTA and platform/hosted-feature descriptions match current capability limits. No generated engine contract, Swift/Rust binding or Paraglide file changed, so contract regeneration is not required.

I directly viewed the committed packaged Edit, denied Capture, restored-pane and storyboard-diagnostic screenshots. They support the shown hierarchy and recovery states. They do not prove all interaction, screen-reader or platform combinations. The roadmap and ledger retain their acceptance limits instead of declaring the entire Phase 2 editor complete.

## Verification and limits

I ran read-only source/diff checks, confirmed the exact HEAD and ran `git diff --check` for the frozen range successfully. I launched no app/browser, spawned no agents, ran no build or suite, and edited no product files. Only this report was written.

I inspected the round-3 acceptance, desktop typecheck, focused unit, type-aware lint, repository, documentation and format logs. Acceptance records 115 passing tests across 10 browser files, followed by a passed packaged runtime smoke, successful process cleanup and zero fatal matches. The focused unit log records 10 passing tests in two files. The typecheck contains suggestions but no reported type error. The other logs record passing checks. Earlier `unit-final.log` records 159 tests in 27 files. The native save log executes six ProjectStore and six EngineProjectSave tests successfully; unrelated zero-test targets are not counted. The implementation evidence also records native compilation, web/shared typechecks, eight web tests and a production web build. I did not rerun or independently certify those earlier commands.

This evidence fits the affected desktop, native persistence, web and shared-UI subsystems. Granted native capture, audible native playback, VoiceOver listening, the full German failure/layout matrix, native high-zoom/Events-lane interaction, rendered vertical-output comparison, full CI and Windows/Linux runtime remain disclosed limits. I have no concrete regression to report from their absence alone. They prevent treating this score as release certification. Screenshot attachment in the eventual PR summary and zero unresolved review threads remain later PR/merge requirements.

The 9.6 rating reflects a coherent implementation with corrected ordinary-use defects, appropriate ownership and meaningful regression evidence. The remaining deduction reflects the bounded acceptance evidence and broad change scope. It does not waive any outstanding release check or establish the other two independent ratings required by the user.
