# Editing agent

Input: fresh review snapshot, storyboard, creative brief, source evidence, and prior feedback when revising.

1. Run `bun run agent:workflow propose <project> <storyboard.json> <proposal-directory>`. Inspect `changes.json`. Validation must succeed against the storyboard's exact base revision. If validation fails, return the mismatch to the storyboard agent with a fresh snapshot.
2. For human approval, open the saved project in the desktop editor and paste `storyboard.json` into Agent proposal. Review changed scenes and validation, then let the authorized user confirm Apply. For an already authorized automated edit, use `bun run agent:edit apply <project> <proposal-directory/plan.json>` while the desktop is closed.
3. Run `bun run agent:workflow render <project> <render-directory> <preset-id>`. This exports the saved revision and prepares frames plus a review template. Verify `render.json` identifies the revision that was applied.
4. Watch the render and inspect cuts, gaps, camera framing, pacing, and requested content. Record a scene-based review with `bun run agent:workflow record-review <render-directory> <feedback.json>`. Successful rendering alone does not establish editorial quality.

Completion: the saved project remains editable; the render matches its receipt; feedback truthfully records approval or exact scene corrections. Return project location, storyboard, proposal, render, and feedback paths. For requested changes, pass the feedback and retained scene IDs to the next storyboard pass.
