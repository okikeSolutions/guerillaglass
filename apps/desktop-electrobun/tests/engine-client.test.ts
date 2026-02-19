import path from "node:path";
import { describe, expect, test } from "bun:test";
import { EngineClient, resolveEnginePath } from "../src/bun/engineClient";

const BUN_BASE_DIR = path.resolve(import.meta.dir, "../src/bun");
const LINUX_STUB_PATH = path.resolve(
  import.meta.dir,
  "../../../engines/linux-stub/guerillaglass-engine-linux-stub.ts",
);
const HANGING_ENGINE_PATH = path.resolve(import.meta.dir, "fixtures/hanging-engine.ts");
const CRASHING_ENGINE_PATH = path.resolve(import.meta.dir, "fixtures/crashing-engine.ts");

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

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

    expect(windowsStub.endsWith("engines/windows-stub/guerillaglass-engine-windows-stub.ts")).toBe(
      true,
    );
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

    expect(winDefault.endsWith("engines/windows-stub/guerillaglass-engine-windows-stub.ts")).toBe(
      true,
    );
    expect(linuxDefault.endsWith("engines/linux-stub/guerillaglass-engine-linux-stub.ts")).toBe(
      true,
    );
  });

  test("resolves macOS native engine from workspace root when running from app bundle path", () => {
    const bundledBaseDir = path.resolve(
      import.meta.dir,
      "../build/dev-macos-arm64/Guerillaglass-dev.app/Contents/Resources/app/bun",
    );
    const resolved = resolveEnginePath({
      env: {},
      platform: "darwin",
      baseDir: bundledBaseDir,
    });

    expect(resolved.endsWith(".build/debug/guerillaglass-engine")).toBe(true);
  });
});

describe("engine client integration", () => {
  test("executes a phase-1 parity flow against the stub engine", async () => {
    const client = new EngineClient(LINUX_STUB_PATH, 2000);
    try {
      const ping = await client.ping();
      expect(ping.platform).toBe("linux");

      const capabilities = await client.capabilities();
      expect(capabilities.phase).toBe("stub");

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

describe("engine client resilience", () => {
  async function captureError<T>(operation: Promise<T>): Promise<Error> {
    try {
      await operation;
      throw new Error("Expected operation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      return error as Error;
    }
  }

  test("applies method-specific timeout overrides", async () => {
    const client = new EngineClient(HANGING_ENGINE_PATH, 5_000, {
      requestTimeoutByMethod: {
        "system.ping": 75,
      },
    });
    const startedAt = Date.now();

    try {
      const error = await captureError(client.ping());
      expect(error.message).toContain("Engine request timed out: system.ping");
      const elapsed = Date.now() - startedAt;
      expect(elapsed).toBeGreaterThanOrEqual(50);
      expect(elapsed).toBeLessThan(1_000);
    } finally {
      await client.stop();
    }
  });

  test("uses per-method timeout policy for long-running export.run", async () => {
    const client = new EngineClient(HANGING_ENGINE_PATH, 50, {
      requestTimeoutByMethod: {
        "export.run": 225,
      },
    });
    const startedAt = Date.now();

    try {
      const error = await captureError(
        client.runExport({
          outputURL: "/tmp/guerillaglass-export.mp4",
          presetId: "preset",
        }),
      );
      expect(error.message).toContain("Engine request timed out: export.run");
      const elapsed = Date.now() - startedAt;
      expect(elapsed).toBeGreaterThanOrEqual(175);
      expect(elapsed).toBeLessThan(2_000);
    } finally {
      await client.stop();
    }
  });

  test("does not apply a default timeout to export.run", async () => {
    const client = new EngineClient(HANGING_ENGINE_PATH, 50);

    try {
      const exportOutcome = await Promise.race([
        client
          .runExport({
            outputURL: "/tmp/guerillaglass-export.mp4",
            presetId: "preset",
          })
          .then(() => "resolved")
          .catch((error: Error) => `rejected:${error.message}`),
        wait(200).then(() => "pending"),
      ]);
      expect(exportOutcome).toBe("pending");
    } finally {
      await client.stop();
    }
  });

  test("fails pending requests quickly when engine exits", async () => {
    const client = new EngineClient(CRASHING_ENGINE_PATH, 5_000);
    const startedAt = Date.now();

    try {
      const error = await captureError(client.ping());
      expect(error.message).toContain("Engine process exited unexpectedly");
      const elapsed = Date.now() - startedAt;
      expect(elapsed).toBeLessThan(1_000);
    } finally {
      await client.stop();
    }
  });

  test("opens restart circuit after repeated crash loops", async () => {
    const client = new EngineClient(CRASHING_ENGINE_PATH, 5_000, {
      maxRetryAttempts: 1,
      restartBackoffMs: 0,
      restartJitterMs: 0,
      maxRestartAttemptsInWindow: 1,
      restartWindowMs: 10_000,
      restartCircuitOpenMs: 10_000,
    });

    try {
      const error = await captureError(client.ping());
      expect(error.message).toContain("Engine restart circuit open until");
    } finally {
      await client.stop();
    }
  });
});
