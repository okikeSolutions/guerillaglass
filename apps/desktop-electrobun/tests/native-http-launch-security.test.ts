import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeAll, describe, expect, test } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const authToken = "native-http-launch-security-token";

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

type ReadyEnvelope = {
  readonly type: "guerillaglass.engine.http.ready";
  readonly host: string;
  readonly port: number;
};

const launchedProcesses = new Set<ChildProcessWithoutNullStreams>();

function buildNativeEngines(): void {
  for (const fixture of fixtures) {
    const result = spawnSync("cargo", ["build", "--manifest-path", fixture.manifestPath], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    if (result.status !== 0) {
      throw new Error(`Failed to build ${fixture.name}\n${result.stderr}`);
    }
  }
}

function readReadyEnvelope(child: ChildProcessWithoutNullStreams): Promise<ReadyEnvelope> {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      reject(
        new Error(`Timed out waiting for engine readiness. stdout=${stdout} stderr=${stderr}`),
      );
    }, 10_000);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      for (const line of stdout.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("{")) continue;
        const envelope = JSON.parse(trimmed) as ReadyEnvelope;
        if (envelope.type === "guerillaglass.engine.http.ready") {
          clearTimeout(timeout);
          resolve(envelope);
        }
      }
    });
    child.once("exit", (code, signal) => {
      clearTimeout(timeout);
      reject(
        new Error(
          `Engine exited before readiness code=${code} signal=${signal} stdout=${stdout} stderr=${stderr}`,
        ),
      );
    });
  });
}

async function launchEngine(
  fixture: EngineFixture,
): Promise<{ readonly child: ChildProcessWithoutNullStreams; readonly baseUrl: string }> {
  const tempRoot = fs.mkdtempSync(
    path.join(fs.realpathSync(os.tmpdir()), `gg-${fixture.name}-http-security-`),
  );
  const child = spawn(fixture.enginePath, [], {
    cwd: repoRoot,
    env: {
      ...process.env,
      GG_ENGINE_TRANSPORT: "http",
      GG_ENGINE_HTTP_AUTH_TOKEN: authToken,
      HOME: tempRoot,
      USERPROFILE: tempRoot,
    },
  });
  launchedProcesses.add(child);
  const ready = await readReadyEnvelope(child);
  expect(ready.host).toBe("127.0.0.1");
  expect(ready.port).toBeGreaterThan(0);
  return { child, baseUrl: `http://${ready.host}:${ready.port}` };
}

async function stopEngine(child: ChildProcessWithoutNullStreams): Promise<void> {
  if (!launchedProcesses.delete(child)) return;
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill();
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, 1_000);
    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

function authorizedHeaders(extra?: HeadersInit): HeadersInit {
  return {
    authorization: `Bearer ${authToken}`,
    ...extra,
  };
}

function postOversizedBodyWithCurl(baseUrl: string): number {
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
  const result = spawnSync(
    "curl",
    [
      "--silent",
      "--output",
      "/dev/null",
      "--write-out",
      "%{http_code}",
      "--header",
      `authorization: Bearer ${authToken}`,
      "--header",
      "content-type: application/json",
      "--data-binary",
      `@${tempFile}`,
      `${baseUrl}/v1/capture/start-display`,
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
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
      const { child, baseUrl } = await launchEngine(fixture);
      try {
        const missingAuth = await fetch(`${baseUrl}/v1/system/ping`);
        expect(missingAuth.status).toBe(401);

        const ping = await fetch(`${baseUrl}/v1/system/ping`, { headers: authorizedHeaders() });
        expect(ping.status).toBe(200);
        await expect(ping.json()).resolves.toMatchObject({
          app: "guerillaglass",
          platform: fixture.expectedPlatform,
          protocolVersion: "2",
        });

        const hostileOrigin = await fetch(`${baseUrl}/v1/system/ping`, {
          headers: authorizedHeaders({ origin: "https://evil.example" }),
        });
        expect(hostileOrigin.status).toBe(403);

        const unsupportedRoute = await fetch(`${baseUrl}/v1/does-not-exist`, {
          headers: authorizedHeaders(),
        });
        expect(unsupportedRoute.status).toBe(404);

        const unsupportedMethod = await fetch(`${baseUrl}/v1/system/ping`, {
          headers: authorizedHeaders(),
          method: "POST",
        });
        expect(unsupportedMethod.status).toBe(405);

        expect(postOversizedBodyWithCurl(baseUrl)).toBe(413);
      } finally {
        await stopEngine(child);
      }
    }, 30_000);
  }
});
