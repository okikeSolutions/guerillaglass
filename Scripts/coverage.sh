#!/usr/bin/env bash
set -euo pipefail

if ! command -v bun >/dev/null 2>&1; then
  echo "bun not found; install Bun first" >&2
  exit 1
fi

echo "==> typescript coverage"
bun run desktop:test:coverage

echo "==> rust coverage"
Scripts/rust_coverage.sh

echo "==> swift coverage"
Scripts/swift_coverage.sh

echo "==> coverage checks completed"

