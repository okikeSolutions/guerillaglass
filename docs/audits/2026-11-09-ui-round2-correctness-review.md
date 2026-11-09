# Independent frozen correctness review, round 2

Reviewed on 2026-11-09.

- Baseline: `45245daf360d0bd352f28da39b5ddec6978931c1`.
- Frozen head: `8bdd37b19b04f1aa2004eb9de6821f8091528f3d`.
- Range: `git diff 45245daf360d0bd352f28da39b5ddec6978931c1...8bdd37b19b04f1aa2004eb9de6821f8091528f3d`.
- Verified workspace HEAD and merge base against those hashes.
- Overall readiness: **9.2/10**.
- Strictly greater than 9.5 gate: **FAIL**. This review does not authorize PR preparation.

The previous document-safety findings have direct fixes and meaningful regression coverage. The new transport still has two concrete playback defects. Neither destroys project data, but both affect ordinary use of the replacement preview controls in Edit, Deliver and fullscreen. I would fix them before treating this UI pass as ready under the user's review gate.

## Findings

### P2: The program seek slider does not seek the video during playback

Primary location: `apps/desktop-electrobun/src/mainview/app/studio/panels/ProgramPreviewControls.tsx:69`. Related implementation: `apps/desktop-electrobun/src/mainview/app/studio/hooks/useVideoPlaybackSync.ts:126` and `:243`, and `apps/desktop-electrobun/src/mainview/app/studio/hooks/timeline/useStudioTimeline.ts:265`.

Reproduction:

1. Open a project with a clip at least 10 seconds long.
2. Click Play preview and let playback reach about 1 second.
3. Drag the preview Playhead slider to 7 seconds while playback continues.
4. The source video stays near 1 second. The next animation frame writes the old media time back to the program clock, so the slider jumps back.

The new range input calls the store-based program seek. That setter does not pause or seek the media. `syncPausedSeek` explicitly returns while playing, and `syncPlaybackActive` only responds when `isPlaying` changes. The animation loop then treats the old `media.currentTime` as authoritative. Seeking between reordered scenes can also resolve the old source time through the newly selected scene before any actual source seek occurs.

I confirmed the single-clip case with a lightweight in-memory probe executing the current `useVideoPlaybackSync` function body, the real playback store and real timeline-resolution helpers. The probe supplied hook-registration shims, a fake media element and controlled animation frames. Its output was:

```text
playing before slider seek 1 1
immediately after slider seek 7 1
after next playback frame 1 1
```

Each pair is program time followed by media time. This is a code-level behavioral reproduction, not a live-browser claim. It did not launch an app or modify product files.

The baseline used native video controls, whose seek directly changes media time. The replacement control now routes that interaction through a store path which only synchronizes paused seeks. Either pause before scrubbing or distinguish explicit program seeks from media-clock updates and apply them to the source while playing. Add browser coverage that operates the rendered slider during active playback, including a jump across reordered clips and a gap.

### P2: Play preview at program EOF reports playing without starting media

Primary location: `apps/desktop-electrobun/src/mainview/app/studio/panels/ProgramPreviewControls.tsx:54`. Related implementation: `apps/desktop-electrobun/src/mainview/app/studio/hooks/useVideoPlaybackSync.ts:82` and `:205`.

Reproduction:

1. Play a nonempty program to completion, or move its playhead to the exact endpoint while paused.
2. Click Play preview.
3. The button changes to Pause preview, but the picture remains stopped at the last frame. The animation loop keeps running at EOF.

The button toggles the store to playing without rewinding. At the exact program duration, `resolveTimelinePlaybackAtProgramTime` returns `ended`, so `playCurrentClip` returns without calling `media.play()`. The animation loop's non-clip branch returns `true`, leaving that false playing state active.

A second in-memory probe using the same current hook/store/helpers began at program time 10 of 10 and clicked the equivalent store Play operation. After a playback frame it reported:

```json
{"playhead":10,"isPlaying":true,"mediaPaused":true,"mediaPlayCalls":0,"nextFrameScheduled":true}
```

Replaying a completed program should rewind and play, or have another explicit endpoint behavior which does not claim playback started. Add a rendered transport regression after natural completion and after seeking to EOF. Include a trailing-gap program because its final display state follows a different media path.

## Fixes verified from the previous frozen review

Successful Open and Recent Open now call the history reset even when the same package, media and saved contents return. Failed or cancelled opens keep the draft. The same-package browser coverage now invokes the actual open mutations, and the retained native replacement proof shows Escape preserving changes and explicit Discard restoring the saved state and Full program export range.

A successful native start now commits new recording ownership before fallible status/project reconciliation. Failed reconciliation produces recoverable information, and duplicate recording commands are guarded through reconciliation. Native `beginProjectForRecording` retires the prior project only after successful recording start and preserves idempotent starts. The finished-recording path also preserves the returned completed take when stopping preview fails.

The inspector distinguishes an absent camera from an explicit empty camera array. The static override has a reachable reset, and its history behavior has rendered coverage. Save As resolves reopened-package assets, checks declared source existence before media replacement, and skips copying a file onto itself in an ordinary in-place save. Native tests cover reopened-copy media, missing declared sidecars and the saved document after source removal.

## Scope and validation assessment

I read root, desktop, native and web AGENTS instructions, `REVIEW.md`, the verification-selection guidance, the UI research/inventory/ledger and current implementation evidence. I used the full 169-file changed-file inventory, reviewed production changes across controller/history/mutations, recording/project transitions, proposal validation/adoption/scene playback, preview/fullscreen/audio, timeline/inspector/range export, host dialogs/security/output actions/quit lifecycle, native project IO, public routing/localization/theme/navigation and shared UI changes. Tests, fixtures, documentation and retained evidence were assessed as supporting changes. This was an independent review; I did not read other reviewers' new reports or obtain their new ratings.

I inspected retained native screenshots for Edit, fullscreen, small-window Deliver, replacement confirmation, proposal preview and denied Capture. They establish those shown states. They cannot establish playing seeks or replay from EOF. The current browser tests exercise paused seeks, exact EOF display, gaps, source-end transitions, fullscreen targeting and volume persistence. They do not exercise either failing interaction above.

The retained latest `desktop-acceptance.log` records 10 browser files and 103 passing tests plus packaged runtime smoke, successful cleanup and zero fatal-pattern matches. `unit-final.log` records 27 files and 159 passing tests. Native logs show 6 ProjectStore and 6 EngineProjectSave tests passing, and the Swift fast build passed. Web logs record 3 files and 8 passing tests and a completed production build. Typechecks, lint, repository, documentation and formatting checks are recorded as passed. I ran `git diff --check` for the frozen range, which passed, and the two focused in-memory playback probes above. I did not rerun builds or suites, launch apps, use another browser, or edit product code.

The change does not alter the engine wire contract or generated protocol sources. Its remaining granted native capture, audible audio, source-removal recovery, rendered vertical-file comparison, native high-zoom scrolling and VoiceOver checks remain explicit release-verification limits. I am not treating those unclaimed checks as concrete regressions. Full CI and Windows/Linux validation remain pending before merge. Screenshot attachment in the eventual PR and the zero-unresolved-review-thread gate also remain required.

The corrected safety paths are substantially stronger than the earlier freeze. The two reproducible transport failures prevent my overall rating from exceeding 9.5. Fix those interactions, run focused browser coverage plus the applicable checks, then obtain fresh independent ratings against the next frozen commit.
