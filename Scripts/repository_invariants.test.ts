import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const scriptPath = resolve(import.meta.dir, "repository_invariants.ts");
const guidePaths = [
  "AGENTS.md",
  "REVIEW.md",
  "docs/CHANGE_MAP.md",
  "apps/desktop-electrobun/AGENTS.md",
  "apps/web/AGENTS.md",
  "packages/engine-contract/AGENTS.md",
  "engines/AGENTS.md",
];

let fixtureRoot = "";

beforeEach(() => {
  fixtureRoot = mkdtempSync(join(tmpdir(), "gg-repository-invariants-"));
  for (const guidePath of guidePaths) {
    writeFixture(guidePath, "# Guide\n");
  }
  writeFixture("package.json", JSON.stringify({ dependencies: { effect: "4.0.0-beta.101" } }));
  writeFixture(
    "vendor/effect/packages/effect/package.json",
    JSON.stringify({ version: "4.0.0-beta.101" }),
  );
  writeFixture(
    "engines/protocol-rust/Cargo.toml",
    '[package]\nname = "protocol-rust"\n\n[dependencies]\nbase64 = "0.23"\nserde = "1"\n\n[dev-dependencies]\ntower = "0.5"\n',
  );
  writeFixture(
    "engines/protocol-rust/openapi-generator-templates/Cargo.mustache",
    '[package]\nname = "{{packageName}}"\n\n[dependencies]\nbase64 = "0.23"\nserde = "1"\n\n[dev-dependencies]\ntower = "0.5"\n',
  );
  writeFixture(
    "project.inlang/settings.json",
    JSON.stringify({
      baseLocale: "en-US",
      locales: ["en-US", "de-DE"],
      "plugin.inlang.messageFormat": { pathPattern: "./messages/{locale}.json" },
    }),
  );
  writeFixture(
    "messages/en-US.json",
    JSON.stringify({ greeting: "Hello {name}", status: "Ready" }),
  );
  writeFixture(
    "messages/de-DE.json",
    JSON.stringify({ greeting: "Hallo {name}", status: "Bereit" }),
  );
});

afterEach(() => {
  rmSync(fixtureRoot, { recursive: true, force: true });
});

describe("repository invariants", () => {
  test("accepts an aligned repository fixture", () => {
    expect(runCheck()).toMatchObject({ exitCode: 0 });
  });

  test("reports missing operational guidance", () => {
    unlinkSync(join(fixtureRoot, "REVIEW.md"));
    const result = runCheck();
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("missing agent/review guide: REVIEW.md");
  });

  test("reports workspace Effect runtime version drift", () => {
    writeFixture(
      "apps/web/package.json",
      JSON.stringify({ dependencies: { effect: "4.0.0-beta.100" } }),
    );
    const result = runCheck();
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("workspace Effect runtime versions are not aligned");
  });

  test("rejects platform-bun dependencies and non-Bun lockfiles", () => {
    writeFixture(
      "apps/web/package.json",
      JSON.stringify({ dependencies: { "@effect/platform-bun": "4.0.0-beta.101" } }),
    );
    writeFixture("package-lock.json", "{}\n");
    const result = runCheck();
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("must use @effect/platform-node");
    expect(result.stderr).toContain("unsupported package-manager lockfile present");
  });

  test("reports vendor drift when the Effect submodule is initialized", () => {
    writeFixture(
      "vendor/effect/packages/effect/package.json",
      JSON.stringify({ version: "4.0.0-beta.100" }),
    );
    const result = runCheck();
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("does not match vendor/effect 4.0.0-beta.100");
  });

  test("skips only the vendor comparison when the submodule is absent", () => {
    rmSync(join(fixtureRoot, "vendor/effect"), { recursive: true, force: true });
    const result = runCheck();
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("vendor comparison skipped; submodule not initialized");
  });

  test("reports generated Rust dependency drift or missing tables", () => {
    writeFixture(
      "engines/protocol-rust/Cargo.toml",
      '[dependencies]\nbase64 = "0.22"\nserde = "1"\n',
    );
    let result = runCheck();
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("[dependencies] does not match");

    writeFixture("engines/protocol-rust/Cargo.toml", '[package]\nname = "empty"\n');
    writeFixture(
      "engines/protocol-rust/openapi-generator-templates/Cargo.mustache",
      '[package]\nname = "empty"\n',
    );
    result = runCheck();
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("[dependencies] does not match");
  });

  test("reports localization key and placeholder drift", () => {
    writeFixture(
      "messages/de-DE.json",
      JSON.stringify({ greeting: "Hallo {person}", invalid: 42 }),
    );
    const result = runCheck();
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("localization key mismatch");
    expect(result.stderr).toContain("localization placeholder mismatch for greeting");
    expect(result.stderr).toContain("localization messages must be strings");
  });

  test("reports broken inline local Markdown file links", () => {
    writeFixture("AGENTS.md", "# Guide\n\n[Missing](docs/DOES_NOT_EXIST.md)\n");
    const result = runCheck();
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("broken local Markdown link in AGENTS.md");
  });
});

function writeFixture(path: string, content: string): void {
  const absolutePath = join(fixtureRoot, path);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content);
}

function runCheck(): { exitCode: number; stdout: string; stderr: string } {
  const result = Bun.spawnSync(["bun", scriptPath], {
    env: { ...process.env, GG_REPOSITORY_ROOT: fixtureRoot },
  });
  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}
