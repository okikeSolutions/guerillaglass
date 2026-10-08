import { chmod, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { describe } from "vitest";
import { validateEngineExecutableTrust } from "../src/process/trust";

function executableFixture(label: string, contents = "#!/bin/sh\necho ok\n") {
  return Effect.gen(function* () {
    const directory = yield* Effect.acquireRelease(
      Effect.promise(() => mkdtemp(join(tmpdir(), `gg-engine-client-trust-${label}-`))),
      (path) => Effect.promise(() => rm(path, { recursive: true, force: true })),
    );
    const enginePath = join(directory, "engine");
    yield* Effect.promise(() => writeFile(enginePath, contents));
    yield* Effect.promise(() => chmod(enginePath, 0o700));
    return { directory, enginePath, contents };
  });
}

function expectTrustRejected(effect: ReturnType<typeof validateEngineExecutableTrust>) {
  return Effect.gen(function* () {
    const error = yield* Effect.flip(effect);
    expect(error).toMatchObject({ code: "ENGINE_TRUST_REJECTED" });
  });
}

describe("engine executable trust validation", () => {
  it.live("skips trust checks when the policy is disabled", () =>
    Effect.scoped(
      Effect.gen(function* () {
        yield* validateEngineExecutableTrust("/path/that/does/not/exist", undefined);
        yield* validateEngineExecutableTrust("/path/that/does/not/exist", { enabled: false });
      }).pipe(Effect.provide(NodeServices.layer)),
    ),
  );

  it.live("accepts a regular private executable matching the expected SHA-256", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const { enginePath, contents } = yield* executableFixture("sha");
        const digest = createHash("sha256").update(contents).digest("hex");

        yield* validateEngineExecutableTrust(enginePath, {
          enabled: true,
          expectedSha256: `sha256:${digest.toUpperCase()}`,
          requireCurrentUserOwner: true,
        });
      }).pipe(Effect.provide(NodeServices.layer)),
    ),
  );

  it.live("rejects a SHA-256 mismatch", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const { enginePath } = yield* executableFixture("bad-sha");
        yield* expectTrustRejected(
          validateEngineExecutableTrust(enginePath, {
            enabled: true,
            expectedSha256: "0".repeat(64),
          }),
        );
      }).pipe(Effect.provide(NodeServices.layer)),
    ),
  );

  it.live("rejects symbolic-link executables by default", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const { directory, enginePath } = yield* executableFixture("symlink");
        const linkPath = join(directory, "engine-link");
        yield* Effect.promise(() => symlink(enginePath, linkPath));
        yield* expectTrustRejected(validateEngineExecutableTrust(linkPath, { enabled: true }));
      }).pipe(Effect.provide(NodeServices.layer)),
    ),
  );

  it.live("rejects group and world writable executables by default", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const { enginePath } = yield* executableFixture("writable");
        yield* Effect.promise(() => chmod(enginePath, 0o722));
        yield* expectTrustRejected(validateEngineExecutableTrust(enginePath, { enabled: true }));
      }).pipe(Effect.provide(NodeServices.layer)),
    ),
  );
});
