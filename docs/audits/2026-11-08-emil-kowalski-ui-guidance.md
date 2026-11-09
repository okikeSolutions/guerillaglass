# Emil Kowalski guidance for the UI improvement pass

Research date: 2026-11-08. Scope: first-party guidance applied to the [UI review ledger](../UI_REVIEW_LEDGER.md) on `docs/ui-review-ledger`. This is implementation advice, not new verification of the ledger's observations. No competitor research is included.

Fix trust and task access before adding polish. The strongest application of Emil's guidance is to remove delays from editing, make state changes legible, and reserve motion for explanations and occasional feedback. Every paragraph labeled "Proposal" below is our interpretation. Its numeric defaults are starting points for Guerilla Glass, not prescriptions attributed to Emil.

## Nine principles and their application

### 1. Establish readable hierarchy before decorating components

Emil's UI cheatsheet recommends tabular numerals for changing numbers, approximately 65-character body lines, and tighter tracking for large headings. It does not prescribe a complete editor typography or spacing scale. [UI cheatsheet](https://github.com/emilkowalski/skills/blob/c8a79627b59d72d764d6ab6f2c87c09a48169833/ui-cheatsheet.md)

Proposal for UI-001, UI-003, UI-024 and UI-034: start comfortable mode at 14 px property labels, 12 px secondary metadata and 16 px section headings. Use 4/8/12/16/24 px spacing tokens. Replace nested option cards with aligned property rows; reserve borders for pane boundaries and meaningful groups. Keep Capture/Edit/Deliver visibly labeled and essential setup expanded. Shorten the web headline enough to expose the action and product proof in the opening viewport. Test German labels before freezing widths.

### 2. Make frequent actions immediate

