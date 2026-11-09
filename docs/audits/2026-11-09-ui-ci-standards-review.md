# Independent standards and Effect reassessment after CI maintenance

Reviewed 2026-11-09.

- Frozen HEAD: `c04c2b2a3ceaa17bd1882b210cbd840f4a1af037`.
- Baseline: `45245daf360d0bd352f28da39b5ddec6978931c1`.
- Complete comparison: `git diff 45245daf360d0bd352f28da39b5ddec6978931c1...c04c2b2a3ceaa17bd1882b210cbd840f4a1af037`, 200 changed files.
- Overall rating: **9.6/10**.
- Strictly greater than 9.5 gate: **PASS** for this independent review.

I found no new P0, P1 or P2 defect. One previously identified P3 standards issue remains. This is a fresh assessment of the complete UI change and the dependency update, not a rating of version-number edits alone. I did not read peers' new CI-update reports, coordinate ratings, average scores or round a failing rating upward.

## Remaining finding

### P3: Desktop components still bypass the existing localization facade

`apps/desktop-electrobun/src/mainview/app/studio/panels/ProgramPreviewControls.tsx:4` and `apps/desktop-electrobun/src/mainview/app/studio/routes/DeliverRoute.tsx:10`, among other changed components, import generated Paraglide messages directly. `docs/CHANGE_MAP.md:106` directs desktop copy through the existing localization model. The translated sources and explicit locale handling work, so this is a maintenance deviation rather than untranslated UI. UI-039 correctly tracks consolidation as outstanding. Neither this CI patch nor the report treats it as resolved.

## CI maintenance assessment

I inspected the complete delta since my `57a47cae10441f75f6f32459ba34cd97071c4c5c` source review. Application production source under desktop/web/shared UI and native engines is byte-unchanged. Runtime dependencies do change, so source identity alone would not establish behavioral safety.

The desktop manifest and Bun lock agree on React Hotkeys 0.22.3 with core Hotkeys 0.26.0. Desktop and shared UI both declare Resizable Panels 4.21.0, and the lock contains that resolved version. No Effect runtime, compiler integration, wire schema or native generated binding changed. This follows REVIEW's dependency-alignment requirements and CHANGE_MAP's dependency-consumer selection rule.

I independently read the official release notes and inspected the installed adapter and recorder implementation. Hotkeys 0.22.3 changes unset element targets and recorder Tab handling. An omitted target still selects the document; an explicitly present null/undefined target waits. The app's `useStudioHotkeys` calls omit target, and I found no relevant provider injecting one. Installed `prepareHotkeyDefinitions` preserves this omitted/present distinction. The preference row owns a recorder hook instance, with local callbacks and cleanup; this is the library recorder instantiated by the app, not a separate recorder implementation. Unmodified Tab cancels before `preventDefault`, and the current onCancel callback clears local error state. There is no new global-target regression apparent in this integration. [Official Hotkeys 0.22.3 release](https://github.com/TanStack/hotkeys/releases/tag/%40tanstack/react-hotkeys%400.22.3).

