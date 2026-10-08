import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it } from "@effect/vitest";
import { ConfigProvider, Effect, Option, Redacted } from "effect";
import { describe } from "vitest";
import { EngineProcessConfig } from "../src/process/config";
import {
  makeEngineBearerToken,
  makeEngineHttpProcess,
  resolveEnginePath,
} from "../src/process/launchBun";

function acquireTempDirectory(prefix: string) {
  return Effect.acquireRelease(
    Effect.promise(() => mkdtemp(join(tmpdir(), prefix))),
    (directory) => Effect.promise(() => rm(directory, { recursive: true, force: true })),
  );
}

describe("engine process configuration", () => {
  it.effect("loads launch inputs from the active ConfigProvider", () =>
    EngineProcessConfig.pipe(
      Effect.provideService(
        ConfigProvider.ConfigProvider,
        ConfigProvider.fromEnv({
          env: {
            GG_ENGINE_PATH: "/tmp/test-engine",
            ENGINE_READINESS_TIMEOUT_MS: "1234",
          },
        }),
      ),
      Effect.tap((config) =>
        Effect.sync(() => {
          expect(Option.getOrUndefined(config.enginePath)).toBe("/tmp/test-engine");
          expect(config.readinessTimeoutMs).toBe(1234);
        }),
      ),
    ),
  );

  it.live("resolves GG_ENGINE_PATH through ConfigProvider and verifies the file exists", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const directory = yield* acquireTempDirectory("gg-engine-client-");
        const enginePath = join(directory, "engine");
        yield* Effect.promise(() => writeFile(enginePath, "#!/bin/sh\n"));
        const provider = ConfigProvider.fromEnv({ env: { GG_ENGINE_PATH: enginePath } });
        const resolved = yield* resolveEnginePath().pipe(
          Effect.provideService(ConfigProvider.ConfigProvider, provider),
          Effect.provide(NodeServices.layer),
        );
        expect(resolved).toBe(enginePath);
      }),
    ),
  );

  it.live("uses an explicit engine path without reading GG_ENGINE_PATH", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const directory = yield* acquireTempDirectory("gg-engine-client-explicit-");
        const enginePath = join(directory, "engine");
        yield* Effect.promise(() => writeFile(enginePath, "#!/bin/sh\n"));

        const resolved = yield* resolveEnginePath(enginePath).pipe(
          Effect.provide(NodeServices.layer),
        );
        expect(resolved).toBe(enginePath);
      }),
    ),
  );

  it.live("rejects blank, missing, and directory engine paths", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const directory = yield* acquireTempDirectory("gg-engine-client-invalid-");
        const engineDirectory = join(directory, "engine-dir");
        yield* Effect.promise(() => mkdir(engineDirectory));

        const blank = yield* Effect.exit(
          resolveEnginePath("   ").pipe(Effect.provide(NodeServices.layer)),
        );
        const missing = yield* Effect.exit(
          resolveEnginePath(join(directory, "missing")).pipe(Effect.provide(NodeServices.layer)),
        );
        const directoryPath = yield* Effect.exit(
          resolveEnginePath(engineDirectory).pipe(Effect.provide(NodeServices.layer)),
        );

        expect(blank._tag).toBe("Failure");
        expect(missing._tag).toBe("Failure");
        expect(directoryPath._tag).toBe("Failure");
      }),
    ),
  );

  it.live("launches a process and reads its readiness address and bearer token", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const directory = yield* acquireTempDirectory("gg-engine-client-launch-");
        const enginePath = join(directory, "engine.sh");
        yield* Effect.promise(() =>
          writeFile(
            enginePath,
            '#!/bin/sh\nprintf \'{"type":"guerillaglass.engine.http.ready","host":"127.0.0.1","port":49152}\\n\'\n',
          ),
        );
        yield* Effect.promise(() => chmod(enginePath, 0o700));

        const launched = yield* Effect.scoped(
          makeEngineHttpProcess({ enginePath, readinessTimeoutMs: 1000 }).pipe(
            Effect.provide(NodeServices.layer),
          ),
        );
        expect(launched.address).toEqual({ host: "127.0.0.1", port: 49_152 });
        expect(launched.baseUrl.toString()).toBe("http://127.0.0.1:49152/");
        expect(Redacted.value(launched.bearerToken)).toMatch(/^[a-f0-9]{64}$/);
      }),
    ),
  );

  it.live("reports readiness failure when the process exits before publishing", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const directory = yield* acquireTempDirectory("gg-engine-client-launch-exit-");
        const enginePath = join(directory, "engine.sh");
        yield* Effect.promise(() => writeFile(enginePath, "#!/bin/sh\nexit 7\n"));
        yield* Effect.promise(() => chmod(enginePath, 0o700));

        const error = yield* Effect.flip(
          Effect.scoped(
            makeEngineHttpProcess({ enginePath, readinessTimeoutMs: 1000 }).pipe(
              Effect.provide(NodeServices.layer),
            ),
          ),
        );
        expect(error).toMatchObject({
          code: expect.stringMatching(/^ENGINE_(EXITED_BEFORE_READINESS|READINESS_INVALID)$/),
        });
      }),
    ),
  );

  it.live("creates redacted bearer tokens", () =>
    makeEngineBearerToken.pipe(
      Effect.provide(NodeServices.layer),
      Effect.tap((token) =>
        Effect.sync(() => {
          expect(Redacted.value(token)).toMatch(/^[a-f0-9]{64}$/);
          expect(String(token)).not.toContain(Redacted.value(token));
        }),
      ),
    ),
  );
});
