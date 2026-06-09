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

echo "==> React effect-state lint"
bun run js:lint:react-effects

echo "==> desktop typecheck"
(cd apps/desktop-electrobun && bun run typecheck)

echo "==> web app typecheck"
(cd apps/web && bun run typecheck)

echo "==> engine contract check"
(cd packages/engine-contract && bun run check:contract:full)

echo "==> engine client typecheck"
(cd packages/engine-client && bun run typecheck)

echo "==> review protocol typecheck"
(cd packages/review-protocol && bun run typecheck)

echo "==> desktop tests"
bun run desktop:test

echo "==> typescript gate passed"
