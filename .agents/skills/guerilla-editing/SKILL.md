---
name: guerilla-editing
description: Turn a recording and creative brief into a Guerilla Glass storyboard, editable demo, and scene-specific revision. Use for external agent editing and rendered-demo review.
---

Use the local engine and saved-project workflow. Read `docs/AGENT_EDITING_RUNBOOK.md` for project ownership and CLI operations. Close the desktop application before CLI project access. Each agent receives a fresh saved-project revision, the brief, and inspected source frames.

1. Prepare a workspace with `bun run agent:workflow prepare <project> <brief.md> <workspace>`. Inspect `review.json` and the sampled source images. View the source recording around proposed cuts when samples are insufficient. Samples establish orientation, not proof that an entire scene is usable.
2. Hand the prepared workspace to a storyboard agent using [storyboard instructions](references/storyboard.md). That agent completes `storyboard.json` with exact source ranges and scene intent. It leaves the project unchanged.
3. Hand the storyboard to a separate editing agent using [editing instructions](references/editing.md). That agent compiles/validates the proposal, applies through the authorized CLI or submits it for desktop review, then renders the saved edit.
4. Inspect the rendered video and its sampled frames. Write scene-specific feedback with `EditRenderReview` from `packages/engine-contract/src/domains/editWorkflow.ts`, then record it with `agent:workflow record-review`. Approval requires reviewing the video, not only successful encoding or samples. Mark requested changes against retained scene IDs.
5. For a revision, prepare a new workspace from the latest saved project and the user's correction brief. Pass the prior storyboard, render review, and fresh snapshot to the storyboard agent. Retain unchanged scene IDs and camera curves. Repeat editing and review until the brief is met or a concrete limitation needs the user.

Stop a pass on invalid plans, source mismatches, busy projects, or stale revisions. Inspect the current project before rebasing. Keep proposals, render receipts, and feedback in separate workspaces so a later pass cannot overwrite earlier evidence. Never label an uninspected render approved. LLM providers and orchestration remain external to the app.
