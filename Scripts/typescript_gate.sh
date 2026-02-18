#!/usr/bin/env bash
set -euo pipefail

if ! command -v bun >/dev/null 2>&1; then
  echo "bun not found; install Bun first" >&2
  exit 1
fi

echo "==> js format check (oxfmt)"
bun run js:format:check

echo "==> js lint (oxlint)"
bun run js:lint

echo "==> desktop typecheck"
(cd apps/desktop-electrobun && bun run typecheck)

echo "==> engine protocol typecheck"
(cd packages/engine-protocol && bun run typecheck)

echo "==> desktop tests"
bun run desktop:test

echo "==> typescript gate passed"
