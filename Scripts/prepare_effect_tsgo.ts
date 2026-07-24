#!/usr/bin/env bun

const run = (command: Array<string>) =>
  Bun.spawnSync(command, {
    cwd: process.cwd(),
    env: process.env,
    stdout: "pipe",
    stderr: "pipe",
  });

export function compilerUsesTsgoVersion(compilerVersion: string, tsgoVersion: string): boolean {
  return compilerVersion.trim().endsWith(`+effect-tsgo.${tsgoVersion.trim()}`);
}

if (import.meta.main) {
  const tsgoVersionResult = run(["effect-tsgo", "--version"]);
  if (tsgoVersionResult.exitCode !== 0) {
    process.stderr.write(tsgoVersionResult.stderr);
    process.exit(tsgoVersionResult.exitCode);
  }

  const tsgoVersion = tsgoVersionResult.stdout
    .toString()
    .trim()
    .replace(/^tsgo v/, "");
  const compilerVersionResult = run(["tsc", "--version"]);
  if (compilerVersionResult.exitCode !== 0) {
    process.stderr.write(compilerVersionResult.stderr);
    process.exit(compilerVersionResult.exitCode);
  }

  const compilerVersion = compilerVersionResult.stdout.toString().trim();
  if (compilerUsesTsgoVersion(compilerVersion, tsgoVersion)) {
    console.log(`TypeScript compiler already uses @effect/tsgo ${tsgoVersion}.`);
    process.exit(0);
  }

  const patchResult = Bun.spawnSync(["effect-tsgo", "patch"], {
    cwd: process.cwd(),
    env: process.env,
    stdout: "inherit",
    stderr: "inherit",
  });
  process.exit(patchResult.exitCode);
}
