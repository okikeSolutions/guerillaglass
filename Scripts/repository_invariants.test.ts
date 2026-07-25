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
  writeFixture(
    "package.json",
    JSON.stringify({
      scripts: { prepare: "effect-tsgo patch" },
      dependencies: { effect: "4.0.0-beta.101" },
      devDependencies: { typescript: "7.0.2", "@effect/tsgo": "0.24.3" },
    }),
  );
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

  test("requires a root TypeScript 7 compiler pin", () => {
    writeFixture("package.json", JSON.stringify({ dependencies: { effect: "4.0.0-beta.101" } }));
    const result = runCheck();
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("root devDependencies must pin the TypeScript 7 compiler");
  });

  test("rejects TypeScript versions older than the documented native backend", () => {
    writeFixture(
      "package.json",
      JSON.stringify({
        scripts: { prepare: "effect-tsgo patch" },
        dependencies: { effect: "4.0.0-beta.101" },
        devDependencies: { typescript: "6.0.3", "@effect/tsgo": "0.24.3" },
      }),
    );
    const result = runCheck();
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      "root TypeScript compiler must be version 7 or newer, found 6.0.3",
    );
  });

  test("requires Effect tsgo and rejects compiler API imports with TypeScript 7", () => {
    writeFixture(
      "package.json",
      JSON.stringify({
        scripts: { prepare: "effect-language-service patch" },
        dependencies: { effect: "4.0.0-beta.101" },
        devDependencies: {
          typescript: "^7.0.2",
          "@effect/language-service": "^0.87.1",
        },
      }),
    );
    writeFixture(
      "apps/web/package.json",
      JSON.stringify({
        dependencies: {
          "@effect/language-service": "^0.87.1",
          typescript: "7.0.3",
        },
      }),
    );
    writeFixture("Scripts/legacy-parser.mjs", 'import ts from "typescript";\n');
    writeFixture("Scripts/legacy-require.cjs", "require(`typescript/lib/typescript.js`);\n");
    writeFixture("Scripts/legacy-dynamic.mjs", "void import(`typescript`);\n");
    writeFixture("Scripts/legacy-import-equals.ts", 'import ts = require("typescript");\n');

    let result = runCheck();
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("TypeScript 7 requires @effect/tsgo");
    expect(result.stderr).toContain("exact synchronized versions");
    expect(result.stderr).toContain("instead of @effect/language-service");
    expect(result.stderr).toContain("TypeScript version 7.0.3 does not match root");
    expect(result.stderr).toContain('official prepare script "effect-tsgo patch"');
    expect(result.stderr).toContain("imports the removed TypeScript 7 compiler API");

    writeFixture(
      "package.json",
      JSON.stringify({
        scripts: { prepare: "effect-tsgo patch" },
        dependencies: { effect: "4.0.0-beta.101" },
        devDependencies: { typescript: "7.0.2", "@effect/tsgo": "0.24.3" },
      }),
    );
    writeFixture("apps/web/package.json", JSON.stringify({ dependencies: {} }));
    writeFixture("Scripts/legacy-parser.mjs", 'import { parseSync } from "oxc-parser";\n');
    writeFixture("Scripts/legacy-require.cjs", 'require("oxc-parser");\n');
    writeFixture("Scripts/legacy-dynamic.mjs", 'void import("oxc-parser");\n');
    writeFixture("Scripts/legacy-import-equals.ts", 'import parser = require("oxc-parser");\n');
    result = runCheck();
    expect(result.exitCode).toBe(0);
  });

  test("rejects direct Node path, filesystem, and crypto imports in application services", () => {
    writeFixture(
      "apps/desktop-electrobun/src/bun/media/unsafe-static.ts",
      'import path from "node:path";\nexport const value = path.resolve(".");\n',
    );
    writeFixture(
      "apps/desktop-electrobun/src/bun/media/unsafe-side-effect.ts",
      'import "node:fs";\nexport const value = true;\n',
    );
    writeFixture(
      "apps/desktop-electrobun/src/bun/media/unsafe-require.ts",
      'const fs = require("node:fs");\nexport const value = fs.existsSync(".");\n',
    );
    writeFixture(
      "apps/desktop-electrobun/src/bun/media/unsafe-dynamic.ts",
      "export const value = import(`node:crypto`);\n",
    );
    const result = runCheck();
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("unsafe-static.ts must use Effect Path");
    expect(result.stderr).toContain("unsafe-side-effect.ts must use Effect Path");
    expect(result.stderr).toContain("unsafe-require.ts must use Effect Path");
    expect(result.stderr).toContain("unsafe-dynamic.ts must use Effect Path");
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
