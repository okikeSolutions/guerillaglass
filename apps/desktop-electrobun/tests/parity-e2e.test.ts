import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { Effect } from "effect";
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

const fixtures: EngineFixture[] = [
  {
    name: "windows-native",
    path: path.resolve(import.meta.dir, "../../../target/debug/guerillaglass-engine-windows"),
    expectedPlatform: "windows",
  },
  {
    name: "linux-native",
    path: path.resolve(import.meta.dir, "../../../target/debug/guerillaglass-engine-linux"),
    expectedPlatform: "linux",
  },
];

setDefaultTimeout(30_000);

function buildNativeEngine(manifestPath: string): void {
  const result = Bun.spawnSync({
    cmd: ["cargo", "build", "--manifest-path", manifestPath],
    stdout: "pipe",
    stderr: "pipe",
  });
  if (!result.success) {
    throw new Error(
      `Failed to build ${manifestPath}\n${new TextDecoder().decode(result.stderr)}`,
    );
  }
}

describe("engine HTTP parity e2e", () => {
  beforeAll(() => {
    buildNativeEngine(path.resolve(import.meta.dir, "../../../engines/windows-native/Cargo.toml"));
    buildNativeEngine(path.resolve(import.meta.dir, "../../../engines/linux-native/Cargo.toml"));
  });
  for (const fixture of fixtures) {
    test(
      `runs capture->record->export->project flow (${fixture.name})`,
      async () => {
        const tempRoot = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), `${fixture.name}-e2e-`));
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

          const projectPath = projectPathSchema.make(path.join(tempRoot, `${fixture.name}.gglassproj`));
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
              layerEngineClientBun({
                enginePath: fixture.path,
                env: { HOME: tempRoot, USERPROFILE: tempRoot },
              }),
            ),
            (effect) => Effect.runPromise(effect as Effect.Effect<void, unknown, never>),
          );
        } finally {
          fs.rmSync(tempRoot, { force: true, recursive: true });
        }
      },
      { timeout: 15_000 },
    );
  }
});
