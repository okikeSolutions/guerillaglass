#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

mode="${1:-}"
target="${2:-}"
jobs="${GG_NATIVE_FAST_JOBS:-2}"

if (( $# > 2 )); then
  echo "Usage: $0 {rust [package]|swift [target]|protocol}" >&2
  exit 2
fi

if [[ ! "$jobs" =~ ^[1-9][0-9]*$ ]]; then
  echo "GG_NATIVE_FAST_JOBS must be a positive integer" >&2
  exit 2
fi

case "$mode" in
  rust)
    cargo fmt --all --check
    if [[ -n "$target" ]]; then
      cargo check -p "$target" -j "$jobs"
    else
      cargo check --workspace -j "$jobs"
    fi
    ;;
  swift)
    swiftformat --lint .
    if [[ -n "$target" ]]; then
      swift build --target "$target" --disable-automatic-resolution -j "$jobs"
    else
      swift build --product guerillaglass-engine --disable-automatic-resolution -j "$jobs"
    fi
    ;;
  protocol)
    if [[ -n "$target" ]]; then
      echo "protocol mode does not accept a target" >&2
      exit 2
    fi
    cargo fmt --all --check
    cargo check --workspace -j "$jobs"
    swiftformat --lint .
    swift build --product guerillaglass-engine --disable-automatic-resolution -j "$jobs"
    ;;
  *)
    echo "Usage: $0 {rust [package]|swift [target]|protocol}" >&2
    exit 2
    ;;
esac
