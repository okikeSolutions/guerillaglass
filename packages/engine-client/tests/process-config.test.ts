import { chmod, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test, vi } from "vitest";
import { ConfigProvider, Effect, Exit, Option, Redacted } from "effect";
import { EngineProcessConfig } from "../src/process/config";
import {
  makeEngineBearerToken,
  makeEngineHttpProcess,
  resolveEnginePath,
} from "../src/process/launchBun";

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

  test("resolves explicit engine paths without reading GG_ENGINE_PATH", async () => {
    const dir = await mkdtemp(join(tmpdir(), "gg-engine-client-explicit-"));
    const enginePath = join(dir, "engine");
    await writeFile(enginePath, "#!/bin/sh\n");

    await expect(Effect.runPromise(resolveEnginePath(enginePath))).resolves.toBe(enginePath);
  });

  test("rejects blank, missing, and directory engine paths", async () => {
    const dir = await mkdtemp(join(tmpdir(), "gg-engine-client-invalid-"));
    const engineDirectory = join(dir, "engine-dir");
    await mkdir(engineDirectory);

    const blank = await Effect.runPromise(Effect.exit(resolveEnginePath("   ")));
    expect(Exit.isFailure(blank)).toBe(true);

    const missing = await Effect.runPromise(Effect.exit(resolveEnginePath(join(dir, "missing"))));
    expect(Exit.isFailure(missing)).toBe(true);

    const directory = await Effect.runPromise(Effect.exit(resolveEnginePath(engineDirectory)));
    expect(Exit.isFailure(directory)).toBe(true);
  });

  test("launches an engine process, reads readiness, and provides bearer connection details", async () => {
    const dir = await mkdtemp(join(tmpdir(), "gg-engine-client-launch-"));
    const enginePath = join(dir, "engine.sh");
    await writeFile(enginePath, "#!/bin/sh\n");
    await chmod(enginePath, 0o700);
    const kill = vi.fn();
    const spawn = vi.fn(() => ({
      stdout: new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              '{"type":"guerillaglass.engine.http.ready","host":"127.0.0.1","port":49152}\n',
            ),
          );
        },
      }),
      stderr: new ReadableStream({ start: (controller) => controller.close() }),
      exited: new Promise(() => undefined),
      kill,
    }));
    vi.stubGlobal("Bun", { spawn });

    const launched = await Effect.runPromise(
      Effect.scoped(makeEngineHttpProcess({ enginePath, readinessTimeoutMs: 1_000 })),
    );

    expect(spawn).toHaveBeenCalledWith(
      [enginePath],
      expect.objectContaining({
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
        env: expect.objectContaining({ GG_ENGINE_TRANSPORT: "http" }),
      }),
    );

    expect(launched.address).toEqual({ host: "127.0.0.1", port: 49152 });
    expect(launched.baseUrl.toString()).toBe("http://127.0.0.1:49152/");
    expect(Redacted.value(launched.bearerToken)).toMatch(/^[a-f0-9]{64}$/);
  });

  test("reports process exit before readiness", async () => {
    const dir = await mkdtemp(join(tmpdir(), "gg-engine-client-launch-exit-"));
    const enginePath = join(dir, "engine.sh");
    await writeFile(enginePath, "#!/bin/sh\n");
    await chmod(enginePath, 0o700);
    vi.stubGlobal("Bun", {
      spawn: vi.fn(() => ({
        stdout: new ReadableStream({ start: (controller) => controller.close() }),
        stderr: new ReadableStream({ start: (controller) => controller.close() }),
        exited: Promise.resolve(7),
        kill: vi.fn(),
      })),
    });

    await expect(
      Effect.runPromise(
        Effect.scoped(makeEngineHttpProcess({ enginePath, readinessTimeoutMs: 1_000 })),
      ),
    ).rejects.toMatchObject({ code: "ENGINE_EXITED_BEFORE_READINESS" });
  });

  test("creates redacted bearer tokens", () => {
    const token = makeEngineBearerToken();
    expect(Redacted.value(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(String(token)).not.toContain(Redacted.value(token));
  });
});
