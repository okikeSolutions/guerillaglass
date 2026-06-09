import { spawn, spawnSync, type ChildProcessByStdio } from "node:child_process";
import type { Readable } from "node:stream";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, test } from "vitest";
import { Effect, Layer, Redacted } from "effect";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import { EngineClient, layerEngineClient } from "@guerillaglass/engine-client/service";
import {
  engineHttpBaseUrl,
  parseEngineHttpReadyLine,
} from "@guerillaglass/engine-client/process/readiness";
import {
  outputUrlSchema,
  projectPathSchema,
} from "@guerillaglass/engine-contract/schema-primitives";

type EngineFixture = {
  name: string;
  path: string;
  expectedPlatform: "windows" | "linux";
};

const fixtures: EngineFixture[] = [
  {
    name: "windows-native",
    path: path.resolve(import.meta.dirname, "../../../target/debug/guerillaglass-engine-windows"),
    expectedPlatform: "windows",
  },
  {
    name: "linux-native",
    path: path.resolve(import.meta.dirname, "../../../target/debug/guerillaglass-engine-linux"),
    expectedPlatform: "linux",
  },
];

function buildNativeEngine(manifestPath: string): void {
  const result = spawnSync("cargo", ["build", "--manifest-path", manifestPath], {
    encoding: "utf8",
    stdio: "pipe",
  });
  if (result.status !== 0) {
    throw new Error(`Failed to build ${manifestPath}\n${result.stderr}`);
  }
}

type LaunchedEngine = {
  readonly process: ChildProcessByStdio<null, Readable, Readable>;
  readonly baseUrl: URL;
  readonly bearerToken: Redacted.Redacted<string>;
};

function makeBearerToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function launchNativeEngine(fixture: EngineFixture, home: string): Promise<LaunchedEngine> {
  const token = makeBearerToken();
  const subprocess = spawn(fixture.path, [], {
    env: {
      ...process.env,
      HOME: home,
      USERPROFILE: home,
      GG_ENGINE_TRANSPORT: "http",
      GG_ENGINE_HTTP_AUTH_TOKEN: token,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stderr = "";
  subprocess.stderr.setEncoding("utf8");
  subprocess.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  const address = await new Promise<ReturnType<typeof parseEngineHttpReadyLine>>(
    (resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error(`Timed out waiting for ${fixture.name} readiness\n${stderr}`)),
        10_000,
      );
      let buffer = "";
      subprocess.stdout.setEncoding("utf8");
      subprocess.stdout.on("data", (chunk) => {
        buffer += chunk;
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const parsed = parseEngineHttpReadyLine(line.trim());
          if (parsed) {
            clearTimeout(timeout);
            resolve(parsed);
          }
        }
      });
      subprocess.once("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      subprocess.once("exit", (code) => {
        clearTimeout(timeout);
        reject(new Error(`${fixture.name} exited before readiness with code ${code}\n${stderr}`));
      });
    },
  );

  if (!address) throw new Error(`${fixture.name} emitted invalid readiness`);
  return {
    process: subprocess,
    baseUrl: engineHttpBaseUrl(address),
    bearerToken: Redacted.make(token, { label: "engine-http-bearer-token" }),
  };
}

describe("engine HTTP parity e2e", () => {
  beforeAll(() => {
    buildNativeEngine(
      path.resolve(import.meta.dirname, "../../../engines/windows-native/Cargo.toml"),
    );
    buildNativeEngine(
      path.resolve(import.meta.dirname, "../../../engines/linux-native/Cargo.toml"),
    );
  }, 30_000);
  for (const fixture of fixtures) {
    test(
      `runs capture->record->export->project flow (${fixture.name})`,
      { timeout: 30_000 },
      async () => {
        const tempRoot = fs.mkdtempSync(
          path.join(fs.realpathSync(os.tmpdir()), `${fixture.name}-e2e-`),
        );
        let launched: LaunchedEngine | undefined;
        try {
          launched = await launchNativeEngine(fixture, tempRoot);
          await Effect.gen(function* () {
            const engine = yield* EngineClient;
            const ping = yield* engine.systemPing;
            expect(ping.platform).toBe(fixture.expectedPlatform);

            const capabilities = yield* engine.engineCapabilities;
            expect(capabilities.platform).toBe(fixture.expectedPlatform);

            const sources = yield* engine.sourcesList;
            expect(sources.displays.length).toBeGreaterThan(0);
            expect(sources.displays[0]?.pixelScale).toBe(1);
            expect(sources.windows[0]?.pixelScale).toBe(1);

            yield* engine.captureStartDisplay({ enableMic: true });
            yield* engine.recordingStart({ trackInputEvents: true });
            const afterStart = yield* engine.captureStatus;
            expect(afterStart.isRunning).toBe(true);
            expect(afterStart.isRecording).toBe(true);

            const afterStop = yield* engine.recordingStop;
            expect(afterStop.isRecording).toBe(false);

            const exportInfo = yield* engine.exportInfo;
            const exportPreset = exportInfo.presets[0]!;
            const exportResult = yield* engine.exportRun({
              outputURL: outputUrlSchema.make(path.join(tempRoot, `${fixture.name}-e2e.mp4`)),
              presetId: exportPreset.id,
              trimStartSeconds: 0,
              trimEndSeconds: 3,
            });
            expect(exportResult.outputURL).toContain(`${fixture.name}-e2e.mp4`);

            const projectPath = projectPathSchema.make(
              path.join(tempRoot, `${fixture.name}.gglassproj`),
            );
            const opened = yield* engine.projectOpen({ projectPath });
            expect(opened.projectPath).toBe(projectPath);

            const saved = yield* engine.projectSave({
              projectPath,
              autoZoom: {
                isEnabled: true,
                intensity: 0.6,
                minimumKeyframeInterval: 0.25,
              },
            });
            expect(saved.autoZoom.intensity).toBe(0.6);
            const recents = yield* engine.projectRecents(5);
            expect(recents.items[0]?.projectPath).toBe(projectPath);

            const stopped = yield* engine.captureStop;
            expect(stopped.isRunning).toBe(false);
          }).pipe(
            Effect.provide(
              layerEngineClient({
                baseUrl: launched.baseUrl,
                bearerToken: launched.bearerToken,
              }).pipe(Layer.provide(FetchHttpClient.layer)),
            ),
            (effect) => Effect.runPromise(effect as Effect.Effect<void, unknown, never>),
          );
        } finally {
          launched?.process.kill();
          fs.rmSync(tempRoot, { force: true, recursive: true });
        }
      },
    );
  }
});
