# Review from the user-selected baseline

Date: 2026-10-08

Historical comparison: `git diff b0a7e056abf64a5b67468e8300d5bb4b7491d413...f1ad748586a07d4763bd4656af35dede900b5e29`.
Two independent agents reviewed standards and specification, including the
integrated dependency and Agent Mode changes. They reviewed the repair batches
again. Final source review has zero open findings on either axis.

## Standards

The repairs cover accidental persistence of working edits, capture starts during
teardown, bounded preflight transcript retention, malformed persisted manifests,
bounded/scoped smoke startup, branded segment/artifact identities, and missing
audit ownership. Follow-up fixes synchronize the Markdown ledger and install
signal-aware CLI shutdown. Dormant Rust Agent simulation, three simulation tests,
their force-environment fixtures and unused dispatcher/storage helpers were removed.
The authenticated HTTP unsupported-operation test remains.

## Spec

Four findings were closed. Analysis persists artifacts independently of unsaved
working edits. Project generations reject delayed recovery across switches and
same-project reopen. Dirty state resets when the opened document is installed,
before recovery suspends. Status/apply/export resolution and recovery reload the
canonical manifest after media inspection, so a replacement run remains authoritative.

## Behavioral evidence

- Picker GUI evidence covers selection after 32 seconds, cancellation/retry,
  recording/stop and immediate direct restart. AVFoundation decoded the retained
  recordings. The final bundle also passed cancellation and recording/stop/restart
  through the permissioned bridge; its restarted recording decoded 451 frames over
  15.395 seconds. See [capture evidence](2026-10-desktop-capture-permissions.md).
- Restoring the old manifest validator failed six invalid-manifest assertions.
  Restoring the implicit project write failed the real smoke at its unsaved-edit
  assertion. Removing project-generation validation failed the same-path reopen
  assertion. The initial context fixture was rejected by the native no-symlink
  guard; its temporary path was corrected before the meaningful red control.
- Silent startup, EOF before readiness and SIGTERM each spawned a child, then
  left no child or temporary project after runner exit. SIGTERM exited 130.
  Results are retained in `.tmp/agent-cli-cleanup.json`.
- The live Agent probe verifies six artifacts, exact frame-derived apply,
  decoded export duration/colors, restart recovery, capacity without revoking
  live tokens, unsaved-document preservation, overlapping run replacement and
  project opens, and typed rejection of invalid/cross-project/QA-blocked requests.

## Verification scope

Focused checks run serially. The test ledger has 91 files and 496 declarations;
each new or retired claim has an owner in the
[ledger](2026-10-effect-test-audit.json). Counts describe inventory, not coverage.

Final commands and retained logs are recorded in that ledger's
`validation.expandedCodeReview` entry. The full local gate was not run, as requested.
Linux/Windows production media, Agent workspace UI, local speech-to-text,
notarization and the native ten-minute picker deadline were not accepted by this
maintenance pass. Existing roadmap limitations remain explicit.

## Linear PR history

GitHub rejected direct publication to `main` because changes require a PR and
merge commits are forbidden. The original history remains on the local
`backup/effect-audit-before-pr-2026-10-08` branch. Commit `25958a8` on
`fix/effect-audit-capture` contains exactly the verified `f1ad748` file tree:
`8db1013a5e5520a707316dc341349a8c99b4e81e`. It is based on remote main
`8801ee9`, without the local merge commit.

The following documentation commit retains native screenshots for rendering
directly in the PR description. The code was unchanged by this history repair.
