#!/usr/bin/env bash
set -euo pipefail

SCOPE="${COVERAGE_SCOPE:-all}"
case "$SCOPE" in
  all|typescript|rust|swift) ;;
  *)
    echo "Invalid COVERAGE_SCOPE '$SCOPE' (expected all, typescript, rust, swift)" >&2
    exit 1
    ;;
esac

needs_scope() {
  [[ "$SCOPE" == "all" || "$SCOPE" == "$1" ]]
}

if needs_scope typescript || needs_scope all; then
  if ! command -v bun >/dev/null 2>&1; then
    echo "bun not found; install Bun first" >&2
    exit 1
  fi
  if ! command -v jq >/dev/null 2>&1; then
    echo "jq not found; install jq first" >&2
    exit 1
  fi
fi

if needs_scope rust || needs_scope all; then
  if ! command -v cargo >/dev/null 2>&1; then
    echo "cargo not found; install Rust toolchain first" >&2
    exit 1
  fi
  if ! command -v jq >/dev/null 2>&1; then
    echo "jq not found; install jq first" >&2
    exit 1
  fi
  if ! cargo llvm-cov --version >/dev/null 2>&1; then
    cat >&2 <<'EOF'
cargo-llvm-cov is required for coverage checks.
Install with:
  rustup component add llvm-tools-preview
  cargo install cargo-llvm-cov
EOF
    exit 1
  fi
fi

if needs_scope swift || needs_scope all; then
  if ! command -v swift >/dev/null 2>&1; then
    echo "swift not found; install Swift toolchain first" >&2
    exit 1
  fi
  if ! command -v jq >/dev/null 2>&1; then
    echo "jq not found; install jq first" >&2
    exit 1
  fi
fi

REPO_ROOT="$(pwd -P)"
COVERAGE_DIR="$REPO_ROOT/target/coverage"
mkdir -p "$COVERAGE_DIR"

# Baseline thresholds (raise over time).
TS_LINES_MIN="${TS_LINES_MIN:-48}"
TS_ENGINE_CLIENT_LINES_MIN="${TS_ENGINE_CLIENT_LINES_MIN:-65}"
TS_ENGINE_CLIENT_FUNCTIONS_MIN="${TS_ENGINE_CLIENT_FUNCTIONS_MIN:-65}"
TS_ENGINE_CLIENT_LAUNCH_LINES_MIN="${TS_ENGINE_CLIENT_LAUNCH_LINES_MIN:-45}"
RUST_NATIVE_FOUNDATION_LIB_LINES_MIN="${RUST_NATIVE_FOUNDATION_LIB_LINES_MIN:-95}"
RUST_NATIVE_FOUNDATION_CAPTURE_LINES_MIN="${RUST_NATIVE_FOUNDATION_CAPTURE_LINES_MIN:-70}"
RUST_NATIVE_FOUNDATION_EXPORT_LINES_MIN="${RUST_NATIVE_FOUNDATION_EXPORT_LINES_MIN:-65}"
RUST_NATIVE_FOUNDATION_PROJECT_LINES_MIN="${RUST_NATIVE_FOUNDATION_PROJECT_LINES_MIN:-70}"
RUST_NATIVE_FOUNDATION_HANDLERS_LINES_MIN="${RUST_NATIVE_FOUNDATION_HANDLERS_LINES_MIN:-65}"
RUST_NATIVE_FOUNDATION_TRANSPORT_LINES_MIN="${RUST_NATIVE_FOUNDATION_TRANSPORT_LINES_MIN:-60}"
SWIFT_LINES_MIN="${SWIFT_LINES_MIN:-65}"
SWIFT_FUNCTIONS_MIN="${SWIFT_FUNCTIONS_MIN:-70}"
SWIFT_CAPTURE_RECORDING_LINES_MIN="${SWIFT_CAPTURE_RECORDING_LINES_MIN:-85}"
SWIFT_CAPTURE_FRAMERATE_LINES_MIN="${SWIFT_CAPTURE_FRAMERATE_LINES_MIN:-90}"
SWIFT_ASSET_WRITER_LINES_MIN="${SWIFT_ASSET_WRITER_LINES_MIN:-50}"
SWIFT_ASSET_WRITER_VIDEO_LINES_MIN="${SWIFT_ASSET_WRITER_VIDEO_LINES_MIN:-85}"
SWIFT_ASSET_WRITER_AUDIO_LINES_MIN="${SWIFT_ASSET_WRITER_AUDIO_LINES_MIN:-80}"
SWIFT_ASSET_WRITER_LIFECYCLE_LINES_MIN="${SWIFT_ASSET_WRITER_LIFECYCLE_LINES_MIN:-80}"

is_less_than() {
  local actual="$1"
  local minimum="$2"
  awk -v actual="$actual" -v minimum="$minimum" 'BEGIN { exit !(actual + 0 < minimum + 0) }'
}

failed=0

