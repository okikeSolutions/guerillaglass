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

## PR CI corrections

The first CI run found one error-level SwiftLint function-length violation and
insufficient coverage of the remaining Rust export handler. Transcript preflight
input validation now has a private production helper, preserving blocker ordering
and removing the forced path unwrap. SwiftLint passes with existing warning-level
findings. The engine fast build and real Agent smoke pass.

The existing Rust export rejection test now checks malformed payloads, relative
and unsupported paths, invalid framing and directory targets. Failed requests
preserve prior output bytes and export settings. Bypassing framing validation
fails this test. All 28 foundation tests and Clippy pass. The coverage threshold
was retained. Both review agents found zero issues in these follow-up changes.
The machine-readable ledger records the commands in `validation.prHistoryRepair`;
remote CI must pass before merge.

### Swift coverage ownership

All Swift tests and critical per-file coverage checks passed in the first full
coverage run. Its global totals were diluted by generated OpenAPI and linked
dependency sources. The repository metric now sums covered/count values for
owned engine and test files. It retains the historical 65% line and 70% function
thresholds and reports product-only totals separately. Empty owned reports fail.
The aggregation uses the per-file counts from LLVM's
[JSON coverage export](https://www.llvm.org/docs/CommandGuide/llvm-cov.html#export-command).

The canonical Swift-only check passed all 111 tests with two workers and sequential
execution. Repository coverage is 68.99% lines and 75.49% functions; product-only
coverage is 56.83% and 58.71%. Critical production-file thresholds also passed.
Synthetic weighted, generated/foreign-source and missing/zero-report probes
passed. Both reviewers found zero issues in this follow-up. CI archives the
original and owned JSON reports.

The native SwiftPM build system produces a combined test report on local Swift
6.4, whose default backend otherwise overwrote the summary for each test bundle.
Swift 6.4 deprecates the native flag; aggregation must be rechecked before moving
the coverage command to the default backend. This does not change fast local
verification or production build commands.
