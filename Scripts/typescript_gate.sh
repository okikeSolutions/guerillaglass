#!/usr/bin/env bash
set -euo pipefail

lock_dir=".tmp/typescript-gate.lock"
lock_timeout_seconds="${GG_TYPESCRIPT_GATE_LOCK_TIMEOUT_SECONDS:-1800}"
lock_waited_seconds=0
mkdir -p .tmp

process_start_identity() {
  ps -o lstart= -p "$1" 2>/dev/null | awk '{$1=$1; print}'
}

while ! mkdir "$lock_dir" 2>/dev/null; do
  if [[ ! -f "$lock_dir/owner" ]]; then
    # The owner writes this immediately after mkdir. Give it one second to publish ownership.
    sleep 1
    lock_waited_seconds=$((lock_waited_seconds + 1))
    if [[ ! -f "$lock_dir/owner" ]]; then
      echo "Stale TypeScript gate lock has no owner metadata: $lock_dir" >&2
      echo "After confirming no gate is running, remove it with: rm -rf '$lock_dir'" >&2
      exit 1
    fi
  fi

  IFS='|' read -r lock_pid lock_process_start < "$lock_dir/owner" || true
  current_process_start="$(process_start_identity "${lock_pid:-0}")"
  if [[ -z "$current_process_start" || "$current_process_start" != "$lock_process_start" ]]; then
    echo "Stale TypeScript gate lock is owned by an exited or recycled process: $lock_dir" >&2
    echo "After confirming no gate is running, remove it with: rm -rf '$lock_dir'" >&2
    exit 1
  fi

  if ((lock_waited_seconds >= lock_timeout_seconds)); then
    echo "Timed out waiting ${lock_timeout_seconds}s for TypeScript gate owned by PID ${lock_pid}." >&2
    exit 1
  fi

  echo "==> waiting for another TypeScript gate in this worktree (PID ${lock_pid})"
  sleep 1
  lock_waited_seconds=$((lock_waited_seconds + 1))
done

own_lock_identity="$$|$(process_start_identity "$$")"
printf '%s\n' "$own_lock_identity" > "$lock_dir/owner"
cleanup_gate_lock() {
  if [[ -f "$lock_dir/owner" ]] && [[ "$(cat "$lock_dir/owner")" == "$own_lock_identity" ]]; then
    rm -rf "$lock_dir"
  fi
}
trap cleanup_gate_lock EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

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
