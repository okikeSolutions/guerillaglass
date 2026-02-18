import path from "node:path";
import { describe, expect, test } from "bun:test";
import { EngineClient } from "../src/bun/engineClient";

type EngineFixture = {
  name: string;
  path: string;
  expectedPlatform: "windows" | "linux";
};

const fixtures: EngineFixture[] = [
  {
    name: "windows-stub",
    path: path.resolve(import.meta.dir, "../../../engines/windows-stub/guerillaglass-engine-windows-stub.ts"),
    expectedPlatform: "windows",
  },
  {
    name: "linux-stub",
    path: path.resolve(import.meta.dir, "../../../engines/linux-stub/guerillaglass-engine-linux-stub.ts"),
    expectedPlatform: "linux",
  },
];

describe("phase-1 parity e2e", () => {
  for (const fixture of fixtures) {
    test(`runs capture->record->export->project flow (${fixture.name})`, async () => {
      const client = new EngineClient(fixture.path, 2_000);
      try {
        const ping = await client.ping();
        expect(ping.platform).toBe(fixture.expectedPlatform);

        const sources = await client.listSources();
        expect(sources.displays.length).toBeGreaterThan(0);

        await client.startDisplayCapture(true);
        await client.startRecording(true);
        const afterStart = await client.captureStatus();
        expect(afterStart.isRunning).toBe(true);
        expect(afterStart.isRecording).toBe(true);

        const afterStop = await client.stopRecording();
        expect(afterStop.isRecording).toBe(false);

        const exportInfo = await client.exportInfo();
        const exportPreset = exportInfo.presets[0]!;
        const exportResult = await client.runExport({
          outputURL: `/tmp/${fixture.name}-e2e.mp4`,
          presetId: exportPreset.id,
          trimStartSeconds: 0,
          trimEndSeconds: 3,
        });
        expect(exportResult.outputURL).toContain(`${fixture.name}-e2e.mp4`);

        const projectPath = `/tmp/${fixture.name}.gglassproj`;
        const opened = await client.projectOpen(projectPath);
        expect(opened.projectPath).toBe(projectPath);

        const saved = await client.projectSave({
          projectPath,
          autoZoom: {
            isEnabled: true,
            intensity: 0.6,
            minimumKeyframeInterval: 0.25,
          },
        });
        expect(saved.autoZoom.intensity).toBe(0.6);

        const stopped = await client.stopCapture();
        expect(stopped.isRunning).toBe(false);
      } finally {
        await client.stop();
      }
    });
  }
});
