#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

cargo build --release
mkdir -p bin

if [[ -f "target/release/guerillaglass-engine-linux" ]]; then
  cp "target/release/guerillaglass-engine-linux" "bin/guerillaglass-engine-linux"
elif [[ -f "target/release/guerillaglass-engine-linux.exe" ]]; then
  cp "target/release/guerillaglass-engine-linux.exe" "bin/guerillaglass-engine-linux"
else
  echo "Built binary not found in target/release" >&2
  exit 1
fi

chmod +x "bin/guerillaglass-engine-linux"
echo "Linux native engine copied to bin/guerillaglass-engine-linux"
