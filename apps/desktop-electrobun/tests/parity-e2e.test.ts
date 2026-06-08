import path from "node:path";
import { describe, expect, setDefaultTimeout, test } from "bun:test";
import { Effect, Option } from "effect";
import { EngineTransport } from "@guerillaglass/engine/client/service";
import { makeLayerEngineTransportBun } from "@guerillaglass/engine/client/liveBun";
import {
  outputUrlSchema,
  projectPathSchema,
} from "@guerillaglass/engine/protocol/schema-primitives";

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

describe("phase-1 parity e2e", () => {
  for (const fixture of fixtures) {
    test(
      `runs capture->record->export->project flow (${fixture.name})`,
      async () => {
        await Effect.gen(function* () {
          const engine = yield* EngineTransport;
          const ping = yield* engine["system.ping"](undefined);
          expect(ping.platform).toBe(fixture.expectedPlatform);

          const capabilities = yield* engine["engine.capabilities"](undefined);
          expect(capabilities.platform).toBe(fixture.expectedPlatform);

          const sources = yield* engine["sources.list"](undefined);
          expect(sources.displays.length).toBeGreaterThan(0);
          expect(sources.displays[0]?.pixelScale).toBe(1);
          expect(sources.windows[0]?.pixelScale).toBe(1);

          yield* engine["capture.startDisplay"]({ enableMic: true });
          yield* engine["recording.start"]({ trackInputEvents: true });
          const afterStart = yield* engine["capture.status"](undefined);
          expect(afterStart.isRunning).toBe(true);
          expect(afterStart.isRecording).toBe(true);

          const afterStop = yield* engine["recording.stop"](undefined);
          expect(afterStop.isRecording).toBe(false);

          const exportInfo = yield* engine["export.info"](undefined);
          const exportPreset = exportInfo.presets[0]!;
          const exportResult = yield* engine["export.run"]({
            outputURL: outputUrlSchema.make(`/tmp/${fixture.name}-e2e.mp4`),
            presetId: exportPreset.id,
            trimStartSeconds: 0,
            trimEndSeconds: 3,
          });
          expect(exportResult.outputURL).toContain(`${fixture.name}-e2e.mp4`);

          const projectPath = projectPathSchema.make(`/tmp/${fixture.name}.gglassproj`);
          const opened = yield* engine["project.open"]({ projectPath });
          expect(Option.getOrNull(opened.projectPath)).toBe(projectPath);

          const saved = yield* engine["project.save"]({
            projectPath,
            autoZoom: {
              isEnabled: true,
              intensity: 0.6,
              minimumKeyframeInterval: 0.25,
            },
          });
          expect(saved.autoZoom.intensity).toBe(0.6);
          const recents = yield* engine["project.recents"]({ limit: 5 });
          expect(recents.items[0]?.projectPath).toBe(projectPath);

          const stopped = yield* engine["capture.stop"](undefined);
          expect(stopped.isRunning).toBe(false);
        }).pipe(
          Effect.provide(makeLayerEngineTransportBun({ enginePath: fixture.path })),
          (effect) => Effect.runPromise(effect as Effect.Effect<void, unknown, never>),
        );
      },
      { timeout: 15_000 },
    );
  }
});
