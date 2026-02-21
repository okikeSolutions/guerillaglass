#!/usr/bin/env bash
set -euo pipefail

# Run Rust gate
echo "==> rust gate"
Scripts/rust_gate.sh

# Run TypeScript gate
echo "==> typescript gate"
Scripts/typescript_gate.sh

# Run docs gate for Swift/Rust surfaces
echo "==> docs gate (native surfaces)"
bun run docs:check:native

# Run SwiftFormat
echo "==> swiftformat"
swiftformat .

# Run SwiftLint
echo "==> swiftlint"
swiftlint

# Run SwiftTest
echo "==> swift test"
swift test

# Build the project
echo "==> swift build"
swift build

echo "==> full gate passed"
