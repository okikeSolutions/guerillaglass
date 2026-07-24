import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const scriptPath = resolve(import.meta.dir, "lint_no_state_updates_in_effect.mjs");
let fixtureRoot = "";

beforeEach(() => {
  fixtureRoot = mkdtempSync(join(tmpdir(), "gg-react-effect-lint-"));
});

afterEach(() => {
  rmSync(fixtureRoot, { recursive: true, force: true });
});

describe("React effect state-update lint", () => {
  test("detects aliased setters inside parenthesized effect callbacks", () => {
    writeFileSync(
      join(fixtureRoot, "fixture.tsx"),
      `import { useEffect as effect, useState as state } from "react";
export function Fixture() {
  const [, updateValue] = state(0);
  effect((function () { updateValue(1); }), []);
  return null;
}
`,
    );

    const result = runLint();
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      "fixture.tsx:4:25 - useEffect should not call React state setter `updateValue` directly",
    );
  });

  test("preserves deferred nested-function behavior", () => {
    writeFileSync(
      join(fixtureRoot, "fixture.tsx"),
      `import * as React from "react";
export function Fixture() {
  const [, updateValue] = React.useState(0);
  React.useLayoutEffect(() => {
    const deferred = () => updateValue(1);
    void deferred;
  }, []);
  return null;
}
`,
    );

    const result = runLint();
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("react/no-state-updates-in-effect passed on 1 files");
  });
});

function runLint(): { exitCode: number; stdout: string; stderr: string } {
  const result = Bun.spawnSync(["bun", scriptPath], {
    env: { ...process.env, GG_REACT_EFFECT_LINT_ROOTS: fixtureRoot },
  });
  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}
