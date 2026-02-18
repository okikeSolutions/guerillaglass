import path from "node:path";
import { describe, expect, test } from "bun:test";
import { EngineClient, resolveEnginePath } from "../src/bun/engineClient";

const BUN_BASE_DIR = path.resolve(import.meta.dir, "../src/bun");
const LINUX_STUB_PATH = path.resolve(
  import.meta.dir,
  "../../../engines/linux-stub/guerillaglass-engine-linux-stub.ts",
);

describe("engine client path resolution", () => {
  test("honors GG_ENGINE_PATH override", () => {
    const explicit = "/tmp/custom-engine";
    const resolved = resolveEnginePath({
      env: { GG_ENGINE_PATH: explicit },
      platform: "darwin",
      baseDir: BUN_BASE_DIR,
    });
    expect(resolved).toBe(explicit);
  });

  test("resolves stub/native targets from GG_ENGINE_TARGET", () => {
    const windowsStub = resolveEnginePath({
      env: { GG_ENGINE_TARGET: "windows-stub" },
      platform: "darwin",
      baseDir: BUN_BASE_DIR,
    });
    const linuxNative = resolveEnginePath({
      env: { GG_ENGINE_TARGET: "linux-native" },
      platform: "darwin",
      baseDir: BUN_BASE_DIR,
    });

    expect(windowsStub.endsWith("engines/windows-stub/guerillaglass-engine-windows-stub.ts")).toBe(true);
    expect(linuxNative.endsWith("engines/linux-native/bin/guerillaglass-engine-linux")).toBe(true);
  });

  test("falls back to stubs on non-mac platforms when native binary is absent", () => {
    const winDefault = resolveEnginePath({
      env: {},
      platform: "win32",
      baseDir: BUN_BASE_DIR,
    });
    const linuxDefault = resolveEnginePath({
      env: {},
      platform: "linux",
      baseDir: BUN_BASE_DIR,
    });

    expect(winDefault.endsWith("engines/windows-stub/guerillaglass-engine-windows-stub.ts")).toBe(true);
    expect(linuxDefault.endsWith("engines/linux-stub/guerillaglass-engine-linux-stub.ts")).toBe(true);
  });
});

describe("engine client integration", () => {
  test("executes a phase-1 parity flow against the stub engine", async () => {
    const client = new EngineClient(LINUX_STUB_PATH, 2_000);
    try {
      const ping = await client.ping();
      expect(ping.platform).toBe("linux");

      const permissions = await client.getPermissions();
      expect(permissions.screenRecordingGranted).toBe(true);

      const sources = await client.listSources();
      expect(sources.displays.length).toBeGreaterThan(0);

      const preview = await client.startDisplayCapture(false);
      expect(preview.isRunning).toBe(true);

      const recording = await client.startRecording(true);
      expect(recording.isRecording).toBe(true);

      const stopped = await client.stopRecording();
      expect(stopped.isRecording).toBe(false);

      const exportInfo = await client.exportInfo();
      expect(exportInfo.presets.length).toBeGreaterThan(0);

      const exportResult = await client.runExport({
        outputURL: "/tmp/guerillaglass-parity-out.mp4",
        presetId: exportInfo.presets[0]!.id,
      });
      expect(exportResult.outputURL).toContain("parity-out.mp4");

      const opened = await client.projectOpen("/tmp/guerillaglass-project.gglassproj");
      expect(opened.projectPath).toContain("guerillaglass-project.gglassproj");

      const saved = await client.projectSave({
        projectPath: "/tmp/guerillaglass-project.gglassproj",
      });
      expect(saved.projectPath).toContain("guerillaglass-project.gglassproj");

      const halted = await client.stopCapture();
      expect(halted.isRunning).toBe(false);
    } finally {
      await client.stop();
    }
  });
});