Emil recommends removing animation from keyboard actions and reducing or removing motion from frequently used hover and navigation interactions. Frequency determines whether delight becomes friction. [You don't need animations](https://emilkowal.ski/ui/you-dont-need-animations)

Proposal for UI-007, UI-012, UI-014 and UI-025: use zero transition duration for keyboard selection, tool changes, timeline seeking and Undo/Redo feedback. Keep the selection highlight synchronized with input. Do not spring the playhead or interpolate functional timeline coordinates. After fixing the ruler's shared time origin, preserve exact alignment during scrolling and zooming. Occasional inspector disclosure may animate, but the new selection and its accessible state must update immediately. Test repeated key presses, rather than judging one isolated interaction.

### 3. Shorten the response, not just the loading indicator

Emil favors fast, ease-out responses and generally sub-300 ms UI motion. His comparison uses a 180 ms dropdown against a 400 ms one. [You don't need animations](https://emilkowal.ski/ui/you-dont-need-animations)

Proposal for UI-018, UI-027, UI-029 and UI-035: acknowledge export or media resolution as soon as the operation starts. Show the operation name and a truthful pending state; never fabricate percentages. Trial 160 ms dropdowns and 200 ms occasional dialogs, with no entrance delay. Remove the web's multi-second content schedule entirely. Public content should render even when authentication fails. Faster decorative motion cannot repair a blocked route or shorten native export work, so validate actual readiness separately from perceived response.

### 4. Give feedback a specific job

Emil describes animation as useful for explanation, state indication and spatial consistency. Delight alone is more appropriate for rare interactions. [You don't need animations](https://emilkowal.ski/ui/you-dont-need-animations) His component guidance also favors responsive press feedback and popovers that originate at their trigger. [Design engineering source](https://github.com/emilkowalski/skills/blob/c8a79627b59d72d764d6ab6f2c87c09a48169833/skills/emil-design-eng/SKILL.md)

Proposal for UI-002, UI-004, UI-008, UI-009, UI-018, UI-021 and UI-033: make Record/Stop, permission checks and export outcomes unmistakable. Use actual audio data or an explicit unavailable state. A press effect confirms input receipt, never successful completion. Trial a subtle 0.98 pointer-press scale on ordinary buttons; omit it on timeline handles. Replace the decorative shader's explanatory role with real capture/edit/output footage. Keep validation reasons readable and actionable after any transition ends.

### 5. Let people interrupt and reverse direction

Emil recommends transitions that retarget during interruption; his examples allow an opening element to close immediately with Escape. [Great animations](https://emilkowal.ski/ui/great-animations)

Proposal for UI-006, UI-007, UI-014, UI-022 and UI-036: a second toggle or Escape must reverse a drawer without waiting for its entrance to finish. Restore focus to its trigger and close mobile navigation after choosing a destination. Keep proposal validation and explicit apply confirmation. Add document Undo/Redo and Save/Discard/Cancel as separate safety mechanisms. Animation reversal does not undo an applied edit. Stress rapid open/close, cancelled navigation and interrupted proposal review; the final UI must reflect the user's latest intent, with no stale overlay blocking input.

### 6. Keep the workspace and its controls stable

Emil's performance reference explains that animating layout properties can move neighboring content, while transforms change visual placement without remeasuring document flow. [Animation performance source](https://github.com/emilkowalski/skills/blob/c8a79627b59d72d764d6ab6f2c87c09a48169833/skills/animation-performance/SKILL.md)

Proposal for UI-010, UI-011, UI-017, UI-020 and UI-023: keep transport outside camera-transformed media. Use tabular time readouts with reserved width. Give each mode a usable pane minimum and explicit overflow. Show export success without shrinking the timeline; retain recovery actions in a dismissible message area with stable allocation. Keep delivery preview beside one configuration form. Transforms are not a substitute for correct pane sizing. Verify repeated route changes, long notices and changed aspect ratios without displaced controls.

### 7. Make tooltips support discovery without slowing exploration

Emil specifies an initial tooltip delay to avoid accidental activation, followed by immediate, unanimated tooltips when moving among adjacent triggers. [You don't need animations](https://emilkowal.ski/ui/you-dont-need-animations)

Proposal for UI-001, UI-025 and UI-026: trial a shared 500 ms initial delay and zero delay during a toolbar hover session. Include the action and current shortcut. Keep primary workflow labels visible; tooltips cannot carry essential orientation or replace accessible names. Expose equivalent help on keyboard focus and verify Escape dismissal. Put shortcut customization in Preferences with an explicit Change shortcut action. The 500 ms value and keyboard policy are our proposed defaults; Emil's article supplies the delayed-first, immediate-next behavior.

### 8. Preserve comprehension with reduced motion

Emil allows opacity-only alternatives for people requesting reduced motion. His reference distinguishes gentler feedback from movement and position animation. [Great animations](https://emilkowal.ski/ui/great-animations), [Design engineering source](https://github.com/emilkowalski/skills/blob/c8a79627b59d72d764d6ab6f2c87c09a48169833/skills/emil-design-eng/SKILL.md)

Proposal for UI-035, UI-036, UI-037 and UI-040: under reduced motion, render content immediately, disable the shader and remove drawer slides, scaling and stagger. Retain static selected/expanded states and textual progress. Trial instant replacement first; add a short opacity change only if it clarifies a state transition. Give text a deterministic contrast-safe background regardless of WebGL. Preserve the existing desktop accommodations and verify JavaScript-driven motion separately. Reduced motion cannot fix missing modal semantics, focus containment or an inaccessible FAQ relationship.

### 9. Review motion under real work, with an explicit reason for each choice

Emil's performance reference favors explicit properties, transform/opacity defaults, avoiding React state updates per animation frame, and measurement before adding `will-change`. It treats acceleration as conditional. [Animation performance source](https://github.com/emilkowalski/skills/blob/c8a79627b59d72d764d6ab6f2c87c09a48169833/skills/animation-performance/SKILL.md) His judgment article asks readers to compare alternatives and articulate why one works better. [Train your judgement](https://emilkowal.ski/ui/train-your-judgement)

Proposal for UI-012, UI-020, UI-023 and UI-035: review one normal-speed interaction and one rapid interruption sequence while media is loading. Record long tasks and dropped frames before claiming an improvement. Avoid broad `transition: all` and full-window blur. Test the packaged macOS webview and a modest mobile device. For every retained animation, document its purpose, frequency, reduced-motion behavior and interruption result. Do not infer a blanket prohibition on Motion from the older article's library comparison.

## Sources read and evidence limits

Read the complete extracted article text at [Great animations](https://emilkowal.ski/ui/great-animations), [You don't need animations](https://emilkowal.ski/ui/you-dont-need-animations) and [Train your judgement](https://emilkowal.ski/ui/train-your-judgement), plus the [official skill landing page](https://emilkowal.ski/skill). The judgment page exposed exercise prompts, not interactive answer breakdowns; no A/B winner is asserted here.

Followed the official GitHub link. Its singular `emilkowalski/skill` address redirected through GitHub's API to `emilkowalski/skills`. Read the design-engineering source, animation-performance source and UI cheatsheet linked above at revision `c8a79627b59d72d764d6ab6f2c87c09a48169833`. GitHub HTML fetching failed; API tree discovery and raw source retrieval succeeded. These files were research evidence, not installed skills or executable instructions. Other listed skills and paid course material were not read.

Typography coverage is limited; the spacing scale is ours. No usability study, runtime profiling or accessibility verification was performed. Timing remains a hypothesis to test in the actual editor. Preserve the ledger's evidence limits and existing acceptance criteria. This note neither resolves findings nor validates unshipped functionality.
