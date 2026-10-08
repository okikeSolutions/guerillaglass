#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
export GG_GATE_JOBS="${GG_GATE_JOBS:-2}"
if [[ ! "$GG_GATE_JOBS" =~ ^[1-9][0-9]*$ ]]; then
  echo "GG_GATE_JOBS must be a positive integer" >&2
  exit 2
fi
export CARGO_BUILD_JOBS="$GG_GATE_JOBS"

mkdir -p .tmp/gate-logs
log_dir="$(mktemp -d .tmp/gate-logs/run.XXXXXX)"
printf 'check\tstatus\tseconds\tlog\n' > "$log_dir/summary.tsv"
echo "==> full gate: $GG_GATE_JOBS workers; logs in $log_dir"

run_check() {
  local label="$1"
  shift
  local log="$log_dir/$label.log"
  local started=$SECONDS
  local status=0
  echo "==> $label"
  "$@" > "$log" 2>&1 || status=$?
  local elapsed=$((SECONDS - started))
  printf '%s\t%s\t%s\t%s\n' "$label" "$status" "$elapsed" "$log" >> "$log_dir/summary.tsv"
  if ((status != 0)); then
    echo "==> $label failed in ${elapsed}s (status $status); full log: $log" >&2
    awk '/error:|error TS|FAIL|failed/ { print substr($0, 1, 600) }' "$log" | tail -12 >&2
    tail -20 "$log" >&2
    exit "$status"
  fi
  echo "==> $label passed in ${elapsed}s"
}

# Finish inexpensive checks before starting compilers or browser tests.
run_check typescript-preflight bash Scripts/typescript_gate.sh --preflight
run_check rust-format cargo fmt --all --check
run_check swift-format swiftformat --lint .
run_check swift-lint swiftlint --quiet

# Preserve the full gate's test coverage even when this variable is set for focused CI jobs.
unset SKIP_DESKTOP_TESTS
run_check typescript bash Scripts/typescript_gate.sh --after-preflight
run_check rust bash Scripts/rust_gate.sh --after-preflight
run_check swift-tests swift test -j "$GG_GATE_JOBS" --no-parallel
echo "==> full gate passed; timings: $log_dir/summary.tsv"
