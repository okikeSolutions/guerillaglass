# PR #190 corrected-head correctness review

Overall PR readiness: **9.3/10**. The strictly-above-9.5 gate does not pass. One actionable P2 playback defect remains.

Frozen comparison: base `45245daf360d0bd352f28da39b5ddec6978931c1`, head `7d78ff3da6a6c9617b765f081b8447d3d2cae931`. This overall assessment carries forward my independent review of the full original PR range and inspects the complete implementation delta from `6ecb35e` to this head. I did not read peer corrected-head reports.

## Finding

**P2, EOF continuation can stall after the new stale-event guard.** `apps/desktop-electrobun/src/mainview/app/studio/hooks/useVideoPlaybackSync.ts:257`, interacting with the new guard at line 349.

Trigger: the source reaches natural EOF in a clip followed immediately by another clip. The video is paused and reports `ended=true`, but the animation-frame callback runs before the queued `ended` event. The animation-frame path seeks to the following source interval and updates the program clock without calling `playMedia`. Seeking clears the media's ended state while leaving it paused. The later ended handler now rejects the event because `media.ended` is false. The transport remains playing, but media and program time no longer advance.

I reproduced this ordering using the actual hook in a tiny Bun simulation with mocked React effects and a stateful media object. After the frame callback and ended dispatch, the result was `mediaPaused=true`, `mediaEnded=false`, `mediaTime=0`, `playCalls=0`, `playheadSeconds=1`, `isPlaying=true`. This is deterministic control-flow evidence, not a native browser reproduction. Browser media event tasks and rendering callbacks can produce this ordering.

Resume media during the animation-frame transition when the active transport still owns playback, or otherwise centralize EOF continuation so either callback order completes it. Add a regression that sets paused/ended at source EOF, executes the frame callback first, clears ended on seek, then delivers the queued event. The new genuine-EOF test dispatches ended directly, so it does not cover this order.

## Fix assessment and proof limits

The prior empty-project Save regression is addressed. Both persisted and proposed documents must satisfy the media-free legacy case; recording-backed content still rejects missing sources. Symlink checks remain before filesystem existence checks. Tests cover empty in-place Save, Save As, missing recorded media and introducing timeline references into an empty package.

The prior paused/stale-ended restart is addressed for the tested event-first orders. Capture now reacquires preview with requested source/audio/FPS, disables active configuration controls, and exposes Stop preview recovery. I found no further concrete ownership or security regression in these changes.

Inspected retained receipts report 15 selected native tests, 130 browser tests, packaged acceptance, typecheck, lint, repository/docs and formatting checks passing. I launched no apps, browsers, builds or suites. Native screenshots and reported Peekaboo interaction support ordinary Play/Pause and denied Capture only. Granted recording/audio and full accessibility/platform checks remain unverified. New-head CI is pending; old-head green CI does not cover these fixes.

PR https://github.com/okikeSolutions/guerillaglass/pull/190 head 7d78ff3 checks local pass/new CI pending; review state changes requested, 9.3/10.
