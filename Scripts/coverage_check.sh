#!/usr/bin/env bash
set -euo pipefail

if ! command -v bun >/dev/null 2>&1; then
  echo "bun not found; install Bun first" >&2
  exit 1
fi

if ! command -v swift >/dev/null 2>&1; then
  echo "swift not found; install Swift toolchain first" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq not found; install jq first" >&2
  exit 1
fi

if ! command -v cargo >/dev/null 2>&1; then
  echo "cargo not found; install Rust toolchain first" >&2
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

REPO_ROOT="$(pwd -P)"
COVERAGE_DIR="$REPO_ROOT/target/coverage"
mkdir -p "$COVERAGE_DIR"

# Baseline thresholds (raise over time).
TS_LINES_MIN="${TS_LINES_MIN:-75}"
TS_ENGINE_CLIENT_LINES_MIN="${TS_ENGINE_CLIENT_LINES_MIN:-90}"
RUST_LINES_MIN="${RUST_LINES_MIN:-75}"
RUST_FUNCTIONS_MIN="${RUST_FUNCTIONS_MIN:-80}"
RUST_NATIVE_FOUNDATION_LINES_MIN="${RUST_NATIVE_FOUNDATION_LINES_MIN:-80}"
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

echo "==> typescript coverage report"
TS_REPORT="$COVERAGE_DIR/typescript-coverage.txt"
bun run desktop:test:coverage 2>&1 | tee "$TS_REPORT"

ts_all_lines="$(awk -F'|' '$1 ~ /All files/{gsub(/ /,"",$3); print $3; exit}' "$TS_REPORT")"
ts_engine_client_lines="$(awk -F'|' '$1 ~ /src\/bun\/engineClient.ts/{gsub(/ /,"",$3); print $3; exit}' "$TS_REPORT")"
ts_engine_lines="$(awk -F'|' '$1 ~ /src\/mainview\/lib\/engine.ts/{gsub(/ /,"",$3); print $3; exit}' "$TS_REPORT")"
ts_capture_telemetry_lines="$(
  awk -F'|' '$1 ~ /src\/mainview\/app\/studio\/captureTelemetryPresentation.ts/{gsub(/ /,"",$3); print $3; exit}' "$TS_REPORT"
)"

echo "==> rust coverage report"
RUST_REPORT="$COVERAGE_DIR/rust-summary.json"
cargo llvm-cov --workspace --all-targets --json --summary-only --output-path "$RUST_REPORT" >/dev/null

rust_total_lines="$(jq -r '.data[0].totals.lines.percent' "$RUST_REPORT")"
rust_total_functions="$(jq -r '.data[0].totals.functions.percent' "$RUST_REPORT")"
rust_native_foundation_lines="$(
  jq -r --arg file "$REPO_ROOT/engines/native-foundation/src/lib.rs" \
    '.data[0].files[] | select(.filename == $file) | .summary.lines.percent' \
    "$RUST_REPORT"
)"

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

echo "==> coverage thresholds"
check_min "TypeScript total lines" "$ts_all_lines" "$TS_LINES_MIN"
check_min "TypeScript engineClient lines" "$ts_engine_client_lines" "$TS_ENGINE_CLIENT_LINES_MIN"
check_nonzero "TypeScript engine.ts lines" "$ts_engine_lines"
check_nonzero "TypeScript captureTelemetryPresentation lines" "$ts_capture_telemetry_lines"
check_min "Rust total lines" "$rust_total_lines" "$RUST_LINES_MIN"
check_min "Rust total functions" "$rust_total_functions" "$RUST_FUNCTIONS_MIN"
check_min "Rust native-foundation lines" "$rust_native_foundation_lines" "$RUST_NATIVE_FOUNDATION_LINES_MIN"
check_nonzero "Rust native-foundation lines" "$rust_native_foundation_lines"
check_min "Swift total lines" "$swift_total_lines" "$SWIFT_LINES_MIN"
check_min "Swift total functions" "$swift_total_functions" "$SWIFT_FUNCTIONS_MIN"
check_min "Swift CaptureEngine+Recording lines" "$swift_capture_recording_lines" "$SWIFT_CAPTURE_RECORDING_LINES_MIN"
check_nonzero "Swift CaptureEngine+Sources lines" "$swift_capture_sources_lines"
check_min "Swift CaptureFrameRate lines" "$swift_capture_framerate_lines" "$SWIFT_CAPTURE_FRAMERATE_LINES_MIN"
check_min "Swift AssetWriter lines" "$swift_asset_writer_lines" "$SWIFT_ASSET_WRITER_LINES_MIN"
check_min "Swift AssetWriter+Video lines" "$swift_asset_writer_video_lines" "$SWIFT_ASSET_WRITER_VIDEO_LINES_MIN"
check_min "Swift AssetWriter+Audio lines" "$swift_asset_writer_audio_lines" "$SWIFT_ASSET_WRITER_AUDIO_LINES_MIN"
check_min "Swift AssetWriter+Lifecycle lines" "$swift_asset_writer_lifecycle_lines" "$SWIFT_ASSET_WRITER_LIFECYCLE_LINES_MIN"

if [[ "$failed" -ne 0 ]]; then
  echo "==> coverage threshold check failed"
  exit 1
fi

echo "==> coverage threshold check passed"
