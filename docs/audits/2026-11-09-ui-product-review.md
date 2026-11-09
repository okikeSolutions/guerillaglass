# Independent product review

Reviewed 2026-11-09. Head `013123631c5402304bf9f8837de83b35f978cc56`, comparison baseline `45245daf360d0bd352f28da39b5ddec6978931c1`. I used those SHAs, not local main. This assessment covers the complete UI improvement pass, not only the most recent fixes. I did not read the other frozen reviewers' reports.

**Overall score: 8.4/10. The strictly greater than 9.5 PR gate fails.**

The pass makes the product much more trustworthy and easier to understand. Labeled workflow navigation, visible save state, actual thumbnails, camera inspection, history, native Save As, explicit export ranges and real output actions solve substantial problems. The public website is now coherent and honest about availability. The research and ledger are useful, detailed work. The remaining playback and audio-state gaps are concrete unfinished requirements, however, and the editor still gives too many unrelated actions equal weight. I would not call this exceptional, finished product design yet.

## Rubric

| Criterion | Weight | Score | Reason |
| --- | --- | --- | --- |
| Correctness and state truth | 25% | 8.7 | Much stronger project safety, ranges and recovery. Audio-state ambiguity and lost preview controls remain. |
| Task clarity and discoverability | 25% | 8.0 | Capture/Edit/Deliver are legible. Recording and permissions still compete with editing/export, and file actions repeat across three locations. |
| Visual polish and composition | 20% | 8.1 | Calmer property rows and better type help. Toolbar density, metadata repetition and proposal orientation remain visibly rough. |
| Research and product direction | 15% | 9.2 | Relevant primary-source competitor and Emil research, specific recommendations, honest limits and no invented differentiation claim. |
| Completeness and evidence | 15% | 8.4 | Broad source inventory, real packaged screenshots, built-site screenshots and substantial checks. Several original acceptance clauses remain unmet; live capture/audio and assistive-tech limits remain explicit. |

Weighted result is 8.41, reported as 8.4. This is an assessment, not a measured usability statistic.

## Findings that block this product gate

### P2: The Audio lane still fails to explain whether audio exists

`apps/desktop-electrobun/src/mainview/app/studio/hooks/timeline/useTimelineWaveform.ts:151` reduces pending, unavailable/unsupported decode and failure to the same nullable return at line 169. `domain/timelineDomainModel.ts:438` creates an Audio clip for every timeline item regardless of that result. `panels/TimelineSurface.tsx:998` then renders an audio icon and Scene label, with a source interval as its fallback at line 1027. There is no visible loading, no-audio or unavailable-waveform explanation.

This is observable in `docs/evidence/ui-pass/desktop-edit.png` and `desktop-deliver.png`. The demonstrated source has no audio stream, yet it presents three populated amber Audio scenes. I independently checked the committed `demo.mp4` with ffprobe: it contains one video stream and no audio stream. The author also documents the source/output as silent. Removing the invented event-derived waveform was the right fix, but the remaining presentation still makes a silent project look as though it contains audio material.

UI-009 explicitly requires silent, audio-free, undecodable and audible fixtures to be visually distinguishable. That acceptance is not met. Preserve the distinction in a typed presentation state and render a localized explanation. If the engine cannot establish absence, say that audio availability or the waveform is unknown rather than guessing. Do not hide an external microphone sidecar merely because the recording video has no embedded audio.

### P2: Fixing camera clipping removed preview volume and fullscreen

`routes/ProgramPreview.tsx:132` renders the Edit/Deliver video without `controls`. The prior EditRoute video had native controls. The replacement header at `layout/StudioShellHeader.tsx:384` provides Play/Pause, and the timeline supplies seek/speed, but no active studio UI implements preview mute/volume or fullscreen. A source search found no fullscreen implementation and no rendered volume control for this player. The remaining AudioMixerChannel definition has no product call site.

The transformed native-control bug is fixed, but UI-011's explicit acceptance says play, pause, seek, volume and fullscreen remain usable at all cameras/aspect ratios. The current implementation drops the last two. This matters for reviewing audible footage and inspecting a small preview. Add stable external program transport controls, including preview-only audio controls and fullscreen. Keep them outside the camera transform, and test that changing preview volume does not imply a saved/exported audio edit.

### P2: Edit and Deliver still lack a clear action hierarchy

`layout/StudioShellHeader.tsx:383` renders the same capture group on every route. The Edit and Deliver screenshots retain Start Recording and a permission badge beside program playback. At 1100x760, `desktop-small.png` shows these controls on the first row while project and utility actions wrap below. A user editing an existing video should encounter the program transport as an editing control, without first interpreting its relationship to the recording button.

