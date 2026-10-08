import { describe, expect, test } from "bun:test";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Exercise the real orchestration without starting any compiler or test runner.
function runGate(failure = "", jobs = "2", ci = "", entry = ["full_gate.sh"]) {
  const root = mkdtempSync(join(tmpdir(), "gg-gate-test-"));
  try {
    for (const directory of [
      "Scripts",
      "bin",
      "packages/engine-contract",
      "packages/engine-client",
      "packages/review-protocol",
      "apps/desktop-electrobun",
    ]) {
      mkdirSync(join(root, directory), { recursive: true });
    }
    for (const script of [
      "full_gate.sh",
      "typescript_gate.sh",
      "rust_gate.sh",
      "native_fast_check.sh",
    ]) {
      copyFileSync(join(import.meta.dir, script), join(root, "Scripts", script));
    }
    const trace = join(root, "trace");
    writeFileSync(trace, "");
    const stub = `#!/bin/bash
if [[ -n "$GG_GATE_TEST_EXPECT_CARGO_JOBS" && "$CARGO_BUILD_JOBS" != "$GG_GATE_TEST_EXPECT_CARGO_JOBS" ]]; then
  echo "error: nested Cargo builds would escape the worker limit" >&2
  exit 24
fi
if ! mkdir "$GG_GATE_TEST_ACTIVE" 2>/dev/null; then
  echo "error: overlapping gate tools" >&2
  exit 25
fi
trap 'rmdir "$GG_GATE_TEST_ACTIVE"' EXIT
sleep 0.02
command="$(basename "$0") $*"
printf '%s\n' "$command" >> "$GG_GATE_TEST_TRACE"
if [[ "$command" == "$GG_GATE_TEST_FAIL" ]]; then
  echo "error: intentional gate failure" >&2
  exit 23
fi
`;
    for (const tool of ["bun", "cargo", "swift", "swiftformat", "swiftlint"]) {
      writeFileSync(join(root, "bin", tool), stub, { mode: 0o755 });
    }
    const result = Bun.spawnSync(["/bin/bash", `Scripts/${entry[0]}`, ...entry.slice(1)], {
      cwd: root,
      env: {
        ...process.env,
        PATH: `${join(root, "bin")}:${process.env.PATH}`,
        GG_GATE_TEST_TRACE: trace,
        GG_GATE_TEST_ACTIVE: join(root, "active"),
        GG_GATE_TEST_FAIL: failure,
        GG_GATE_JOBS: jobs,
        GG_NATIVE_FAST_JOBS: jobs,
        CARGO_BUILD_JOBS: "99",
        GG_GATE_TEST_EXPECT_CARGO_JOBS: entry[0] === "full_gate.sh" ? jobs : "",
        SKIP_DESKTOP_TESTS: "1",
        CI: ci,
      },
    });
    const runsDirectory = join(root, ".tmp/gate-logs");
    const run = existsSync(runsDirectory) ? readdirSync(runsDirectory)[0] : undefined;
    const summary = run ? readFileSync(join(runsDirectory, run, "summary.tsv"), "utf8") : "";
    return {
      status: result.exitCode,
      output: result.stdout.toString() + result.stderr.toString(),
      commands: readFileSync(trace, "utf8").trim().split("\n").filter(Boolean),
      summary,
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("local full gate scheduling", () => {
  test("runs preflight first and preserves full suites with bounded workers", () => {
    const result = runGate();
    expect(result.status).toBe(0);
    expect(result.commands).toEqual([
      "bun run repo:check",
      "bun run repo:test",
      "bun run docs:check",
      "bun run js:format:check",
      "cargo fmt --all --check",
      "swiftformat --lint .",
      "swiftlint --quiet",
      "bun run i18n:compile",
      "bun run js:lint:ci",
      "bun run js:lint:react-effects",
      "bun run check:contract",
      "bun run test -- --maxWorkers 2",
      "bun run test -- --maxWorkers 2",
      "bun run typecheck",
      "bun run test -- --maxWorkers 2",
      "bun run test:vitest:ci -- --run --maxWorkers 2",
      "bun run test:ui:ci -- --run --maxWorkers 2",
      "cargo clippy --workspace --all-targets -j 2 -- -D warnings",
      "cargo test --workspace --all-targets -j 2 -- --test-threads=2",
      "swift test -j 2 --no-parallel",
    ]);
    const summaryRows = result.summary
      .trimEnd()
      .split("\n")
      .map((row) => row.split("\t"));
    expect(summaryRows[0]).toEqual(["check", "status", "seconds", "log"]);
    expect(summaryRows.slice(1).map(([label]) => label)).toEqual([
      "typescript-preflight",
      "rust-format",
      "swift-format",
      "swift-lint",
      "typescript",
      "rust",
      "swift-tests",
    ]);
    expect(summaryRows.slice(1).map(([, status]) => status)).toEqual(Array(7).fill("0"));
    expect(result.output).toContain("full gate passed");
  });

  test("format failure prevents heavy checks and reports its log and exit status", () => {
    const result = runGate("swiftformat --lint .");
    expect(result.status).toBe(23);
    expect(result.commands.at(-1)).toBe("swiftformat --lint .");
    expect(result.commands.some((command) => /clippy|test:vitest|swift test/.test(command))).toBe(
      false,
    );
    expect(result.output).toContain("error: intentional gate failure");
    expect(result.output).toContain("full log:");
    expect(result.summary).toContain("swift-format\t23\t");
  });

  test("heavy failure prevents later suites; worker override reaches each runner", () => {
    const failure = "cargo test --workspace --all-targets -j 1 -- --test-threads=1";
    const result = runGate(failure, "1", "true");
    expect(result.status).toBe(23);
    expect(result.commands.at(-1)).toBe(failure);
    expect(result.commands).toContain("bun run test:ui:ci -- --run --maxWorkers 1");
    expect(result.commands).toContain(
      "bun run test:vitest:ci -- --run --maxWorkers 1 --exclude tests/parity-e2e.test.ts --exclude tests/native-http-launch-security.test.ts",
    );
    expect(result.commands.some((command) => command.startsWith("swift test"))).toBe(false);
  });

  test("rejects invalid worker limits before starting tools", () => {
    const result = runGate("", "0");
    expect(result.status).toBe(2);
    expect(result.commands).toEqual([]);
  });
});

describe("native fast checks", () => {
  test("Rust checks the selected crate or workspace without executing tests", () => {
    for (const [target, command] of [
      ["native-foundation", "cargo check -p native-foundation -j 2"],
      ["", "cargo check --workspace -j 2"],
    ]) {
      const result = runGate("", "2", "", ["native_fast_check.sh", "rust", target]);
      expect(result.status).toBe(0);
      expect(result.commands).toEqual(["cargo fmt --all --check", command]);
    }
  });

  test("Swift builds the selected target or engine with bounded jobs and frozen resolution", () => {
    for (const [target, command] of [
      ["Capture", "swift build --target Capture --disable-automatic-resolution -j 1"],
      ["", "swift build --product guerillaglass-engine --disable-automatic-resolution -j 1"],
    ]) {
      const result = runGate("", "1", "", ["native_fast_check.sh", "swift", target]);
      expect(result.status).toBe(0);
      expect(result.commands).toEqual(["swiftformat --lint .", command]);
    }
  });

  test("protocol checks compile both consumers sequentially", () => {
    const result = runGate("", "2", "", ["native_fast_check.sh", "protocol"]);
    expect(result.status).toBe(0);
    expect(result.commands).toEqual([
      "cargo fmt --all --check",
      "cargo check --workspace -j 2",
      "swiftformat --lint .",
      "swift build --product guerillaglass-engine --disable-automatic-resolution -j 2",
    ]);
  });

  test("failed Rust compilation prevents Swift work in protocol mode", () => {
    const failure = "cargo check --workspace -j 2";
    const result = runGate(failure, "2", "", ["native_fast_check.sh", "protocol"]);
    expect(result.status).toBe(23);
    expect(result.commands).toEqual(["cargo fmt --all --check", failure]);
  });

  test("invalid worker limits and protocol targets fail before starting tools", () => {
    for (const [jobs, entry] of [
      ["0", ["native_fast_check.sh", "rust"]],
      ["2", ["native_fast_check.sh", "protocol", "Capture"]],
    ] as const) {
      const result = runGate("", jobs, "", [...entry]);
      expect(result.status).toBe(2);
      expect(result.commands).toEqual([]);
    }
  });
});
