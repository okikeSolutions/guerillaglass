#!/usr/bin/env bash
set -euo pipefail

mode="${1:-all}"
if (( $# > 1 )) || [[ "$mode" != "all" && "$mode" != "--after-preflight" ]]; then
  echo "Usage: $0 [--after-preflight]" >&2
  exit 2
fi
jobs="${GG_GATE_JOBS:-2}"
if [[ ! "$jobs" =~ ^[1-9][0-9]*$ ]]; then
  echo "GG_GATE_JOBS must be a positive integer" >&2
  exit 2
fi

if ! command -v cargo >/dev/null 2>&1; then
  echo "cargo not found; install Rust toolchain first" >&2
  exit 1
fi

if [[ "$mode" != "--after-preflight" ]]; then
  echo "==> cargo fmt --check"
  cargo fmt --all --check
fi

echo "==> cargo clippy --workspace --all-targets -- -D warnings"
cargo clippy --workspace --all-targets -j "$jobs" -- -D warnings

echo "==> cargo test --workspace --all-targets"
cargo test --workspace --all-targets -j "$jobs" -- --test-threads="$jobs"

echo "==> rust gate passed"
