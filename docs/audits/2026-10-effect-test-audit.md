# Effect and test audit

Baseline: `dab1d65a73a5a665f75478d9c3d83f10827ab050` (92 test source files, 488 discovered declarations).

Current inventory: 91 files, 496 declarations (net +8). The full ledger has a single owner, R/F mark, claim, credible regression, and source location for every current declaration; retired declarations name their keeper or removal rationale. See [machine-readable ledger](./2026-10-effect-test-audit.json).

## Owner lanes

- **repository tooling:** 5 files, 36 declarations (30 retained, 6 repaired/new).
- **macOS Swift product:** 20 files, 111 declarations (101 retained, 10 repaired/new).
- **desktop host and domain:** 42 files, 205 declarations (136 retained, 69 repaired/new).
- **desktop renderer integration:** 5 files, 37 declarations (28 retained, 9 repaired/new).
- **Rust native foundation:** 3 files, 28 declarations (26 retained, 2 repaired/new).
- **Rust protocol:** 1 files, 9 declarations (9 retained, 0 repaired/new).
- **Swift protocol:** 1 files, 10 declarations (8 retained, 2 repaired/new).
- **engine client:** 5 files, 27 declarations (8 retained, 19 repaired/new).
- **engine contract:** 8 files, 31 declarations (11 retained, 20 repaired/new).
- **review protocol:** 1 files, 2 declarations (2 retained, 0 repaired/new).

## Retired and consolidated claims

- Replaced static Inspector markup checks with browser workflows for the default mode, selected clip, selected export preset, selected capture window controls, and shortcut recording/reset. The FPS test exposed a missing accessible label; `InspectorSelectField` now connects the label to its combobox.
- Replaced playback source-text inspections with behavior tests that advance playback through leading, interstitial, trailing, and reordered timeline gaps.
- Removed static project utility snapshots that rendered collapsed/default content without exercising recent-project query transitions.
- Removed semantic tone tests that only pinned CSS class strings.
- Kept technical feedback claims in presentation model tests, which verify telemetry source selection and formatting.
- Removed duplicated desktop-owned engine client/transport/contract tests; package owners retain behavioral and generated-contract checks.
- Moved review DTO cases into `packages/review-protocol`, their schema owner.
- Removed the trivial Swift planner initialization assertion; behavioral planner scenarios remain.

## Evidence and limits

- Baseline desktop unit/browser, client, contract, Rust, and Swift results are recorded in the JSON. Baseline Swift protocol tests failed to compile because fixtures referenced removed generated `.value1` wrappers; that fixture was repaired and its current 10-test suite passes.
- Broad evidence recorded before the capture repair: repository invariants 36/36 (104 assertions); TypeScript gate passed (including 197 desktop unit tests, 37 browser tests, 36 engine-contract tests, 26 engine-client tests, and 2 review-protocol tests); desktop acceptance passed (37 browser tests and packaged runtime smoke); Rust workspace and serial Swift test suites passed after native edits; protocol generation determinism passed.
- The full gate was intentionally not run per the user instruction.
- The capture permission blocker is repaired. LaunchServices gives the packaged app its own macOS privacy attribution, and the Swift source handler now enumerates real windows/displays. Peekaboo recorded Finder, stopped, and activated playback; AVFoundation decoded 1,063 frames over 36.303 seconds. Five new Effect lifecycle tests and the denied-permission Swift regression have separate claim owners in the ledger. See [capture repair evidence and limits](./2026-10-desktop-capture-permissions.md).

- Picker follow-up: the host separates interactive selection from direct-start deadlines, the native picker closes on stop/cancellation, and the engine-client dismisses interrupted selection. Peekaboo cancelled after more than 20 seconds, reopened, selected after 32 seconds, recorded and stopped. AVFoundation decoded 555 frames. Four behavioral claims were added without source-text assertions or test-only production seams; details are in the capture repair evidence.

- Review follow-up: three native session claims cover retired callbacks, stop between selection and startup, and interruption/retry. A renderer boundary claim separates localized selection/permission notices from direct-window/runtime errors. Removing identity and stop guards made two native claims fail; the restored implementation passed all 19 selected native tests.

## Review since the user-selected baseline

The review from `b0a7e056abf64a5b67468e8300d5bb4b7491d413` includes the integrated
Agent Mode groundwork. Its five Swift planner/store tests, six contract tests,
one renderer authority test, and one Rust unsupported-HTTP test were missing
from the earlier ledger and are now owned explicitly. A new native context claim
checks same-project reopen authority. The manifest persistence claim now includes
invalid runtime budgets, lifecycle states, recording revisions and timestamps.
The original validator failed six corruption assertions.

Three Rust simulation tests and their dormant Agent/cut-plan implementations,
force-environment fixtures and preflight helpers were removed. No production
HTTP route used them. The authenticated unsupported-operation test remains the
foundation owner. macOS planner, storage and live HTTP/media evidence protect the
implemented Agent workflow. No test-only production seam was added.

## PR validation follow-up

The retained Rust export request owner now rejects missing/numeric output paths,
relative paths, unsupported extensions, invalid framing and directory targets.
Each case requires a typed error and preserves existing output bytes and prior
export settings. Existing successful export and symlink rejection claims remain
separate. Bypassing framing validation makes this owner fail. No new declaration,
production seam or coverage-threshold exception was added.
