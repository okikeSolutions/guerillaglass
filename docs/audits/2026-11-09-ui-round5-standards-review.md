# Independent standards and Effect review, round 5

Reviewed 2026-11-09.

- Frozen HEAD: `aaa61bcb9f8500253783987a15b228843206eb65`.
- Baseline: `45245daf360d0bd352f28da39b5ddec6978931c1`.
- Literal comparison: `git diff 45245daf360d0bd352f28da39b5ddec6978931c1...aaa61bcb9f8500253783987a15b228843206eb65`, covering the complete 190-file change.
- Overall rating: **9.6/10**.
- Strictly greater than 9.5 gate: **PASS** for this independent review.

I found no P0, P1 or P2 defect in the reviewed change. Two small standards/documentation issues remain below. They do not undermine the shipped behaviors or justify blocking this UI pass. The score is my assessment of the complete frozen change and its evidence, not an average of prior ratings or a release certification. I did not read peers' round-5 reports or exchange ratings before completing this report.

## Findings

### P3: New desktop components bypass the existing localization model

`apps/desktop-electrobun/src/mainview/app/studio/panels/ProgramPreviewControls.tsx:4` imports generated Paraglide messages directly and passes locale options at each use. The same new pattern appears at `apps/desktop-electrobun/src/mainview/app/studio/routes/DeliverRoute.tsx:10` and several other changed desktop components. The messages themselves are shared, translated and correctly localized, so this is a maintenance issue rather than untranslated UI.

The explicit convention at `docs/CHANGE_MAP.md:106` says to expose messages through the existing localization model instead of importing generated messages throughout components. Move these message groups into the shared localization facade when consolidating this code. That preserves one interface for desktop copy and avoids repeated locale plumbing. This finding does not apply to the web's established direct-message convention.

### P3: Accessibility guidance still gives the former location of the single-key preference

`docs/DESKTOP_ACCESSIBILITY.md:74` says single-key shortcuts are user-toggleable in Capture Inspector. This change moves the checkbox to global Preferences at `apps/desktop-electrobun/src/mainview/app/studio/layout/StudioShellHeader.tsx:445` and removes it from Capture Inspector. Update the guide to name Preferences so future agents and keyboard-verification work use the actual location.

Standard: `REVIEW.md`, Universal review, Documentation requires active operational guidance to match implementation. The underlying setting remains available and works through the existing form state, so this is documentation drift, not loss of the accessibility control.

## Scope and assessment

I read root, desktop, web and native AGENTS instructions, REVIEW, EFFECT_PRACTICES, the relevant architecture/accessibility and verification-selection guidance, and the four UI review/specification documents. I applied unslop, the Effect schema/service/layer guidance and the React review guidance. I checked the installed Effect 4.1.2 child-process source rather than assuming APIs from another version.

The review includes Capture/Edit/Deliver, identity/dirty state and history, replacement and quit protection, media recovery/transport/audio/thumbnails, scene selection/cameras and proposal review, inspector/preferences/shortcuts/layout, host dialogs and export-result actions, native project/capture changes, public web rendering/localization/appearance/navigation and changed shared primitives. I inspected the baseline-to-head diff and followed the substantive changed paths into current source and regressions. Historical review reports served only to check previously identified corrections.

Effect and host ownership follow root AGENTS rules 3, 5, 6 and 12 and REVIEW's Desktop/Engine sections. Schema-decoding bridge handlers delegate to the existing runtime and services. ProjectSession owns picker and completed-export actions. Named effects wrap native dialog processes; scopes own those processes, and the existing Node platform layer supplies ChildProcessSpawner. Fixed AppleScript receives names/prompts/locations as argv. Quit begins runtime disposal outside the runtime being disposed, coalesces requests and retains a truthful unavailable bridge envelope during teardown. I found no second runtime, new direct Node filesystem/path/crypto dependency, hidden authority default or broad Effect cast.

The media CORS response follows the request metadata guard and token lookup. `views://mainview` is an exact additional accepted origin. Result Open/Reveal accepts an action and uses the host's remembered successful, path-policy-validated export, rather than accepting an arbitrary renderer path. Native Save As resolves the reopened package's assets, checks missing declared sources before replacing destination media and preserves in-place sources. Existing traversal and symlink checks remain in place. These paths meet REVIEW's security and persistence requirements within the scoped change.

