#!/usr/bin/env bash
set -euo pipefail

if ! command -v cargo >/dev/null 2>&1; then
  echo "cargo not found; install Rust toolchain first" >&2
  exit 1
fi

echo "==> cargo fmt --check"
cargo fmt --all --check

echo "==> cargo clippy --workspace --all-targets -- -D warnings"
cargo clippy --workspace --all-targets -- -D warnings

echo "==> cargo test --workspace --all-targets"
cargo test --workspace --all-targets

echo "==> rust gate passed"
