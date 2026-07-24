#!/usr/bin/env bash
set -euo pipefail

lock_dir=".tmp/typescript-gate.lock"
mkdir -p .tmp
while ! mkdir "$lock_dir" 2>/dev/null; do
  if [[ -f "$lock_dir/pid" ]] && ! kill -0 "$(cat "$lock_dir/pid")" 2>/dev/null; then
    rm -rf "$lock_dir"
    continue
  fi
  echo "==> waiting for another TypeScript gate in this worktree"
  sleep 1
done
printf '%s\n' "$$" > "$lock_dir/pid"
trap 'rm -rf "$lock_dir"' EXIT INT TERM

if ! command -v bun >/dev/null 2>&1; then
  echo "bun not found; install Bun first" >&2
  exit 1
fi

echo "==> repository invariants"
bun run repo:check
bun run repo:test

echo "==> documentation coverage ratchet"
bun run docs:check

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

if [[ "${SKIP_DESKTOP_TESTS:-}" == "1" ]]; then
  echo "==> desktop tests skipped by SKIP_DESKTOP_TESTS=1"
else
  echo "==> desktop tests"
  if [[ "${CI:-}" == "true" ]]; then
    (cd apps/desktop-electrobun && bun run test:vitest:ci -- --run --exclude tests/parity-e2e.test.ts --exclude tests/native-http-launch-security.test.ts && bun run test:ui:ci -- --run)
  else
    (cd apps/desktop-electrobun && bun run test:ci)
  fi
fi

echo "==> typescript gate passed"
