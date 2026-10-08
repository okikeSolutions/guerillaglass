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
    "docs/CHANGE_MAP.md",
    "# Change map\n\n### Local check selection\n\n| Area | Local checks |\n| --- | --- |\n| Guidance | `bun run prepare` |\n\n### Focused tests\n",
  );
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

  test("requires the canonical protocol generator to use Bun for JavaScript tools", () => {
    writeFixture(
      "Scripts/generate_engine_protocol_v2.sh",
      "#!/bin/bash\nnpx --yes @openapitools/openapi-generator-cli generate\n",
    );
    const result = runCheck();
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      "generate_engine_protocol_v2.sh must invoke JavaScript tools through Bun",
    );
    writeFixture(
      "Scripts/generate_engine_protocol_v2.sh",
      "#!/bin/bash\nbunx @openapitools/openapi-generator-cli generate\n",
    );
    expect(runCheck().exitCode).toBe(0);
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

  test("rejects Effect casts, hidden dependencies, and cause-level recovery", () => {
    writeFixture(
      "packages/example/src/service.ts",
      `
      import { Context, Data, Effect, Schema } from "effect";
      const service = Context.Reference("hidden", { defaultValue: () => null });
      const failure = Data.TaggedError("Failure");
      const record = Schema.Class("Record")({});
      const effect = Effect.succeed(1) as Effect.Effect<string, never, never>;
      const input = process.env.TOKEN!;
      const recovered = effect.pipe(Effect.catchCause(() => Effect.succeed(null)));
    `,
    );
    const result = runCheck();
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("must preserve Effect success, error, and service types");
    expect(result.stderr).toContain("must expose application dependencies through Context.Service");
    expect(result.stderr).toContain(
      "must use Schema.Struct records and Schema.TaggedError failures",
    );
    expect(result.stderr).toContain("must recover typed failures");
    expect(result.stderr).toContain("must read application settings through Config");
  });

  test("rejects function wrappers around lazy zero-argument Effect service operations", () => {
    writeFixture(
      "packages/example/src/service.ts",
      `
      import { Context, Effect } from "effect";
      class Example extends Context.Service<Example, { readonly read: Effect.Effect<number> }>()("example/Example") {}
      export const layer = Example.of({
        read: Effect.fn("Example.read")(() => Effect.succeed(1)),
      });
    `,
    );
    const result = runCheck();
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      "must expose zero-argument service operations as lazy Effects instead of functions returning Effects",
    );

    writeFixture(
      "packages/example/src/service.ts",
      `
      import { Context, Effect } from "effect";
      class Example extends Context.Service<Example, { readonly read: Effect.Effect<number> }>()("example/Example") {}
      export const layer = Example.of({ read: Effect.succeed(1) });
    `,
    );
    expect(runCheck().exitCode).toBe(0);
  });

  test("fails when source cannot be parsed for Effect inspection", () => {
    writeFixture(
      "packages/example/src/service.ts",
      'import { Effect } from "effect"; export const =',
    );
    const result = runCheck();
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("cannot inspect Effect practices because parsing failed");
  });

  test("ignores comments and strings that describe forbidden Effect practices", () => {
    writeFixture(
      "packages/example/src/service.ts",
      `
      import { Effect } from "effect";
      // Effect.catchCause and process.env are prohibited in application services.
      export const description = "as Effect.Effect<string, never, never>";
      export const operation = Effect.fn("Example.operation")(() => Effect.succeed(1));
    `,
    );
    expect(runCheck()).toMatchObject({ exitCode: 0 });
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

  test("reports stale commands in the local verification table", () => {
    writeFixture(
      "docs/CHANGE_MAP.md",
      "### Local check selection\n\n| Area | Checks |\n| --- | --- |\n| Rust | `bun run missing:fast <crate>` |\n\n### Other examples\n\n`bun run unrelated:example`\n",
    );
    const result = runCheck();
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      "verification table references missing root package script: missing:fast",
    );
    expect(result.stderr).not.toContain("unrelated:example");
  });

  test("reports a missing verification selection table", () => {
    writeFixture("docs/CHANGE_MAP.md", "# Change map\n");
    const result = runCheck();
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("must contain a Local check selection table with Bun commands");
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
