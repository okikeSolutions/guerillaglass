import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { ConfigProvider, Effect, Option } from "effect";
import { EngineProcessConfig } from "../src/process/config";
import { resolveEnginePath } from "../src/process/launchBun";

describe("engine process config", () => {
  test("loads launch inputs from the active ConfigProvider", async () => {
    const provider = ConfigProvider.fromEnv({
      env: {
        GG_ENGINE_PATH: "/tmp/test-engine",
        ENGINE_READINESS_TIMEOUT_MS: "1234",
      },
    });

    const config = await Effect.runPromise(
      EngineProcessConfig.pipe(Effect.provideService(ConfigProvider.ConfigProvider, provider)),
    );

    expect(Option.getOrUndefined(config.enginePath)).toBe("/tmp/test-engine");
    expect(config.readinessTimeoutMs).toBe(1234);
  });

  test("resolves GG_ENGINE_PATH through ConfigProvider instead of direct env reads", async () => {
    const dir = await mkdtemp(join(tmpdir(), "gg-engine-client-"));
    const enginePath = join(dir, "engine");
    await writeFile(enginePath, "#!/bin/sh\n");

    const provider = ConfigProvider.fromEnv({ env: { GG_ENGINE_PATH: enginePath } });

    const resolved = await Effect.runPromise(
      resolveEnginePath().pipe(Effect.provideService(ConfigProvider.ConfigProvider, provider)),
    );

    expect(resolved).toBe(enginePath);
  });
});
