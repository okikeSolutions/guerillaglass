# External agent editing

Use this workflow when a storyboard agent or editing agent needs to revise a saved Guerilla Glass project. The first version supports one recording on macOS. The agent chooses the edits; Guerilla Glass validates, persists, previews, and renders them.

## Prepare

1. Save the desktop project, then close the desktop application. Work on a copy when experimenting.
2. Build the production engine with `swift build -j 2 --disable-automatic-resolution`.
3. Run commands from the repository root. Set `GG_ENGINE_PATH` through your execution environment when using a different engine build.

The adapter launches a private authenticated engine for each command and disposes it afterwards. It never terminates a competing desktop engine. Standard output contains one JSON result or error; diagnostic logs go to standard error. A failure exits nonzero. Do not scrape logs for bearer tokens.

## Review before planning

```bash
bun run agent:edit review /absolute/Demo.gglassproj > review.json
```

The result contains `revision`, `sourceRevision`, `sourceDurationSeconds`, rational `sourceFps`, and `project`. Preserve these opaque revisions. `project.timeline` is the current saved edit; clip IDs identify scenes across revisions. An empty legacy timeline means the full source.

Hand this snapshot and the creative brief to the storyboard agent. Hand its storyboard and the same snapshot to the editing agent. The editor emits a JSON plan, for example:

```json
{
  "version": 1,
  "id": "demo-revision-1",
  "baseRevision": "COPY revision FROM review.json",
  "sourceRevision": "COPY sourceRevision FROM review.json",
  "timeline": {
    "version": 2,
    "items": [
      { "kind": "clip", "id": "show-result", "sourceAssetId": "recording", "sourceStartSeconds": 6, "sourceEndSeconds": 7 },
      { "kind": "gap", "id": "pause", "durationSeconds": 0.5 },
      { "kind": "clip", "id": "explain-setup", "sourceAssetId": "recording", "sourceStartSeconds": 0, "sourceEndSeconds": 1 }
    ]
  }
}
```

Replace revision placeholders with the actual 64-character values. End times are exclusive. Clip ranges must be positive and inside the source. Gap durations are positive. IDs are unique. Reordering and repeating source ranges are valid. The plan is the complete proposed timeline, so retain every scene that should survive a revision.

## Validate and apply

```bash
bun run agent:edit validate /absolute/Demo.gglassproj plan.json
bun run agent:edit apply /absolute/Demo.gglassproj plan.json > applied.json
```

Validation leaves the project unchanged. Apply checks the revision again and saves an editable project. A `project_mismatch` response means the baseline changed or the project has unsaved native state. Review again and deliberately rebase your proposal. Never retry a stale edit by substituting a revision without inspecting the newer timeline.

## Export the saved edit

Create `export.json` with `expectedRevision` from the apply/review result, a preset ID from `GET /v1/export/info`, and an absolute output path outside the project package:

```json
{
  "expectedRevision": "COPY revision FROM applied.json",
  "presetId": "h264-1080p-30",
  "outputURL": "/absolute/demo.mp4"
}
```

```bash
bun run agent:edit export /absolute/Demo.gglassproj export.json
```

This exports the saved project timeline and settings. It does not use the old four-beat Agent run, and it does not require resending a timeline. Legacy `POST /v1/exports` retains its source-export semantics when a timeline is omitted; `POST /v1/exports/from-cut-plan` renders that older run's plan rather than later human edits.

## Review and revise

After the command exits, reopen the project in the desktop editor. Make corrections, save, and close the application before handing it back. Take a fresh review snapshot for the next editing agent. Keep existing scene IDs for retained scenes. Project ownership is sequential; simultaneous app/adapter editing is outside this workflow.

The adapter returns the latest saved edit, not a history of previous proposals. Keep storyboard and plan files externally when you need an editorial audit trail. Save As creates a new editing baseline; obtain a fresh review for the new package.

## Verify

```bash
bun run agent:edit:smoke
```

The probe creates synthetic media and checks arbitrary scene order, plan validation, stale revision rejection, saved-project reopen, a second edit preserving scene IDs, and export duration.

## Scene camera overrides

A clip may include a `camera` array of 1–256 keyframes. Each keyframe has `timeSeconds` in source time, normalized oriented-source `centerX` and `centerY` in 0–1, and `zoom` in 1–8. Times must strictly increase and stay inside the source recording. The camera holds its first and last keyframes outside their interval. Between keys, the affine transform interpolates linearly, matching native export. Zoom changes therefore interpolate the zoom-weighted focus position, not the focus independently.

For example, add this field to a clip to hold a 2× zoom centered on the source's right half:

```json
"camera": [{ "timeSeconds": 0, "centerX": 0.75, "centerY": 0.5, "zoom": 2 }]
```

Camera overrides belong to the scene ID, so repeated footage can have different camera directions. Omit `camera` to retain the automatic camera settings. Splitting a scene preserves its source-time camera curve in both resulting clips. Manual transforms use aspect-fit source geometry within the framing card. Normalized coordinates use the oriented image's top-left origin. Keyframes can extend beyond the clip's selected range so trims and splits preserve interpolation.