check_min() {
  local label="$1"
  local actual="$2"
  local minimum="$3"
  if [[ -z "$actual" || "$actual" == "null" ]]; then
    echo "FAIL: $label coverage missing"
    failed=1
    return
  fi

  if is_less_than "$actual" "$minimum"; then
    echo "FAIL: $label coverage ${actual}% is below required ${minimum}%"
    failed=1
  else
    echo "PASS: $label coverage ${actual}% (min ${minimum}%)"
  fi
}

check_nonzero() {
  local label="$1"
  local actual="$2"
  if [[ -z "$actual" || "$actual" == "null" ]]; then
    echo "FAIL: $label coverage missing"
    failed=1
    return
  fi

  if is_less_than "$actual" "0.01"; then
    echo "FAIL: $label coverage is 0% (critical modules must not be untested)"
    failed=1
  else
    echo "PASS: $label coverage ${actual}% (non-zero)"
  fi
}

if needs_scope typescript; then
  echo "==> typescript coverage report"
  TS_REPORT="$COVERAGE_DIR/typescript-coverage.txt"
  (
    cd apps/desktop-electrobun
    bun run i18n:compile
    bun run test:vitest:ci -- --coverage \
      --exclude tests/parity-e2e.test.ts \
      --exclude tests/native-http-launch-security.test.ts \
      --exclude tests/macos-engine-lifecycle.test.ts \
      --exclude tests/media-server-node-integration.test.ts
  ) 2>&1 | tee "$TS_REPORT"

  ENGINE_CLIENT_TS_REPORT="$COVERAGE_DIR/engine-client-typescript-coverage.txt"
  (
    cd packages/engine-client
    bun run test -- --coverage --coverage.reporter=json-summary --coverage.reportsDirectory=../../target/coverage/engine-client
  ) 2>&1 | tee "$ENGINE_CLIENT_TS_REPORT"

  TS_SUMMARY="$COVERAGE_DIR/typescript/coverage-summary.json"
  ENGINE_CLIENT_TS_SUMMARY="$COVERAGE_DIR/engine-client/coverage-summary.json"

  ts_all_lines="$(jq -r '.total.lines.pct' "$TS_SUMMARY")"
  ts_engine_client_lines="$(jq -r '.total.lines.pct' "$ENGINE_CLIENT_TS_SUMMARY")"
  ts_engine_client_functions="$(jq -r '.total.functions.pct' "$ENGINE_CLIENT_TS_SUMMARY")"
  ts_engine_client_launch_lines="$(
    jq -r --arg file "$REPO_ROOT/packages/engine-client/src/process/launchBun.ts" '.[$file].lines.pct // empty' "$ENGINE_CLIENT_TS_SUMMARY"
  )"
  ts_engine_lines="$(
    jq -r --arg file "$REPO_ROOT/apps/desktop-electrobun/src/mainview/lib/engine.ts" '.[$file].lines.pct // empty' "$TS_SUMMARY"
  )"
  ts_capture_telemetry_lines="$(
    jq -r --arg file "$REPO_ROOT/apps/desktop-electrobun/src/mainview/app/studio/view-model/captureTelemetryViewModel.ts" '.[$file].lines.pct // empty' "$TS_SUMMARY"
  )"

  echo "==> typescript coverage thresholds"
  check_min "TypeScript total lines" "$ts_all_lines" "$TS_LINES_MIN"
  check_min "TypeScript engine-client total lines" "$ts_engine_client_lines" "$TS_ENGINE_CLIENT_LINES_MIN"
  check_min "TypeScript engine-client total functions" "$ts_engine_client_functions" "$TS_ENGINE_CLIENT_FUNCTIONS_MIN"
  check_min "TypeScript engine-client launchBun lines" "$ts_engine_client_launch_lines" "$TS_ENGINE_CLIENT_LAUNCH_LINES_MIN"
  check_nonzero "TypeScript engine.ts lines" "$ts_engine_lines"
  check_nonzero "TypeScript captureTelemetryViewModel lines" "$ts_capture_telemetry_lines"
fi

