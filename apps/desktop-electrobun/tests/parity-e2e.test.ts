import path from "node:path";
import { describe, expect, setDefaultTimeout, test } from "bun:test";
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
    name: "windows-stub",
    path: path.resolve(
      import.meta.dir,
      "../../../engines/windows-stub/guerillaglass-engine-windows-stub.ts",
    ),
    expectedPlatform: "windows",
  },
  {
    name: "linux-stub",
    path: path.resolve(
      import.meta.dir,
      "../../../engines/linux-stub/guerillaglass-engine-linux-stub.ts",
    ),
    expectedPlatform: "linux",
  },
];

setDefaultTimeout(15_000);

describe.skip("engine HTTP parity e2e", () => {
  for (const fixture of fixtures) {
    test(
      `runs capture->record->export->project flow (${fixture.name})`,
      async () => {
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
            outputURL: outputUrlSchema.make(`/tmp/${fixture.name}-e2e.mp4`),
            presetId: exportPreset.id,
            trimStartSeconds: 0,
            trimEndSeconds: 3,
          });
          expect(exportResult.outputURL).toContain(`${fixture.name}-e2e.mp4`);

          const projectPath = projectPathSchema.make(`/tmp/${fixture.name}.gglassproj`);
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
          Effect.provide(layerEngineClientBun({ enginePath: fixture.path })),
          (effect) => Effect.runPromise(effect as Effect.Effect<void, unknown, never>),
        );
      },
      { timeout: 15_000 },
    );
  }
});