Open/Save also repeat. They appear in the header, in `panels/ProjectUtilityPanel.tsx:109`, and as timeline file actions at `panels/TimelineDock.tsx:216`. The timeline's unlabeled Save icon invokes Save As, while the visually similar header Save invokes ordinary Save. Tooltips explain the distinction, but the icons themselves do not. The screenshots make this duplication and the resulting horizontal density clear. Deliver retains the entire editing toolbar as well as an Export action in the header and another below the output form.

This is a product clarity finding, not a broken-handler finding. It directly affects the original complaint about an unintuitive UI. Make the shell task-aware: recording/source/permission actions in Capture, an obvious program transport in Edit/Deliver, one primary export action in Deliver, and one consistent home for project file commands. Keep necessary global access in a compact menu or the native menu. A full-width Agent proposal button above the preview also receives more space than its occasional task warrants.

## Further improvements and limits

These are lower-priority product recommendations, not independent release blockers.

- Proposal review is much better, but the active preview has no visible scene title or selected-row state. `panels/AgentProposalPanel.tsx:289` labels the section only Preview scene; row clicks at line 349 change the item but neither label the preview with its scene nor move focus/scroll to it. In `proposal-preview.png`, the visible player offers a position and Play scene, while the before/proposed controls and identifying context are above the visible region. Add a heading such as Scene 2, Proposed, a selected row treatment, and predictable keyboard navigation to the preview. I did not reproduce browser scroll anchoring, so I do not claim that every click hides the player.
- Visual-setting history records every form-store change at `hooks/timeline/useEditorDocumentHistory.ts:99`. Slider callbacks send each intermediate value. This suggests a drag can create many history entries rather than one understandable edit. Consider grouping a gesture and prove the intended behavior with a browser drag test. I did not perform a live drag, so this remains a source-based concern.
- Empty Edit/Deliver uses the shared recording-oriented text at `routes/ProgramPreview.tsx:166`, with no action in the empty component itself. Global Open Project is available, so the task is reachable, but the in-context guidance could offer Open Project and Go to Capture explicitly. UI-005's original every-empty-state-has-a-working-action clause is only partially satisfied.
- The new website is far better than the baseline stock imagery, delayed copy and inactive pricing. A future short demonstration of an actual edit, followed by its output, would explain the editor more clearly than an editor screenshot plus an exported FAQ interaction alone. The current provenance is honest; this is an editorial preference, not a false-capture finding.

## Coverage and evidence

I read root/subsystem AGENTS and REVIEW, the complete ledger, coverage inventory, improvement research, Emil note and implementation evidence. I inspected the changed authored UI modules and shared controls/styles in the pinned diff: desktop shell, Capture/Edit/Deliver and ProgramPreview, inspector/default/selection/preferences controls, project utilities, timeline surface/dock, proposal review/scene preview, web hero/workflow/build information/FAQ/footer/mobile dialog/About/404/error shell, and shared command/dialog/spinner/property/theme components. Supporting inspection covered layout defaults, document history/signatures, source/query precedence, playback/media lease recovery, thumbnail/waveform hooks, hotkeys, localization, native picker flows, export-result actions and quit protection. This was not a full native-engine security audit.

I opened all 14 committed `docs/evidence/ui-pass` PNGs with view_image. These include loaded/small edit, denied Capture, horizontal/vertical Deliver, proposal review/playback, German Preferences, native Save As/quit guard, German mobile website/FAQ/About/404. I compared the actual baseline `edit-loaded.png` and `web-mobile-hero.png`. The baseline native controls are visibly broken at camera zoom; the current output is calmer and more useful. No current PNG proves the empty editor, active native capture, audible preview or an entire export completion panel. Those states received source/evidence review rather than new live interaction.

The research uses the right comparisons: Screen Studio for camera/output structure, CleanShot for recording/transport, Cap for local projects/history, Tella for readable agent editing. Emil's advice becomes immediate editing, honest state and reduced visual distraction, with numeric suggestions correctly identified as the author's proposals. I evaluated the checked-in research and its attribution; I did not reopen every external source or install competitor products.

I inspected existing log excerpts for packaged acceptance, focused units, native Save As tests, web build and repository/docs/format/lint. The native log includes actual passing ProjectStore and EngineProjectSave cases; zero-test lines for other filtered bundles are not the full result. I did not rerun suites, builds, apps or browsers. No source, commit, PR or push was made. The only added artifact is this report.

The evidence supports a real native 12-second 1920x1080/30fps export from browser-recorded source. It does not establish granted native recording/audio, VoiceOver listening, physical mobile behavior, Windows/Linux production parity or CI completion. Those limits are stated honestly and are not counted as fabricated successes. The gate fails because the inspected product still has the concrete unfinished requirements and clarity problems above, not merely because those broader release checks are unavailable.
