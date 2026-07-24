#!/usr/bin/env bun
import { rmSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
for (const outputPath of ["apps/desktop-electrobun/src/paraglide", "apps/web/src/paraglide"]) {
  rmSync(resolve(root, outputPath), { recursive: true, force: true });
}

for (const script of ["i18n:compile:desktop", "i18n:compile:web"]) {
  const result = Bun.spawnSync(["bun", "run", script], {
    cwd: root,
    stdout: "inherit",
    stderr: "inherit",
  });
  if (result.exitCode !== 0) {
    process.exit(result.exitCode);
  }
}
