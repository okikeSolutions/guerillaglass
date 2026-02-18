#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

cargo build --release
mkdir -p bin

if [[ -f "target/release/guerillaglass-engine-windows.exe" ]]; then
  cp "target/release/guerillaglass-engine-windows.exe" "bin/guerillaglass-engine-windows.exe"
elif [[ -f "target/release/guerillaglass-engine-windows" ]]; then
  cp "target/release/guerillaglass-engine-windows" "bin/guerillaglass-engine-windows.exe"
else
  echo "Built binary not found in target/release" >&2
  exit 1
fi

echo "Windows native engine copied to bin/guerillaglass-engine-windows.exe"
