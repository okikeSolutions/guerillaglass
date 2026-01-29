#!/usr/bin/env bash
set -euo pipefail

echo "==> swiftformat"
swiftformat .

echo "==> swiftlint"
swiftlint

echo "==> swift build"
swift build

echo "==> full gate passed"
