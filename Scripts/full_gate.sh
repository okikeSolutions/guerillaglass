#!/usr/bin/env bash
set -euo pipefail

wait_for_gate() {
  local label="$1"
  local pid="$2"
  set +e
  wait "$pid"
  local status=$?
  set -e
  if [[ "$status" -eq 0 ]]; then
    echo "==> $label passed"
    return 0
  fi
  echo "==> $label failed with status $status" >&2
  return "$status"
}

# These checks are independent and do not mutate source files. Run them concurrently for fast
# local feedback while still streaming every warning/error to the terminal.
echo "==> starting full gate checks"

Scripts/rust_gate.sh &
rust_pid=$!

Scripts/typescript_gate.sh &
typescript_pid=$!

swiftformat --lint . &
swiftformat_pid=$!

swiftlint --quiet &
swiftlint_pid=$!

swift test &
swift_test_pid=$!

failed=0
wait_for_gate "rust gate" "$rust_pid" || failed=1
wait_for_gate "typescript gate" "$typescript_pid" || failed=1
wait_for_gate "swiftformat" "$swiftformat_pid" || failed=1
wait_for_gate "swiftlint" "$swiftlint_pid" || failed=1
wait_for_gate "swift test" "$swift_test_pid" || failed=1

if [[ "$failed" -ne 0 ]]; then
  echo "==> full gate failed" >&2
  exit 1
fi

echo "==> full gate passed"
