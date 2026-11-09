# Independent standards and Effect review, round 4

Reviewed 2026-11-09.

- Frozen HEAD: `a7c53575a1cbcc253e5be1d3446ec7e2cb17d8e8`.
- Baseline: `45245daf360d0bd352f28da39b5ddec6978931c1`.
- Literal comparison: `git diff 45245daf360d0bd352f28da39b5ddec6978931c1...a7c53575a1cbcc253e5be1d3446ec7e2cb17d8e8`, 184 changed files.
- Overall rating: **9.4/10**.
- Strictly greater than 9.5 gate: **FAIL** for this independent review.

The ownership, state-safety fixes and regression evidence are strong. Two concrete issues remain in the full change. Neither is a hypothetical consequence of an unperformed platform check. I did not read peers' round-4 reports or exchange ratings before finishing this assessment.

## Findings

### P2: Public platform guidance promises an unsupported macOS version

`messages/en-US.json:349` and `messages/de-DE.json:349` introduce FAQ copy saying native recording/export targets macOS 13 and later. The actual Swift package declares `.macOS(.v14)` at `Package.swift:7`. A read-only inspection of the retained engine, `xcrun vtool -show-build .build/debug/guerillaglass-engine`, also reports `minos 14.0`.

A visitor running Ventura is therefore told this native path supports their OS, then sent to source-build instructions for a package targeting Sonoma. The older README also says 13+, but that does not make the newly authored public claim accurate. This violates REVIEW's documentation/product-truth requirements and the UI-031/UI-032 requirement to describe actual platform availability. Change the new copy to the real minimum and reconcile the setup guidance, unless macOS 13 support is deliberately implemented and validated. Do not lower the native deployment target merely to match marketing text.

### P2: Proposal failures append untranslated native descriptions to German UI

`apps/desktop-electrobun/src/mainview/app/studio/panels/AgentProposalPanel.tsx:162` and `:184` newly append `EngineResponseError.description` to the ordinary validation/apply notice. Those descriptions are English native messages. For example, the stale-plan response at `engines/macos-swift/EngineService+Edit.swift:85` says "The plan does not match the saved project revision and source. Review and rebase the plan." The apply conflict at `:109` has another English sentence. HostBridge forwards these ProjectService failures, and the existing bridge serialization/deserialization retains the description.

With `locale="de-DE"`, a validly shaped stale storyboard therefore produces a German prefix followed by English recovery instructions. This is a source-proven display path, distinct from the disclosed absence of a complete German native test matrix. It violates root AGENTS rule 8 and REVIEW's requirement that user-visible text use both shared message sources. Map the stable response code and task to localized recovery messages; preserve raw engine detail as optional technical diagnostics if needed. Add a German regression using a real `EngineResponseError`, since the current proposal failure test throws a plain Error and only exercises the generic localized fallback.

No P0 or P1 finding established. I found no additional concrete Effect ownership, security or editor-state defect in this pass.

## Architecture and standards assessment

I read root, desktop, web and native AGENTS instructions, REVIEW, EFFECT_PRACTICES, architecture, desktop accessibility and verification-selection guidance. I applied unslop, the Effect skill's service/layer and schema guidance, and the React review guidance. The installed Effect package is 4.1.2; its child-process source confirms the Scope and ChildProcessSpawner requirements used by the new adapters.

The full changed-file inventory was assessed against the 40-finding ledger, current 89-module inventory, improvement research and implementation evidence. This review covers desktop Capture/Edit/Deliver, project identity/history/replacement, inspector/shortcuts/layout, media transport/audio/thumbnails, proposal review, host file/export/quit behavior, native project/capture changes, public web routes/appearance/localization and changed shared primitives. I inspected substantive implementation changes and relevant regressions rather than treating the latest two fixes as the review scope.

Host request handlers remain schema-decoding adapters into the existing runtime. ProjectSession owns native picker and completed-output actions. Fixed AppleScript receives user values through argv. Effect scopes own dialog processes, and quit disposes the runtime from outside that runtime. The final bridge fallback returns an unavailable envelope when disposal interrupts instrumentation. No second runtime, hidden authority default, new direct Node filesystem/path/crypto application dependency, broad Effect cast or handwritten Effect error class was introduced.

Media CORS is applied after the metadata guard and capability lookup. The new bundled origin is an exact `views://mainview` match. Open/Reveal accepts an action, not a renderer-selected path, and uses the host's validated successful output. Thumbnail work is serialized and bounded with abort/element cleanup. Audio decoding bounds bytes and closes its AudioContext. React/TanStack hooks remain legitimate framework boundaries under the repository's Effect practices.

The latest generated-source fix preserves edited timelines, visual settings and both history directions. Only snapshots matching the previous generated timeline adopt refined metadata. Selection derives current IDs and program timing from current lanes, so Undo of a selected split returns to project controls. The browser controller regression at `apps/desktop-electrobun/tests/ui/editor-export-timeline.browser.test.tsx:2151` covers start/stop, native-default refresh, local edits, Undo/Redo, export and Save. The following rendered-inspector tests cover removed selections and surviving-scene timing. Pure model tests cover duration refinement. The native undo screenshot shows the original three-scene project, project inspector and Saved identity.

Native Save As resolves reopened-project assets, preflights missing declared sources and protects an in-place source from deletion. Native tests cover copied media after removing the original, successful export, missing sidecars, in-place saving and recording-session transition behavior. No engine wire schema, generated protocol binding or generated Paraglide file changed.

Controls expose labels/state, export fields associate errors, shared dialogs require localized close labels, collapsed panels are inert and recoverable, and pointer/keyboard paths remain present. Reduced-motion/focus/contrast rules remain in the desktop stylesheet. The web uses static theme colors, request-scoped locale state, a native modal menu and adjacent FAQ answers. Public rendering no longer requires hosted auth. Its source-build and hosted-feature claims are candid apart from the minimum-OS finding above. The roadmap keeps this unmerged pass and the later Phase 2 polish/accessibility gate separate.

## Verification and limits

I ran only read-only probes, including exact-HEAD/status checks, source/diff inspection, the engine minimum-OS inspection and a successful `git diff --check` for the frozen range. I launched no browser or app, ran no build or suite, spawned no agents and edited no product files. Only this report was written.

I inspected round-4 acceptance, focused browser/model, repository, typecheck, type-aware lint, docs and formatting logs. Acceptance records 118 passing tests across 10 browser files, then a passed packaged runtime smoke with process cleanup and zero fatal matches. The 63-case controller run and 11 model cases overlap that evidence and are not added as unique totals. Typecheck reports suggestions, with no type error. The other selected check logs passed. Earlier logs record 159 focused unit tests in 27 files, native compile/save tests, eight web tests and a production web build. Those earlier results remain evidence for unchanged subsystems; I did not independently rerun them.

I directly viewed retained native undo-selection and small Deliver screenshots and the German mobile web image. They support their displayed states, not exhaustive behavioral or assistive-technology claims. The Peekaboo receipt identifies the native application/window. Runtime smoke's unavailable screenshot does not erase that separate native-window evidence.

Granted native capture, audible native audio, VoiceOver listening, every German native failure/layout state, native high-zoom/Events-lane interaction, rendered vertical-output comparison, full CI and Windows/Linux runtime remain unclaimed. Their absence is a verification limit, not an additional defect asserted here. Eventual PR preparation still needs the user's three passing independent scores; PR screenshot attachments and zero unresolved review threads remain later requirements.

The 9.4 rating reflects a coherent, well-tested change with two bounded but definite standards/product-truth defects. It is not rounded up to satisfy the requested threshold.
