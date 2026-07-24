import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, Exit, Redacted, Scope, Stream } from "effect";
import * as ChildProcess from "effect/unstable/process/ChildProcess";
import type { ChildProcessHandle } from "effect/unstable/process/ChildProcessSpawner";
import { afterEach, beforeAll, describe, expect, test } from "vitest";
import { makeEngineHttpProcess } from "@guerillaglass/engine-client/process/launchBun";

const repoRoot = path.resolve(import.meta.dirname, "../../..");

const fixtures = [
  {
    enginePath: path.join(repoRoot, "target/debug/guerillaglass-engine-windows"),
    expectedPlatform: "windows",
    manifestPath: path.join(repoRoot, "engines/windows-native/Cargo.toml"),
    name: "windows-native",
  },
  {
    enginePath: path.join(repoRoot, "target/debug/guerillaglass-engine-linux"),
    expectedPlatform: "linux",
    manifestPath: path.join(repoRoot, "engines/linux-native/Cargo.toml"),
    name: "linux-native",
  },
] as const;

type EngineFixture = (typeof fixtures)[number];

type LaunchedEngine = {
  readonly baseUrl: string;
  readonly handle: ChildProcessHandle;
  readonly scope: Scope.Scope;
  readonly token: string;
};

const launchedProcesses = new Set<LaunchedEngine>();

async function runCommand(command: string, args: readonly string[], cwd = repoRoot) {
  return await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const handle = yield* ChildProcess.make(command, args, {
          cwd,
          stdin: "ignore",
          stdout: "pipe",
          stderr: "pipe",
        });
        const [stdout, stderr, exitCode] = yield* Effect.all([
          handle.stdout.pipe(
            Stream.decodeText(),
            Stream.runFold(
              () => "",
              (accumulator, chunk) => accumulator + chunk,
            ),
          ),
          handle.stderr.pipe(
            Stream.decodeText(),
            Stream.runFold(
              () => "",
              (accumulator, chunk) => accumulator + chunk,
            ),
          ),
          handle.exitCode,
        ]);
        return { exitCode, stderr, stdout };
      }),
    ).pipe(Effect.provide(NodeServices.layer)),
  );
}

async function buildNativeEngines(): Promise<void> {
  for (const fixture of fixtures) {
    const result = await runCommand("cargo", ["build", "--manifest-path", fixture.manifestPath]);
    if (result.exitCode !== 0) {
      throw new Error(`Failed to build ${fixture.name}\n${result.stderr}`);
    }
  }
}

async function launchEngine(fixture: EngineFixture): Promise<LaunchedEngine> {
  const tempRoot = fs.mkdtempSync(
    path.join(fs.realpathSync(os.tmpdir()), `gg-${fixture.name}-http-security-`),
  );
  const scope = await Effect.runPromise(Scope.make());
  try {
    const launched = await Effect.runPromise(
      makeEngineHttpProcess({
        enginePath: fixture.enginePath,
        env: {
          HOME: tempRoot,
          USERPROFILE: tempRoot,
        },
      }).pipe(Scope.provide(scope), Effect.provide(NodeServices.layer)),
    );
    expect(launched.address.host).toBe("127.0.0.1");
    expect(launched.address.port).toBeGreaterThan(0);
    const engine = {
      baseUrl: launched.baseUrl.toString().replace(/\/$/, ""),
      handle: launched.process,
      scope,
      token: Redacted.value(launched.bearerToken),
    };
    launchedProcesses.add(engine);
    return engine;
  } catch (error) {
    await Effect.runPromise(Scope.close(scope, Exit.fail(error)).pipe(Effect.ignore));
    throw error;
  }
}

async function stopEngine(engine: LaunchedEngine): Promise<void> {
  if (!launchedProcesses.delete(engine)) {
    return;
  }
  await Effect.runPromise(
    Effect.all(
      [
        engine.handle.kill({ forceKillAfter: "1 second" }).pipe(Effect.ignore),
        Scope.close(engine.scope, Exit.void),
      ],
      {
        discard: true,
      },
    ).pipe(Effect.ignore),
  );
}

function authorizedHeaders(token: string, extra?: HeadersInit): HeadersInit {
  return {
    authorization: `Bearer ${token}`,
    ...extra,
  };
}

async function postOversizedBodyWithCurl(baseUrl: string, token: string): Promise<number> {
  const tempFile = path.join(
    fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "gg-body-limit-")),
    "oversized.json",
  );
  fs.writeFileSync(
    tempFile,
    JSON.stringify({
      captureFps: 30,
      displayId: 1,
      enableMic: true,
      enablePreview: true,
      padding: "x".repeat(2 * 1024 * 1024),
    }),
  );
  const result = await runCommand("curl", [
    "--silent",
    "--output",
    "/dev/null",
    "--write-out",
    "%{http_code}",
    "--header",
    `authorization: Bearer ${token}`,
    "--header",
    "content-type: application/json",
    "--data-binary",
    `@${tempFile}`,
    `${baseUrl}/v1/capture/start-display`,
  ]);
  if (result.exitCode !== 0) {
    throw new Error(`curl body-limit request failed: ${result.stderr}`);
  }
  return Number(result.stdout);
}

beforeAll(buildNativeEngines, 60_000);

afterEach(async () => {
  await Promise.all(Array.from(launchedProcesses, stopEngine));
});

describe("native engine HTTP launch/security e2e", () => {
  for (const fixture of fixtures) {
    test(`covers readiness, bearer auth, success, body limit, origin guard, unsupported route, and unsupported method (${fixture.name})`, async () => {
      const engine = await launchEngine(fixture);
      try {
        const missingAuth = await fetch(`${engine.baseUrl}/v1/system/ping`);
        expect(missingAuth.status).toBe(401);

        const ping = await fetch(`${engine.baseUrl}/v1/system/ping`, {
          headers: authorizedHeaders(engine.token),
        });
        expect(ping.status).toBe(200);
        await expect(ping.json()).resolves.toMatchObject({
          app: "guerillaglass",
          platform: fixture.expectedPlatform,
          protocolVersion: "2",
        });

        const hostileOrigin = await fetch(`${engine.baseUrl}/v1/system/ping`, {
          headers: authorizedHeaders(engine.token, { origin: "https://evil.example" }),
        });
        expect(hostileOrigin.status).toBe(403);

        const unsupportedRoute = await fetch(`${engine.baseUrl}/v1/does-not-exist`, {
          headers: authorizedHeaders(engine.token),
        });
        expect(unsupportedRoute.status).toBe(404);

        const unsupportedMethod = await fetch(`${engine.baseUrl}/v1/system/ping`, {
          headers: authorizedHeaders(engine.token),
          method: "POST",
        });
        expect(unsupportedMethod.status).toBe(405);

        expect(await postOversizedBodyWithCurl(engine.baseUrl, engine.token)).toBe(413);
      } finally {
        await stopEngine(engine);
      }
    }, 30_000);
  }
});
