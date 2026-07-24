#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v bun >/dev/null 2>&1; then
  echo "bun not found; install Bun 1.3+ first" >&2
  exit 1
fi

with_browser=1
if [[ "${1:-}" == "--without-browser" ]]; then
  with_browser=0
elif [[ $# -gt 0 ]]; then
  echo "usage: bun run bootstrap [--without-browser]" >&2
  exit 2
fi

echo "==> synchronizing the required Effect vendor submodule"
git submodule sync -- vendor/effect
git submodule update --init vendor/effect

echo "==> installing JavaScript dependencies"
bun install --frozen-lockfile

echo "==> compiling localization output"
bun run i18n:compile

if [[ "$with_browser" -eq 1 ]]; then
  echo "==> installing Playwright Chromium"
  bun run desktop:test:ui:install
fi

echo "==> checking repository invariants"
bun run repo:check

echo "==> bootstrap complete"
if [[ "$with_browser" -eq 0 ]]; then
  echo "Run 'bun run desktop:test:ui:install' before browser-backed desktop tests."
fi
