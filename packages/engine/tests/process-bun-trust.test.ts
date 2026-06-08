import { createHash } from "node:crypto";
import { chmodSync, symlinkSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Effect, Exit } from "effect";
import { describe, expect, test } from "vitest";
import { validateEngineExecutableTrust } from "../src/client/processBun";

async function withTempDir<T>(callback: (root: string) => Promise<T>): Promise<T> {
  const root = await mkdtemp(path.join(tmpdir(), "gg-engine-trust-"));
  try {
    return await callback(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

describe("engine executable trust policy", () => {
  test("accepts a regular executable matching the configured sha256", async () => {
    await withTempDir(async (root) => {
      const enginePath = path.join(root, "engine");
      const contents = "#!/bin/sh\necho ready\n";
      writeFileSync(enginePath, contents, { mode: 0o755 });
      const expectedSha256 = createHash("sha256").update(contents).digest("hex");

      const exit = await Effect.runPromiseExit(
        validateEngineExecutableTrust(enginePath, {
          enabled: true,
          expectedSha256,
        }),
      );

      expect(Exit.isSuccess(exit)).toBe(true);
    });
  });

  test("rejects symlink executables", async () => {
    await withTempDir(async (root) => {
      const targetPath = path.join(root, "engine-target");
      const linkPath = path.join(root, "engine-link");
      writeFileSync(targetPath, "engine", { mode: 0o755 });
      symlinkSync(targetPath, linkPath);

      const exit = await Effect.runPromiseExit(
        validateEngineExecutableTrust(linkPath, { enabled: true }),
      );

      expect(Exit.isFailure(exit)).toBe(true);
    });
  });

  test("rejects group or world writable executables", async () => {
    await withTempDir(async (root) => {
      const enginePath = path.join(root, "engine");
      writeFileSync(enginePath, "engine", { mode: 0o777 });
      chmodSync(enginePath, 0o777);

      const exit = await Effect.runPromiseExit(
        validateEngineExecutableTrust(enginePath, {
          enabled: true,
          rejectWorldWritable: true,
        }),
      );

      expect(Exit.isFailure(exit)).toBe(true);
    });
  });

  test("rejects sha256 mismatches", async () => {
    await withTempDir(async (root) => {
      const enginePath = path.join(root, "engine");
      writeFileSync(enginePath, "engine", { mode: 0o755 });

      const exit = await Effect.runPromiseExit(
        validateEngineExecutableTrust(enginePath, {
          enabled: true,
          expectedSha256: "0".repeat(64),
        }),
      );

      expect(Exit.isFailure(exit)).toBe(true);
    });
  });
});
