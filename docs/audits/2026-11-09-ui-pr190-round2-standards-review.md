# PR #190 corrected-head standards and Effect review

Reviewed original base `45245daf360d0bd352f28da39b5ddec6978931c1` through corrected head `7d78ff3da6a6c9617b765f081b8447d3d2cae931`, including the complete production/test/documentation correction delta after `6ecb35e`. Overall PR readiness from the standards/Effect axis is **9.6/10**. This axis passes with no actionable findings. New-head CI remains a merge prerequisite.

The earlier full-PR standards review and this delta review use root/subsystem AGENTS.md, REVIEW.md, ARCHITECTURE.md, EFFECT_PRACTICES.md, CHANGE_MAP verification selection, the Effect skill and all twelve Fowler heuristics. I checked the updated evidence and ledger without opening peer or historical scored review reports. Documented repository rules override heuristic smells.

No hard rule breach was found. The corrections keep native persistence decisions in ProjectStore, renderer interaction in its existing hooks, and capture acquisition through the typed engine boundary. They introduce no host runtime, direct Node application IO, wire DTO, generated binding, persisted format or dependency change. The full PR continues to retain scoped host resources, thin transport adapters, host-owned completed-output authority, guarded tokenized playback and local operation independent of hosted services.

`engines/macos-swift/modules/project/ProjectStore.swift:107` checks symlink components before accepting a missing reserved recording. It examines both stored and proposed documents, so a media-free package can retain its legacy default filename while a proposed timeline, capture metadata, telemetry or declared sidecar still requires actual recording media. `EngineService+Project.swift:117` resolves this before destination writes. Added tests cover in-place Save, Save As, rejection of new content without media and preservation of an existing destination. This follows REVIEW.md's migration, validation and failure-state rules.

`apps/desktop-electrobun/src/mainview/app/studio/hooks/useVideoPlaybackSync.ts:347` requires both current program playback and current media EOF before advancing. Tests retain genuine EOF continuation and reject delayed events after pause or newer seeks. The external program transport remains the owner.

`src/mainview/app/studio/hooks/core/useStudioMutations.ts:490` stops an existing preview before acquiring the requested recording configuration. Source/audio/FPS controls use their existing primitives' disabled semantics. CaptureRoute supplies a shared English/German explanation and Stop preview recovery. The regression checks request order and arguments, disabled state and unlocking. I found no substantial new Fowler smell; extracting these small guards or native checks would add indirection without a demonstrated maintenance benefit.

The updated ledger preserves the failed fresh-review round and requests reassessment. Evidence distinguishes native play/pause and denied permission observations from browser-only late-event/active-lock checks. It also states the detached-picker attestation limit and CUA fallback. Granted capture/audio, VoiceOver, broader accessibility/performance proof and UI-039 facade consolidation remain explicit follow-ups, not completed acceptance.

This review ran no apps or test/build suites. The pinned full diff passes `git diff --check`. The supplied local proof covers 15 Swift cases, 130 browser cases, packaged acceptance and selected static checks. Seven green CI checks belong to `6ecb35e`; they do not certify this local corrected head. Require new-head CI and zero unresolved review threads before merge.

PR https://github.com/okikeSolutions/guerillaglass/pull/190 head 7d78ff3 local pass/new CI pending, standards/Effect review passed with no actionable findings.
