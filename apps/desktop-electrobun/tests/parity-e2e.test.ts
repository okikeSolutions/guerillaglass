import * as NodeServices from "@effect/platform-node/NodeServices";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, test } from "vitest";
import { Effect, Stream } from "effect";
import * as ChildProcess from "effect/unstable/process/ChildProcess";
import { EngineClient, layerEngineClientBun } from "@guerillaglass/engine-client/service";
import {
  outputUrlSchema,
  projectPathSchema,
} from "@guerillaglass/engine-contract/schema-primitives";

type EngineFixture = {
  name: string;
  path: string;
  expectedPlatform: "windows" | "linux";
};

const nativeEngineBuildTimeoutMs = 600_000;
const executableExtension = process.platform === "win32" ? ".exe" : "";

const fixtures: EngineFixture[] = [
  {
    name: "windows-native",
    path: path.resolve(
      import.meta.dirname,
      `../../../target/debug/guerillaglass-engine-windows${executableExtension}`,
    ),
    expectedPlatform: "windows",
  },
  {
    name: "linux-native",
    path: path.resolve(
      import.meta.dirname,
      `../../../target/debug/guerillaglass-engine-linux${executableExtension}`,
    ),
    expectedPlatform: "linux",
  },
];

async function buildNativeEngine(manifestPath: string): Promise<void> {
  const result = await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const handle = yield* ChildProcess.make(
          "cargo",
          ["build", "--manifest-path", manifestPath],
          {
            stdin: "ignore",
            stdout: "pipe",
            stderr: "pipe",
          },
        );
        const stderr = yield* handle.stderr.pipe(
          Stream.decodeText(),
          Stream.runFold(
            () => "",
            (accumulator, chunk) => accumulator + chunk,
          ),
        );
        return yield* handle.exitCode.pipe(Effect.map((exitCode) => ({ exitCode, stderr })));
      }),
    ).pipe(Effect.provide(NodeServices.layer)),
  );
  if (result.exitCode !== 0) {
    throw new Error(`Failed to build ${manifestPath}\n${result.stderr}`);
  }
}

describe("engine HTTP parity e2e", () => {
  beforeAll(async () => {
    await buildNativeEngine(
      path.resolve(import.meta.dirname, "../../../engines/windows-native/Cargo.toml"),
    );
    await buildNativeEngine(
      path.resolve(import.meta.dirname, "../../../engines/linux-native/Cargo.toml"),
    );
  }, nativeEngineBuildTimeoutMs);
  for (const fixture of fixtures) {
    test(
      `runs capture->record->export->project flow (${fixture.name})`,
      { timeout: 30_000 },
      async () => {
        const tempRoot = fs.mkdtempSync(
          path.join(fs.realpathSync(os.tmpdir()), `${fixture.name}-e2e-`),
        );
        try {
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
              backgroundFraming: {
                version: 1,
                enabled: true,
                backgroundColor: "#a1b2c3",
                paddingFraction: 0.12,
                cornerRadiusFraction: 0.05,
                shadowStrength: 0.7,
              },
            });
            expect(saved.autoZoom.intensity).toBe(0.6);
            expect(saved.backgroundFraming.backgroundColor).toBe("#A1B2C3");
            const reopened = yield* engine.projectOpen({ projectPath });
            expect(reopened.backgroundFraming).toEqual(saved.backgroundFraming);
            const recents = yield* engine.projectRecents(5);
            expect(recents.items[0]?.projectPath).toBe(projectPath);

            const stopped = yield* engine.captureStop;
            expect(stopped.isRunning).toBe(false);
          }).pipe(
            Effect.provide(
              layerEngineClientBun({
                enginePath: fixture.path,
                env: {
                  HOME: tempRoot,
                  USERPROFILE: tempRoot,
                },
              }),
            ),
            Effect.scoped,
            (effect) => Effect.runPromise(effect as Effect.Effect<void, unknown, never>),
          );
        } finally {
          fs.rmSync(tempRoot, { force: true, recursive: true });
        }
      },
    );
  }
});
