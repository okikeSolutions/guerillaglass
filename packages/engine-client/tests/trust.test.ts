import { chmod, mkdtemp, symlink, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { Effect } from "effect";
import { validateEngineExecutableTrust } from "../src/process/trust";

async function executableFixture(label: string, contents = "#!/bin/sh\necho ok\n") {
  const dir = await mkdtemp(join(tmpdir(), `gg-engine-client-trust-${label}-`));
  const enginePath = join(dir, "engine");
  await writeFile(enginePath, contents);
  await chmod(enginePath, 0o700);
  return { dir, enginePath, contents };
}

async function expectTrustRejected(effect: ReturnType<typeof validateEngineExecutableTrust>) {
  await expect(Effect.runPromise(effect)).rejects.toMatchObject({
    code: "ENGINE_TRUST_REJECTED",
  });
}

describe("engine executable trust validation", () => {
  test("is skipped when trust policy is disabled", async () => {
    await expect(
      Effect.runPromise(validateEngineExecutableTrust("/path/that/does/not/exist", undefined)),
    ).resolves.toBeUndefined();

    await expect(
      Effect.runPromise(
        validateEngineExecutableTrust("/path/that/does/not/exist", { enabled: false }),
      ),
    ).resolves.toBeUndefined();
  });

  test("accepts regular private executables matching the expected SHA-256", async () => {
    const { enginePath, contents } = await executableFixture("sha");
    const digest = createHash("sha256").update(contents).digest("hex");

    await expect(
      Effect.runPromise(
        validateEngineExecutableTrust(enginePath, {
          enabled: true,
          expectedSha256: `sha256:${digest.toUpperCase()}`,
          requireCurrentUserOwner: true,
        }),
      ),
    ).resolves.toBeUndefined();
  });

  test("rejects SHA-256 mismatches", async () => {
    const { enginePath } = await executableFixture("bad-sha");
    await expectTrustRejected(
      validateEngineExecutableTrust(enginePath, {
        enabled: true,
        expectedSha256: "0".repeat(64),
      }),
    );
  });

  test("rejects symbolic-link executables by default", async () => {
    const { dir, enginePath } = await executableFixture("symlink");
    const linkPath = join(dir, "engine-link");
    await symlink(enginePath, linkPath);

    await expectTrustRejected(validateEngineExecutableTrust(linkPath, { enabled: true }));
  });

  test("rejects group/world writable executables by default", async () => {
    const { enginePath } = await executableFixture("writable");
    await chmod(enginePath, 0o722);

    await expectTrustRejected(validateEngineExecutableTrust(enginePath, { enabled: true }));
  });
});