if needs_scope rust; then
  echo "==> rust coverage report"
  RUST_REPORT="$COVERAGE_DIR/rust-summary.json"
  cargo llvm-cov \
    --workspace \
    --all-targets \
    --json \
    --summary-only \
    --exclude-from-report guerillaglass-engine-windows \
    --exclude-from-report guerillaglass-engine-linux \
    --ignore-filename-regex 'engines/protocol-rust/src/.*\.rs' \
    --output-path "$RUST_REPORT" >/dev/null

  rust_total_lines="$(jq -r '.data[0].totals.lines.percent' "$RUST_REPORT")"
  rust_total_functions="$(jq -r '.data[0].totals.functions.percent' "$RUST_REPORT")"

  rust_file_lines() {
    local relative_path="$1"
    jq -r --arg file "$REPO_ROOT/$relative_path" \
      '.data[0].files[] | select(.filename == $file) | .summary.lines.percent' \
      "$RUST_REPORT"
  }

  rust_native_foundation_lib_lines="$(rust_file_lines "engines/native-foundation/src/lib.rs")"
  rust_native_foundation_capture_lines="$(rust_file_lines "engines/native-foundation/src/capture.rs")"
  rust_native_foundation_export_lines="$(rust_file_lines "engines/native-foundation/src/export.rs")"
  rust_native_foundation_project_lines="$(rust_file_lines "engines/native-foundation/src/project.rs")"
  rust_native_foundation_handlers_lines="$(rust_file_lines "engines/native-foundation/src/handlers.rs")"
  rust_native_foundation_transport_lines="$(rust_file_lines "engines/native-foundation/src/transport.rs")"

  echo "==> rust coverage thresholds"
  echo "INFO: Rust total lines coverage ${rust_total_lines}% (generated protocol-rust source excluded; not gated)"
  echo "INFO: Rust total functions coverage ${rust_total_functions}% (generated protocol-rust source excluded; not gated)"
  check_min "Rust native-foundation lib.rs lines" "$rust_native_foundation_lib_lines" "$RUST_NATIVE_FOUNDATION_LIB_LINES_MIN"
  check_min "Rust native-foundation capture.rs lines" "$rust_native_foundation_capture_lines" "$RUST_NATIVE_FOUNDATION_CAPTURE_LINES_MIN"
  check_min "Rust native-foundation export.rs lines" "$rust_native_foundation_export_lines" "$RUST_NATIVE_FOUNDATION_EXPORT_LINES_MIN"
  check_min "Rust native-foundation project.rs lines" "$rust_native_foundation_project_lines" "$RUST_NATIVE_FOUNDATION_PROJECT_LINES_MIN"
  check_min "Rust native-foundation handlers.rs lines" "$rust_native_foundation_handlers_lines" "$RUST_NATIVE_FOUNDATION_HANDLERS_LINES_MIN"
  check_min "Rust native-foundation transport.rs lines" "$rust_native_foundation_transport_lines" "$RUST_NATIVE_FOUNDATION_TRANSPORT_LINES_MIN"
fi

if needs_scope swift; then
  echo "==> swift coverage report"
  swift test --enable-code-coverage >/dev/null
  swift_cov_path="$(swift test --enable-code-coverage --show-codecov-path | tail -n 1)"
  SWIFT_REPORT="$COVERAGE_DIR/swift-summary.json"
  cp "$swift_cov_path" "$SWIFT_REPORT"

  swift_total_lines="$(jq -r '.data[0].totals.lines.percent' "$SWIFT_REPORT")"
  swift_total_functions="$(jq -r '.data[0].totals.functions.percent' "$SWIFT_REPORT")"

  swift_file_lines() {
    local relative_path="$1"
    jq -r --arg file "$REPO_ROOT/$relative_path" \
      '.data[0].files[] | select(.filename == $file) | .summary.lines.percent' \
      "$SWIFT_REPORT"
  }

  swift_capture_recording_lines="$(swift_file_lines "engines/macos-swift/modules/capture/CaptureEngine+Recording.swift")"
  swift_capture_sources_lines="$(swift_file_lines "engines/macos-swift/modules/capture/CaptureEngine+Sources.swift")"
  swift_capture_framerate_lines="$(swift_file_lines "engines/macos-swift/modules/capture/CaptureFrameRate.swift")"
  swift_asset_writer_lines="$(swift_file_lines "engines/macos-swift/modules/export/AssetWriter.swift")"
  swift_asset_writer_video_lines="$(swift_file_lines "engines/macos-swift/modules/export/AssetWriter+Video.swift")"
  swift_asset_writer_audio_lines="$(swift_file_lines "engines/macos-swift/modules/export/AssetWriter+Audio.swift")"
  swift_asset_writer_lifecycle_lines="$(swift_file_lines "engines/macos-swift/modules/export/AssetWriter+Lifecycle.swift")"

  echo "==> swift coverage thresholds"
  check_min "Swift total lines" "$swift_total_lines" "$SWIFT_LINES_MIN"
  check_min "Swift total functions" "$swift_total_functions" "$SWIFT_FUNCTIONS_MIN"
  check_min "Swift CaptureEngine+Recording lines" "$swift_capture_recording_lines" "$SWIFT_CAPTURE_RECORDING_LINES_MIN"
  check_nonzero "Swift CaptureEngine+Sources lines" "$swift_capture_sources_lines"
  check_min "Swift CaptureFrameRate lines" "$swift_capture_framerate_lines" "$SWIFT_CAPTURE_FRAMERATE_LINES_MIN"
  check_min "Swift AssetWriter lines" "$swift_asset_writer_lines" "$SWIFT_ASSET_WRITER_LINES_MIN"
  check_min "Swift AssetWriter+Video lines" "$swift_asset_writer_video_lines" "$SWIFT_ASSET_WRITER_VIDEO_LINES_MIN"
  check_min "Swift AssetWriter+Audio lines" "$swift_asset_writer_audio_lines" "$SWIFT_ASSET_WRITER_AUDIO_LINES_MIN"
  check_min "Swift AssetWriter+Lifecycle lines" "$swift_asset_writer_lifecycle_lines" "$SWIFT_ASSET_WRITER_LIFECYCLE_LINES_MIN"
fi

if [[ "$failed" -ne 0 ]]; then
  echo "==> coverage threshold check failed"
  exit 1
fi

echo "==> coverage threshold check passed"
