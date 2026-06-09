#!/usr/bin/env bash
set -euo pipefail

if ! command -v bun >/dev/null 2>&1; then
  echo "bun not found; install Bun first" >&2
  exit 1
fi

echo "==> js format check (oxfmt)"
bun run js:format:check

echo "==> i18n compile"
bun run i18n:compile

echo "==> js lint and typecheck (oxlint)"
bun run js:lint:ci

echo "==> React effect-state lint"
bun run js:lint:react-effects

echo "==> engine contract check"
(cd packages/engine-contract && bun run check:contract && bun run test)

echo "==> desktop tests"
(cd apps/desktop-electrobun && bun run test:ci)

echo "==> typescript gate passed"
