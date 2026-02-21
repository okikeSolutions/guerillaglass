#!/usr/bin/env bash
set -euo pipefail

if ! command -v cargo >/dev/null 2>&1; then
  echo "cargo not found; install Rust toolchain first" >&2
  exit 1
fi

if ! cargo llvm-cov --version >/dev/null 2>&1; then
  cat >&2 <<'EOF'
cargo-llvm-cov is required for Rust coverage.
Install with:
  rustup component add llvm-tools-preview
  cargo install cargo-llvm-cov
EOF
  exit 1
fi

echo "==> rust coverage (workspace summary)"
cargo llvm-cov --workspace --all-targets --summary-only

