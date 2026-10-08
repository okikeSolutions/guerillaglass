# Local Agent Mode runbook

Agent Mode is a local, project-scoped rough-cut workflow. The supported production path is currently the macOS native engine with an existing saved project/recording and an imported timed transcript.

## Discover support first

Call `GET /v1/engine/capabilities` before using Agent Mode. A client must require all relevant Agent flags and `export.cutPlan=true`; endpoint presence alone does not imply production support.

The macOS capability response also advertises:

- `supportedTranscriptionProviders`
- `maxSourceDurationSeconds`
- `preflightTokenTtlSeconds`
- `artifactVersion`
- `cutPlanVersion`

Windows/Linux foundation shells intentionally advertise Agent and cut-plan export as unavailable. If a client calls those generated routes anyway, every Agent operation and cut-plan export returns HTTP 400 with `code: "unsupported_method"`; they do not simulate jobs or artifacts.

## Engine transport

The desktop host normally launches and authenticates the engine through `packages/engine-client`. For a focused direct-HTTP session:

```bash
export GG_ENGINE_TRANSPORT=http
export GG_ENGINE_HTTP_AUTH_TOKEN="$(openssl rand -hex 32)"
.build/debug/guerillaglass-engine > /tmp/gg-engine-ready.jsonl 2>/tmp/gg-engine.log &
export GG_ENGINE_PID=$!

# Read host/port from the one-line guerillaglass.engine.http.ready JSON envelope.
export GG_ENGINE_BASE_URL="$(
  jq -r 'select(.type == "guerillaglass.engine.http.ready") | "http://\(.host):\(.port)"' \
    /tmp/gg-engine-ready.jsonl
)"
```

Every request requires:

```text
Authorization: Bearer $GG_ENGINE_HTTP_AUTH_TOKEN
Content-Type: application/json
```

Do not log or persist the bearer token. Stop the manually launched process when finished:

```bash
kill "$GG_ENGINE_PID"
```

## Prerequisites

1. Open an existing `.gglassproj` package using `POST /v1/project/open`.
2. Confirm `GET /v1/project/current` returns its recording.
3. Prepare an imported transcript JSON with timed `segments`, `words`, or both.
4. Keep the recording at or below the advertised source-duration limit.

Example transcript:

```json
{
  "segments": [
    { "text": "Opening hook", "startSeconds": 0.25, "endSeconds": 1.0 },
    { "text": "Action steps", "startSeconds": 2.0, "endSeconds": 3.0 },
    { "text": "Result payoff", "startSeconds": 4.0, "endSeconds": 5.0 },
    { "text": "Conclusion takeaway", "startSeconds": 6.0, "endSeconds": 7.25 }
  ]
}
```

The four narrative anchors must occur in canonical order: `hook -> action -> payoff -> takeaway`.

Direct authenticated engine clients may pass a trusted local transcript path. The desktop workspace must not expose this field until a host file-picker/capability flow exists.

## Required call order

### 1. Preflight

```bash
curl --fail-with-body \
  -H "Authorization: Bearer $GG_ENGINE_HTTP_AUTH_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"runtimeBudgetMinutes\":10,\"transcriptionProvider\":\"imported_transcript\",\"importedTranscriptPath\":\"/absolute/path/transcript.json\"}" \
  "$GG_ENGINE_BASE_URL/v1/agent/preflight"
```

Proceed only when `ready=true`. A ready response includes `preflightToken` and `preflightTokenExpiresAt`. The token:

- expires after the advertised TTL (currently 60 seconds);
- is single-use;
- is bound to the current project, recording, timeline baseline, provider, transcript path, and runtime budget.

Blocked responses omit both token fields.

### 2. Run

Call `POST /v1/agent/runs` with the token and the exact same run parameters. The current imported-transcript pipeline is synchronous, so the initial response is normally already `completed` or `blocked`.

### 3. Inspect status and plan

Call `GET /v1/agent/runs/{jobId}`. Do not apply or export unless:

