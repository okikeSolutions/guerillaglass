#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FIXTURE_DIR="$ROOT_DIR/docs/fixtures/engine-contract-v2"
OPENAPI_FILE="${OPENAPI_FILE:-$FIXTURE_DIR/spike.openapi.json}"
SWIFT_CONFIG_FILE="$FIXTURE_DIR/swift-openapi-generator-config.yaml"
RUST_CONFIG_FILE="$FIXTURE_DIR/openapi-generator-rust-axum.json"
WORK_DIR="${TMPDIR:-/tmp}/guerillaglass-engine-generator-spike"

OPENAPI_GENERATOR_VERSION="7.23.0"
SWIFT_OPENAPI_GENERATOR_VERSION="1.12.2"
SWIFT_OPENAPI_RUNTIME_VERSION="1.12.0"
SWIFT_OPENAPI_URLSESSION_VERSION="1.3.0"

echo "==> Engine generator spike"
echo "OpenAPI input: $OPENAPI_FILE"
echo "Work dir: $WORK_DIR"

rm -rf "$WORK_DIR"
mkdir -p "$WORK_DIR/rust" "$WORK_DIR/swift/Sources/EngineContractV2Spike"

cp "$OPENAPI_FILE" "$WORK_DIR/swift/Sources/EngineContractV2Spike/openapi.json"
cp "$SWIFT_CONFIG_FILE" "$WORK_DIR/swift/Sources/EngineContractV2Spike/openapi-generator-config.yaml"
cat > "$WORK_DIR/swift/Sources/EngineContractV2Spike/EngineContractV2Spike.swift" <<'SWIFT'
public enum EngineContractV2SpikeMarker {}
SWIFT
cat > "$WORK_DIR/swift/Package.swift" <<SWIFT
// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "EngineContractV2Spike",
    platforms: [.macOS(.v14)],
    products: [
        .library(name: "EngineContractV2Spike", targets: ["EngineContractV2Spike"])
    ],
    dependencies: [
        .package(url: "https://github.com/apple/swift-openapi-generator", exact: "$SWIFT_OPENAPI_GENERATOR_VERSION"),
        .package(url: "https://github.com/apple/swift-openapi-runtime", exact: "$SWIFT_OPENAPI_RUNTIME_VERSION"),
        .package(url: "https://github.com/apple/swift-openapi-urlsession", exact: "$SWIFT_OPENAPI_URLSESSION_VERSION")
    ],
    targets: [
        .target(
            name: "EngineContractV2Spike",
            dependencies: [
                .product(name: "OpenAPIRuntime", package: "swift-openapi-runtime"),
                .product(name: "OpenAPIURLSession", package: "swift-openapi-urlsession")
            ],
            plugins: [
                .plugin(name: "OpenAPIGenerator", package: "swift-openapi-generator")
            ]
        )
    ]
)
SWIFT

echo "==> Generating/building Swift with apple/swift-openapi-generator $SWIFT_OPENAPI_GENERATOR_VERSION"
(
  cd "$WORK_DIR/swift"
  swift build
)

echo "==> Generating Rust with OpenAPI Generator CLI $OPENAPI_GENERATOR_VERSION / rust-axum"
(
  cd "$WORK_DIR"
  cat > openapitools.json <<JSON
{
  "generator-cli": {
    "version": "$OPENAPI_GENERATOR_VERSION"
  }
}
JSON
  npx --yes @openapitools/openapi-generator-cli generate \
    -g rust-axum \
    -i "$OPENAPI_FILE" \
    -o "$WORK_DIR/rust" \
    -c "$RUST_CONFIG_FILE"
  # Keep generated crate outside the repository workspace when checking in TMPDIR.
  printf '\n[workspace]\n' >> "$WORK_DIR/rust/Cargo.toml"
  cd "$WORK_DIR/rust"
  cargo check
)

echo "==> Spike succeeded"
echo "Generated artifacts are in: $WORK_DIR"
