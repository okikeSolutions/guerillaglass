#!/usr/bin/env bun
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const generatedPaths = [
  "packages/engine-contract/generated",
  "engines/protocol-swift/Sources/EngineProtocol/openapi.json",
  "engines/protocol-rust/.openapi-generator/FILES",
  "engines/protocol-rust/.openapi-generator/VERSION",
  "engines/protocol-rust/Cargo.toml",
  "engines/protocol-rust/README.md",
  "engines/protocol-rust/src",
];

const before = digestGeneratedArtifacts();
run(["bun", "run", "protocol:generate-bindings"]);
run(["cargo", "fmt", "--manifest-path", "engines/protocol-rust/Cargo.toml"]);
checkForStaleGeneratedRustSources();
const after = digestGeneratedArtifacts();

if (before !== after) {
  console.error(
    "Protocol generation changed committed artifacts. Review and keep the generated changes, then rerun this command to prove a second generation is stable.",
  );
  process.exit(1);
}

console.log("Protocol generation is deterministic from the current sources.");

function digestGeneratedArtifacts(): string {
  const hasher = new Bun.CryptoHasher("sha256");
  for (const path of generatedPaths.flatMap((path) => collectFiles(resolve(root, path))).sort()) {
    hasher.update(relative(root, path));
    hasher.update("\0");
    hasher.update(readFileSync(path));
    hasher.update("\0");
  }
  return hasher.digest("hex");
}

function checkForStaleGeneratedRustSources(): void {
  const protocolRoot = resolve(root, "engines/protocol-rust");
  const expectedSources = readFileSync(resolve(protocolRoot, ".openapi-generator/FILES"), "utf8")
    .split("\n")
    .filter((path) => path.startsWith("src/"))
    .sort();
  const actualSources = collectFiles(resolve(protocolRoot, "src"))
    .map((path) => relative(protocolRoot, path))
    .sort();

  const staleSources = actualSources.filter((path) => !expectedSources.includes(path));
  const missingSources = expectedSources.filter((path) => !actualSources.includes(path));
  if (staleSources.length > 0 || missingSources.length > 0) {
    console.error(
      `Generated Rust source inventory differs from .openapi-generator/FILES. Stale: ${staleSources.join(", ") || "none"}; missing: ${missingSources.join(", ") || "none"}`,
    );
    process.exit(1);
  }
}

function collectFiles(path: string): Array<string> {
  if (statSync(path).isFile()) {
    return [path];
  }
  const entryNames = readdirSync(path, { withFileTypes: true });
  return entryNames.flatMap((entry) => {
    const entryPath = join(path, entry.name);
    return entry.isDirectory() ? collectFiles(entryPath) : [entryPath];
  });
}

function run(command: Array<string>): void {
  const result = Bun.spawnSync(command, { cwd: root, stdout: "inherit", stderr: "inherit" });
  if (result.exitCode !== 0) {
    process.exit(result.exitCode);
  }
}