- `status == "completed"`;
- `qaReport.passed == true`;
- `cutPlan.segments` is non-empty;
- all artifact paths are project-relative.

The cut plan uses end-exclusive frame ranges and rational source FPS metadata. Clients should render this response for review rather than reverse-engineering artifact files.

Terminal statuses are `completed`, `blocked`, `failed`, and `cancelled`. If a future engine returns `queued` or `running`, poll with bounded backoff and an overall deadline no greater than the advertised runtime budget.

### 4. Apply, when desired

Call `POST /v1/agent/runs/{jobId}/apply` with `{}`. If HTTP 409 returns `needs_confirmation`, review the changed timeline and retry with:

```json
{ "destructiveIntent": true }
```

A successful response includes the Agent job ID and applied segment count. The working timeline must match the status response's cut-plan frame ranges converted through its rational FPS.

### 5. Export the cut plan

Call `POST /v1/exports/from-cut-plan` with:

```json
{
  "jobId": "the-agent-job-id",
  "presetId": "an-id-from-v1-export-info",
  "outputURL": "/absolute/output/path.mp4"
}
```

Export resolves and validates the persisted run independently; `agent.apply` is not a prerequisite. Apply and export consume the same canonical cut plan.

## Persisted artifacts

The latest macOS run writes these files atomically under the project package:

```text
analysis/transcript.full.v1.json
analysis/transcript.words.v1.json
analysis/beat-map.v1.json
analysis/qa-report.v1.json
analysis/cut-plan.v1.json
analysis/run-summary.v1.json
```

`run-summary.v1.json` is committed last. Project reopen restores a run only when the manifest is valid and bound to the same project UUID. Artifact paths returned over the API remain project-relative.

## Failure remediation

| HTTP/code or blocker | Action |
| --- | --- |
| `missing_project` | Open a saved project package. |
| `missing_recording` | Record/save media into the active project. |
| `missing_local_model` | Select `imported_transcript`; no local model ships yet. |
| `missing_imported_transcript` | Supply the trusted transcript path to preflight and run. |
| `invalid_imported_transcript` | Validate JSON, non-empty text, and finite increasing timestamps. |
| `source_too_long` | Use a source within the capability-advertised limit. |
| `source_duration_invalid` | Verify the recording has a readable video track and duration. |
| HTTP 400 `preflight_expired` | Token expired, was consumed, or is unknown; preflight again. |
| HTTP 400 `preflight_mismatch` | Run parameters or active project/recording differ from preflight; preflight again. |
| HTTP 404 `not_found` | The job is not the current project's recoverable latest run. |
| HTTP 409 `needs_confirmation` | Review timeline drift and retry with explicit destructive intent only when intended. |
| HTTP 409 `project_mismatch` | Reopen the bound project and restore the original recording, or create a fresh run. |
| HTTP 422 `qa_failed` | Fix missing/out-of-order narrative beats and rerun. |
| HTTP 422 `invalid_cut_plan` | Do not apply/export; rerun analysis or repair the project artifact set. |

## Verification checklist

On macOS, the repository's executable golden-path probe builds a synthetic recording, runs the authenticated workflow, validates confirmation and typed errors, checks all six artifacts, decodes exported media duration against the frame plan, restarts the engine, verifies recovery, and rejects the job after switching projects:

```bash
bun run swift:build
bun run agent:smoke:macos
```

A successful integration proves more than HTTP success:

- capabilities truthfully advertise the path;
- all six artifacts exist and decode;
- status exposes QA and the exact frame plan;
- apply returns a positive segment count and the timeline matches the plan;
- cut-plan export returns that same count;
- decoded output duration matches the selected frame ranges;
- restarting the engine and reopening the project restores status;
- a job from another project cannot be applied or exported;
- malformed transcript, failed QA, missing/cross-project jobs, confirmation, and consumed-token reuse use their documented machine-readable outcomes; the ready response's expiry timestamp is also checked against the advertised TTL.