Editor semantics remain in deterministic domain functions and one bounded history. Explicit saves preserve undo history; committed replacement resets it. Metadata refinement rebases only untouched generated timeline snapshots. Selection is derived from current lanes and IDs after Undo/Redo. Program transport owns seeking/playback, including gaps and EOF replay; stale source events cannot replace newer program commands. Preview listening state is separate from persisted/exported settings. Export uses explicit range mode/endpoints and rejects invalid ranges before opening the picker. Unsupported mixer controls and event-derived waveform output are removed, and audio presentation retains unknown/absent/silent/unavailable distinctions.

Keyboard paths, accessible labels/state and focus handling are present in the changed controls. Collapsed panes become inert and have named restore actions. Shared dialogs require localized close copy. Export fields reference their error notice. The public menu uses a modal dialog with keyboard containment, Escape and focus return; FAQ uses adjacent details/summary. Desktop focus/reduced-motion conventions remain available, and the public stylesheet removes entrance motion and supplies explicit backgrounds and focus indicators. These satisfy the source and focused-browser portions of REVIEW's UI requirements; assistive-technology limits remain below.

The round-4 compatibility defect is corrected in both FAQ locales, README and SPEC, matching `.macOS(.v14)` in Package.swift. The new web regression compares both translations with that manifest. The proposal panel maps native `project_mismatch` and `invalid_params` plus task to shared localized recovery, and unknown failures to localized fallback. Six German browser cases throw real EngineResponseError values across validation/application. The retained packaged screenshot shows a fully German stale-project notice without appended English engine detail.

Public pages no longer require hosted auth. Source-build availability, experimental Windows/Linux engines and unavailable paid/hosted features are described candidly. The website demo is identified as a browser recording exported by the macOS engine. The roadmap distinguishes this unmerged UI pass from later Phase 2 features and release-wide polish/accessibility work. There are no changed engine wire contracts, generated native bindings or committed generated Paraglide sources.

## Verification and limits

My own actions were read-only source/diff/log inspection, exact HEAD/status checks, installed-package inspection, `git diff --check` for the frozen range, and viewing retained images. The whitespace check passed. I launched no app or browser, ran no build or suite, spawned no agents and changed no product files. Only this report was written.

I inspected round-5 acceptance, proposal, repository, docs, desktop/web typecheck, lint, formatting and web test/build logs. Acceptance records 124 browser tests across 10 files followed by a passed packaged runtime smoke, process cleanup and zero fatal matches. The separate 15-case proposal run overlaps acceptance and is not an additional unique total. Web tests record nine passes across three files. Desktop typecheck emits suggestions, with no type error. Repository/docs, type-aware lint, web typecheck, production web build and formatting logs pass. The desktop bundle-size warning remains informational; no measured performance result is inferred from it.

Earlier scoped evidence records 159 unit tests across 27 files, 11 history/selection model tests, native engine compilation, and six ProjectStore plus six EngineProjectSave tests. I checked those receipts and relevant tests. The many zero-test Swift target summaries at the end of the selected native run are not counted as tests. The current acceptance run also recompiles the engine. I did not rerun these suites independently.

I viewed the German native stale-proposal screenshot, native undo-selection and small Deliver screenshots, and German mobile web image. The Peekaboo receipt identifies Guerillaglass-dev and its native window. Runtime smoke's unavailable screenshot does not replace that separate native evidence. The mobile-home image is correctly disclosed as predating the latest editor illustration, so it proves that layout rather than the later asset revision.

Granted native capture, audible native playback, VoiceOver listening, every German native failure/layout combination, native high-zoom/Events-lane interaction, rendered vertical-output comparison, full CI and Windows/Linux runtime remain unclaimed. These are disclosed acceptance limits, not additional defects asserted without evidence. Full CI, directly attached PR screenshots and zero unresolved review threads remain later review/merge requirements. This individual passing score does not establish that the user's three-reviewer gate has passed.

The 9.6 score reflects strong ownership, corrected data-safety paths and substantial matching behavioral/native evidence, with the two low-risk standards issues and the stated acceptance limits. It is strictly above 9.5 without rounding.
