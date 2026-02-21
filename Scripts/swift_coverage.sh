#!/usr/bin/env bash
set -euo pipefail

if ! command -v swift >/dev/null 2>&1; then
  echo "swift not found; install Swift toolchain first" >&2
  exit 1
fi

echo "==> swift tests with code coverage"
swift test --enable-code-coverage

codecov_path="$(swift test --enable-code-coverage --show-codecov-path | tail -n 1)"

if [[ ! -f "$codecov_path" ]]; then
  echo "Swift coverage JSON not found at: $codecov_path" >&2
  exit 1
fi

echo "==> swift coverage json: $codecov_path"
if command -v jq >/dev/null 2>&1; then
  echo "==> swift coverage totals"
  jq '{lines_percent: .data[0].totals.lines.percent, functions_percent: .data[0].totals.functions.percent, regions_percent: .data[0].totals.regions.percent}' "$codecov_path"
else
  echo "jq not found; skipping parsed totals output"
fi