I also checked the intervening Panels 4.20.0 release, whose new Workspace drop-target variant concerns APIs this application does not use. The 4.21.0 release adds Workspace controls and corrects fractional sizing. The installed declarations retain Group, Panel, Separator, orientation, onLayoutChanged, panelRef and the imperative collapse/expand/getSize/resize methods used by the wrapper and workspace hook. The app reads `getSize().inPixels` and supplies pixel strings, both supported. The selected typechecks and interaction coverage corroborate that source assessment. [Official Panels 4.20.0 release](https://github.com/bvaughn/react-resizable-panels/releases/tag/4.20.0), [official Panels 4.21.0 release](https://github.com/bvaughn/react-resizable-panels/releases/tag/4.21.0).

The Swift helper change at `Tests/macosEngineTests/EngineProjectSaveTests.swift:198` resolves recording, system audio, microphone audio and events URLs into named locals, then constructs the same ordered array. Throwing resolution and Data loading retain their order and failure behavior. It removes the overlong expression without weakening the native media-copy assertions.

## Full-change conclusions

The original source review covered Capture/Edit/Deliver, project identity and dirty state, bounded timeline/visual history, save/replacement/quit safety, transport/audio/thumbnails, scene cameras/selection/proposals, inspector/preferences/layout, typed host services and native project/capture behavior, public web rendering/appearance/localization/navigation, and changed shared primitives. I reassessed those conclusions against this complete frozen comparison and the current evidence, rather than reducing the scope to the CI failure lines.

Root AGENTS rules and REVIEW's Effect/architecture requirements remain satisfied. One scoped runtime owns host services. Schema-decoding bridge adapters delegate to those services; native dialogs use scoped Effect processes with fixed script and argv input. Completed-export actions retain host-owned validated paths. Quit cleanup originates outside the runtime it disposes. No new direct Node filesystem/path/crypto application dependency, hidden authority default, broad Effect cast or parallel wire contract appears.

The security and persistence conclusions remain intact. Media CORS follows metadata checks and token authorization, including the exact bundled origin. Native Save As copies reopened-project assets, preflights declared missing sources and preserves in-place sources and traversal/symlink defenses. One document history owns timeline and visual edits, explicit save retains history, committed replacement resets it, and metadata refinement preserves edited drafts. Selection follows current scene IDs/timing. Program transport owns gaps, seeking and replay; preview listening state stays separate from saved/exported settings. Export validates explicit range mode and endpoints before choosing a destination.

Keyboard naming/state, focus, inert collapsed panes with restoration, associated export errors and localized dialog controls remain in place. Public web rendering stays independent of hosted auth, with request-scoped locales, static appearance colors, modal menu focus handling and adjacent FAQ answers. Product claims still match the macOS 14 manifest and identify source-build availability, experimental cross-platform engines and unshipped hosted/paid features. The native proposal error mapping remains localized by code/task. Active docs retain the later Phase 2 and release acceptance limits.

## Verification and limits

My own work used read-only source/diff/log inspection, installed dependency inspection, official release retrieval and `git diff --check` for the frozen range. The whitespace check passed. I viewed the committed native dependency-layout screenshot. I launched no app/browser, ran no suite/build, spawned no agents and edited no product files. Only this report was written.

I inspected receipts for 32 focused shortcut/layout units, 124 browser tests across ten files, desktop and shared UI typechecks, twelve native ProjectStore/EngineProjectSave tests, repository/docs/type-aware lint/formatting, frozen install and empty dependency-freshness output. Packaged runtime acceptance passed with process cleanup and zero fatal matches. These are author-run receipts, not independent reruns; overlapping runs are not added as unique test totals. The selected SwiftFormat receipt reports zero files requiring formatting. SwiftLint output retains warning-level long lines elsewhere in the test file, but the former 218-character failure expression is gone. The CI workflow pins SwiftFormat 0.62.1 and installs SwiftLint through Homebrew; I do not treat the latter as a version pin.

The native image and Peekaboo receipt show the affected packaged app, collapsed project pane and named restore control. The recorded native B/Blade and collapse/restore interaction supports the updated dependency integration. A single screenshot alone does not establish the entire sequence. Earlier retained native save/export/proposal/history evidence remains applicable to unchanged production source.

Remote CI has not run for this frozen update. Earlier passing Rust/protocol/parity jobs do not certify the new head, and local receipts do not replace the required new-head CI result. Granted native capture, audible native playback, VoiceOver listening, every German failure/layout combination, native high-zoom/Events-lane interaction, rendered vertical-output comparison and Windows/Linux runtime remain unclaimed. PR screenshot attachments and zero unresolved review threads remain merge requirements.

The complete change earns 9.6 because the ownership and data-safety implementation remains strong, and the runtime dependency changes have matching source/API, focused behavioral and packaged evidence. The outstanding P3 and disclosed acceptance limits prevent a stronger claim. The update introduces no substantiated defect that lowers this assessment, but passing this individual score does not certify CI or the combined reviewer gate.
