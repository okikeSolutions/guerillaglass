# Agent discoverability audit

Date: 2026-07-25

This audit examined two separate experiences:

1. whether a fresh coding agent can find repository ownership, constraints, and validation commands; and
2. whether an automation agent can discover and safely drive local Agent Mode against Creator Studio projects.

Evidence included source/document tracing, generated OpenAPI inspection, authenticated live-engine probes, packaged Electrobun accessibility inspection with Peekaboo, and two independent Herdr agent reviews.

## Findings and disposition

| Severity | Finding | Disposition |
| --- | --- | --- |
| Blocker | macOS cut-plan export accepted any job ID and exported the current recording without resolving QA or a cut plan. | Addressed by resolving the project-bound persisted run and exporting its exact frame-derived timeline. |
| Blocker | `agent.apply` could report success without applying a generated cut plan. | Addressed by applying the exact persisted cut-plan timeline and returning a typed, verifiable result. |
| Blocker | In-memory jobs were not project-bound and survived project switches. | Addressed by binding run summaries to the project UUID and a sampled recording fingerprint, clearing state on project switch, and restoring only a validated current-project manifest. |
| High | Required Agent artifacts were modeled but never persisted. | Addressed for the macOS imported-transcript path with six atomic project-relative v1 artifacts and summary-last commit semantics. |
| High | macOS returned generic HTTP 400 responses where OpenAPI promised typed 404/409/422 outcomes. | Addressed for status, apply, and cut-plan export, including typed preflight-expiry/mismatch and project-mismatch outcomes. |
| High | Capabilities overstated Agent and cut-plan support on Rust foundation shells. | Addressed by advertising those capabilities as unavailable and returning typed `unsupported_method` failures from every Agent and cut-plan HTTP endpoint. Generated bindings still enforce wire-shape conformance without implying runtime support. |
| High | No focused, executable Agent Mode documentation existed. | Addressed by `docs/AGENT_MODE_RUNBOOK.md` and root source-of-truth links. |
| High | Agent Mode had no visible packaged-workspace entry point. | Open. This remains on the Agent Mode productization track; direct local HTTP/engine-client automation is the supported agent-driving surface until that UI lands. |
| High | Run state disappeared after engine restart. | Addressed for the latest macOS run by recovering `analysis/run-summary.v1.json` on project open. |
| High | Analysis itself marked the project dirty and manufactured destructive confirmation. | Addressed: analysis artifacts persist independently; confirmation is based on pre-run unsaved state or subsequent timeline drift. |
| Medium | Swift preflight token TTL differed from the normative 60 seconds. | Addressed and exposed in capabilities. |
| Medium | OpenAPI accepted a 60-minute runtime budget while engines allowed only 10. | Addressed by narrowing the contract to 1–10. |
| Medium | Preflight did not inspect source duration. | Addressed for positive duration, video-track presence, frame rate, and the 10-minute source limit. |
| Medium | Spec required a nullable blocked token while the wire contract omitted it. | Resolved in favor of existing omission semantics and documented in the runbook/spec. |
| Medium | Imported-transcript paths can reach the native engine without a dedicated desktop file-grant flow. | Open. Direct authenticated engine clients may use trusted local paths. A future workspace import flow must use a host picker/capability and copy the validated transcript into the project package before exposing Agent Mode in UI. |
| Medium | Save As does not yet copy and revalidate the analysis artifact set. | Open. Treat Save As as creating a project without a recovered Agent run until artifact-copy semantics are implemented. |
| Low | Generated OpenAPI operations lacked workflow descriptions. | Addressed with summaries and prerequisite/behavior descriptions at the Effect `HttpApi` source. |

## Verification boundary

The implemented path is deliberately narrow:

- macOS production engine;
- existing saved project and recording;
- `imported_transcript` provider;
- synchronous deterministic four-beat planning;
- latest run only;
- frame-based cut plan retaining the source track's rational minimum-frame duration, with nominal integer FPS only as a fallback.

The audit does not claim a local speech-to-text model, multiple run history, background cancellation, Agent workspace UI, or production media parity on Windows/Linux.

## October 2026 review follow-up

The review from `b0a7e056abf64a5b67468e8300d5bb4b7491d413` repaired implicit
saves during analysis and stale Agent state across overlapping opens and run
replacement. Project generations retire pending work on reopen and Save As.
Status/apply/export resolution revalidates the canonical manifest after media
inspection. Recovery preserves newer working edits and newer runs.

Ready preflights retain at most four transcript snapshots, prune expired sessions
before retaining new authority, and report the documented capacity blocker.
Manifest recovery validates terminal lifecycle state, budget, artifact versions,
frame-rate fields and QA consistency. Dormant Rust Agent simulation and its tests
were removed; authenticated HTTP unsupported-operation coverage remains.

The smoke command now uses the scoped Effect engine launcher, schema decoding and
Effect HTTP/filesystem/path services. OS shutdown interrupts the owning runtime.
See [review evidence](audits/2026-10-code-review.md) for checks and limits.
