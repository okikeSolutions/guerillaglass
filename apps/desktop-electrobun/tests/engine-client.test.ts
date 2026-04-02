import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { describe, expect, test } from "bun:test";
import { EngineClient, resolveEnginePath } from "../src/bun/engine/client";
import {
  ContractDecodeError,
  EngineRequestValidationError,
  EngineResponseError,
  JsonParseError,
} from "@shared/errors";

const BUN_BASE_DIR = path.resolve(import.meta.dir, "../src/bun");
const LINUX_STUB_PATH = path.resolve(
  import.meta.dir,
  "../../../engines/linux-stub/guerillaglass-engine-linux-stub.ts",
);
const WINDOWS_STUB_PATH = path.resolve(
  import.meta.dir,
  "../../../engines/windows-stub/guerillaglass-engine-windows-stub.ts",
);
const HANGING_ENGINE_PATH = path.resolve(import.meta.dir, "fixtures/hanging-engine.ts");
const CRASHING_ENGINE_PATH = path.resolve(import.meta.dir, "fixtures/crashing-engine.ts");
const INVALID_JSON_RESPONSE_ENGINE_PATH = path.resolve(
  import.meta.dir,
  "fixtures/invalid-json-response-engine.ts",
);
const INVALID_ENVELOPE_RESPONSE_ENGINE_PATH = path.resolve(
  import.meta.dir,
  "fixtures/invalid-envelope-response-engine.ts",
);
const DROPPED_STOP_RESPONSE_ENGINE_PATH = path.resolve(
  import.meta.dir,
  "fixtures/dropped-stop-response-engine.ts",
);
const ACTIVE_RECORDING_STOP_TIMEOUT_ENGINE_PATH = path.resolve(
  import.meta.dir,
  "fixtures/active-recording-stop-timeout-engine.ts",
);
const UNKNOWN_STOP_STATE_TIMEOUT_ENGINE_PATH = path.resolve(
  import.meta.dir,
  "fixtures/unknown-stop-state-timeout-engine.ts",
);
const SLOW_SHUTDOWN_TIMEOUT_ENGINE_PATH = path.resolve(
  import.meta.dir,
  "fixtures/slow-shutdown-timeout-engine.ts",
);
const STUBBORN_SHUTDOWN_TIMEOUT_ENGINE_PATH = path.resolve(
  import.meta.dir,
  "fixtures/stubborn-shutdown-timeout-engine.ts",
);
const INTEGRATION_STUB_PATH = process.platform === "win32" ? WINDOWS_STUB_PATH : LINUX_STUB_PATH;
const INTEGRATION_STUB_PLATFORM = process.platform === "win32" ? "windows" : "linux";
const POSIX_SIGNAL_SHUTDOWN_TEST = process.platform === "win32" ? test.skip : test;
const INTEGRATION_TEMP_DIRECTORY = os.tmpdir();
const SLOW_SHUTDOWN_LOCK_PATH = path.join(
  INTEGRATION_TEMP_DIRECTORY,
  "guerillaglass-slow-shutdown.lock",
);
const SLOW_SHUTDOWN_STATE_PATH = path.join(
  INTEGRATION_TEMP_DIRECTORY,
  "guerillaglass-slow-shutdown.state",
);
const STUBBORN_SHUTDOWN_STATE_PATH = path.join(
  INTEGRATION_TEMP_DIRECTORY,
  "guerillaglass-stubborn-shutdown.state",
);

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function endsWithPathSegments(value: string, segments: string[]): boolean {
  const normalizedValue = path.normalize(value);
  const normalizedSuffix = path.normalize(path.join(...segments));
  return normalizedValue.endsWith(normalizedSuffix);
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

    expect(
      endsWithPathSegments(windowsStub, [
        "engines",
        "windows-stub",
        "guerillaglass-engine-windows-stub.ts",
      ]),
    ).toBe(true);
    expect(
      endsWithPathSegments(linuxNative, [
        "engines",
        "linux-native",
        "bin",
        "guerillaglass-engine-linux",
      ]),
    ).toBe(true);
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

    expect(
      endsWithPathSegments(winDefault, [
        "engines",
        "windows-stub",
        "guerillaglass-engine-windows-stub.ts",
      ]),
    ).toBe(true);
    expect(
      endsWithPathSegments(linuxDefault, [
        "engines",
        "linux-stub",
        "guerillaglass-engine-linux-stub.ts",
      ]),
    ).toBe(true);
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

    expect(endsWithPathSegments(resolved, [".build", "debug", "guerillaglass-engine"])).toBe(true);
  });
});

describe("engine client integration", () => {
  test.skip("executes a phase-1 parity flow against the stub engine", async () => {
    // TODO: Re-enable once the generic stub flow stops timing out intermittently in CI.
    const client = new EngineClient(INTEGRATION_STUB_PATH, 2000);
    const exportPath = path.join(INTEGRATION_TEMP_DIRECTORY, "guerillaglass-parity-out.mp4");
    const projectPath = path.join(INTEGRATION_TEMP_DIRECTORY, "guerillaglass-project.gglassproj");
    try {
      const ping = await client.ping();
      expect(ping.platform).toBe(INTEGRATION_STUB_PLATFORM);

      const capabilities = await client.capabilities();
      expect(capabilities.phase).toBe("stub");

      const permissions = await client.getPermissions();
      expect(permissions.screenRecordingGranted).toBe(true);

      const sources = await client.listSources();
      expect(sources.displays.length).toBeGreaterThan(0);
      expect(sources.displays[0]?.supportedCaptureFrameRates).toEqual([24, 30, 60]);

      await expect(client.startDisplayCapture(false, 120)).rejects.toThrow(
        "Supported values: 24, 30, 60",
      );
      await expect(client.startCurrentWindowCapture(false)).resolves.toMatchObject({
        isRunning: true,
      });

      const recording = await client.startRecording(true);
      expect(recording.isRecording).toBe(true);

      const stopped = await client.stopRecording();
      expect(stopped.isRecording).toBe(false);

      const exportInfo = await client.exportInfo();
      expect(exportInfo.presets.length).toBeGreaterThan(0);

      const exportResult = await client.runExport({
        outputURL: exportPath,
        presetId: exportInfo.presets[0]!.id,
      });
      expect(exportResult.outputURL).toContain("parity-out.mp4");

      const opened = await client.projectOpen(projectPath);
      expect(opened.projectPath).toContain("guerillaglass-project.gglassproj");

      const saved = await client.projectSave({
        projectPath,
      });
      expect(saved.projectPath).toContain("guerillaglass-project.gglassproj");
      const recents = await client.projectRecents(5);
      expect(recents.items[0]?.projectPath).toContain("guerillaglass-project.gglassproj");

      const halted = await client.stopCapture();
      expect(halted.isRunning).toBe(false);
    } finally {
      await client.stop();
    }
  }, 15_000);

  test("exercises stub-backed agent, permission, export, and project wrappers", async () => {
    const workspaceDir = fs.mkdtempSync(
      path.join(INTEGRATION_TEMP_DIRECTORY, "guerillaglass-engine-client-"),
    );
    const transcriptPath = path.join(workspaceDir, "imported-transcript.json");
    const projectPath = path.join(workspaceDir, "guerillaglass-project.gglassproj");
    const outputPath = path.join(workspaceDir, "guerillaglass-cut-plan.mp4");
    const client = new EngineClient(INTEGRATION_STUB_PATH, 2000);

    fs.writeFileSync(
      transcriptPath,
      JSON.stringify({
        segments: [
          {
            text: "hook action payoff takeaway",
            startSeconds: 0,
            endSeconds: 4,
          },
        ],
        words: [],
      }),
      "utf8",
    );

    try {
      await client.start();

      await expect(client.requestScreenRecordingPermission()).resolves.toMatchObject({
        success: true,
      });
      await expect(client.requestMicrophonePermission()).resolves.toMatchObject({
        success: true,
      });
      await expect(client.requestInputMonitoringPermission()).resolves.toMatchObject({
        success: true,
      });
      await expect(client.openInputMonitoringSettings()).resolves.toMatchObject({
        success: true,
      });

      const opened = await client.projectOpen(projectPath);
      expect(opened.projectPath).toBe(projectPath);

      const started = await client.startCurrentWindowCapture(false);
      expect(started.isRunning).toBe(true);

      const recording = await client.startRecording(false);
      expect(recording.isRecording).toBe(true);

      const stoppedRecording = await client.stopRecording();
      expect(stoppedRecording.isRecording).toBe(false);

      const current = await client.projectCurrent();
      expect(current.projectPath).toBe(projectPath);
      expect(current.recordingURL).toBe("stub://recordings/session.mp4");

      const saved = await client.projectSave({
        projectPath,
        autoZoom: {
          isEnabled: true,
          intensity: 0.7,
          minimumKeyframeInterval: 0.25,
        },
      });
      expect(saved.autoZoom).toMatchObject({
        isEnabled: true,
        intensity: 0.7,
        minimumKeyframeInterval: 0.25,
      });

      const recents = await client.projectRecents(1);
      expect(recents.items).toHaveLength(1);
      expect(recents.items[0]?.projectPath).toBe(projectPath);

      const preflight = await client.agentPreflight({
        runtimeBudgetMinutes: 10,
        transcriptionProvider: "imported_transcript",
        importedTranscriptPath: transcriptPath,
      });
      expect(preflight.ready).toBe(true);
      expect(preflight.preflightToken).toBeTruthy();

      const run = await client.agentRun({
        preflightToken: preflight.preflightToken!,
        runtimeBudgetMinutes: 10,
        transcriptionProvider: "imported_transcript",
        importedTranscriptPath: transcriptPath,
      });
      expect(run.status).toBe("completed");

      const status = await client.agentStatus(run.jobId);
      expect(status.status).toBe("completed");
      expect(status.qaReport?.passed).toBe(true);

      await expect(client.agentApply({ jobId: run.jobId })).rejects.toThrow("needs_confirmation");

      const applied = await client.agentApply({
        jobId: run.jobId,
        destructiveIntent: true,
      });
      expect(applied).toMatchObject({
        success: true,
      });

      const exportResult = await client.runCutPlanExport({
        outputURL: outputPath,
        presetId: "stub-1080p30",
        jobId: run.jobId,
      });
      expect(exportResult).toMatchObject({
        outputURL: outputPath,
        appliedSegments: 4,
      });

      const stoppedCapture = await client.stopCapture();
      expect(stoppedCapture.isRunning).toBe(false);
    } finally {
      await client.stop();
      fs.rmSync(workspaceDir, { recursive: true, force: true });
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

  test("recovers stopCapture when a stop response is dropped", async () => {
    const client = new EngineClient(DROPPED_STOP_RESPONSE_ENGINE_PATH, 5000, {
      requestTimeoutByMethod: {
        "capture.stop": 100,
      },
    });
    const startedAt = Date.now();

    try {
      const started = await client.startCurrentWindowCapture(false);
      expect(started.isRunning).toBe(true);

      const stopped = await client.stopCapture();
      expect(stopped.isRunning).toBe(false);

      const elapsed = Date.now() - startedAt;
      expect(elapsed).toBeLessThan(2000);
    } finally {
      await client.stop();
    }
  });

  test("surfaces recording_abandoned when stopCapture times out during active recording", async () => {
    const client = new EngineClient(ACTIVE_RECORDING_STOP_TIMEOUT_ENGINE_PATH, 5000, {
      requestTimeoutByMethod: {
        "capture.stop": 100,
      },
    });

    try {
      const started = await client.startCurrentWindowCapture(false);
      expect(started.isRunning).toBe(true);

      const recording = await client.startRecording(true);
      expect(recording.isRecording).toBe(true);

      await expect(client.stopCapture()).rejects.toThrow("recording_abandoned");

      const status = await client.captureStatus();
      expect(status.isRunning).toBe(true);
      expect(status.isRecording).toBe(true);
    } finally {
      await client.stop();
    }
  });

  test("does not restart the engine when stopCapture timeout leaves recording state unknown", async () => {
    const client = new EngineClient(UNKNOWN_STOP_STATE_TIMEOUT_ENGINE_PATH, 5000, {
      requestTimeoutByMethod: {
        "capture.stop": 100,
        "capture.status": 100,
      },
    });

    try {
      const started = await client.startCurrentWindowCapture(false);
      expect(started.isRunning).toBe(true);

      await expect(client.stopCapture()).rejects.toThrow(
        "capture.stop recovery aborted: capture.status probe timed out and recording state is unknown",
      );
    } finally {
      await client.stop();
    }
  });

  test("applies method-specific timeout overrides", async () => {
    const client = new EngineClient(HANGING_ENGINE_PATH, 5000, {
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
      expect(elapsed).toBeLessThan(1000);
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
      expect(elapsed).toBeLessThan(2000);
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

  test("does not apply a default timeout to capture.startWindow", async () => {
    const client = new EngineClient(HANGING_ENGINE_PATH, 50);

    try {
      const captureOutcome = await Promise.race([
        client
          .startWindowCapture(0, false)
          .then(() => "resolved")
          .catch((error: Error) => `rejected:${error.message}`),
        wait(200).then(() => "pending"),
      ]);
      expect(captureOutcome).toBe("pending");
    } finally {
      await client.stop();
    }
  });

  test("fails pending requests quickly when engine exits", async () => {
    const client = new EngineClient(CRASHING_ENGINE_PATH, 5000);
    const startedAt = Date.now();

    try {
      const error = await captureError(client.ping());
      expect(error.message).toContain("Engine process exited unexpectedly");
      const elapsed = Date.now() - startedAt;
      expect(elapsed).toBeLessThan(1000);
    } finally {
      await client.stop();
    }
  });

  test("fails pending requests immediately when engine emits invalid JSON on stdout", async () => {
    const client = new EngineClient(INVALID_JSON_RESPONSE_ENGINE_PATH, 5000);
    const startedAt = Date.now();

    try {
      const error = await captureError(client.ping());
      expect(error).toBeInstanceOf(JsonParseError);
      expect(error.message).toBe("Invalid engine response JSON.");
      expect(Date.now() - startedAt).toBeLessThan(1000);
    } finally {
      await client.stop();
    }
  });

  test("fails the matching pending request when engine emits an invalid response envelope", async () => {
    const client = new EngineClient(INVALID_ENVELOPE_RESPONSE_ENGINE_PATH, 5000);
    const startedAt = Date.now();

    try {
      const error = await captureError(client.ping());
      expect(error).toBeInstanceOf(ContractDecodeError);
      expect(error.message).toContain("Invalid engine response payload");
      expect(Date.now() - startedAt).toBeLessThan(1000);
    } finally {
      await client.stop();
    }
  });

  test("opens restart circuit after repeated crash loops", async () => {
    const client = new EngineClient(CRASHING_ENGINE_PATH, 5000, {
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

  POSIX_SIGNAL_SHUTDOWN_TEST(
    "allows a brief graceful shutdown before retrying a timed-out read",
    async () => {
      try {
        fs.rmSync(SLOW_SHUTDOWN_LOCK_PATH, { force: true });
        fs.rmSync(SLOW_SHUTDOWN_STATE_PATH, { force: true });

        const startedAt = Date.now();
        const client = new EngineClient(SLOW_SHUTDOWN_TIMEOUT_ENGINE_PATH, 5000, {
          requestTimeoutByMethod: {
            "system.ping": 50,
          },
          restartBackoffMs: 0,
          restartJitterMs: 0,
        });

        try {
          const ping = await client.ping();
          expect(ping.platform).toBe("linux");
          const elapsed = Date.now() - startedAt;
          expect(elapsed).toBeGreaterThanOrEqual(150);
          expect(elapsed).toBeLessThan(1000);
        } finally {
          await client.stop();
        }
      } finally {
        fs.rmSync(SLOW_SHUTDOWN_LOCK_PATH, { force: true });
        fs.rmSync(SLOW_SHUTDOWN_STATE_PATH, { force: true });
      }
    },
  );

  POSIX_SIGNAL_SHUTDOWN_TEST(
    "does not hang retrying a timed-out read when shutdown stalls",
    async () => {
      try {
        fs.rmSync(STUBBORN_SHUTDOWN_STATE_PATH, { force: true });

        const startedAt = Date.now();
        const client = new EngineClient(STUBBORN_SHUTDOWN_TIMEOUT_ENGINE_PATH, 5000, {
          requestTimeoutByMethod: {
            "system.ping": 50,
          },
          restartBackoffMs: 0,
          restartJitterMs: 0,
        });

        try {
          const ping = await client.ping();
          expect(ping.platform).toBe("linux");
          expect(Date.now() - startedAt).toBeLessThan(3000);
          const shutdownState = fs.readFileSync(STUBBORN_SHUTDOWN_STATE_PATH, "utf8");
          expect(shutdownState).toContain("timed-out");
          expect(shutdownState).toContain("sigterm");
          expect(shutdownState).not.toContain("exit");
        } finally {
          await client.stop();
        }
      } finally {
        fs.rmSync(STUBBORN_SHUTDOWN_STATE_PATH, { force: true });
      }
    },
  );

  test("reacquires a scoped engine session after explicit stop", async () => {
    const client = new EngineClient(INTEGRATION_STUB_PATH, 2000);

    try {
      const first = await client.ping();
      expect(first.platform).toBe(INTEGRATION_STUB_PLATFORM);

      await client.stop();

      const second = await client.ping();
      expect(second.platform).toBe(INTEGRATION_STUB_PLATFORM);
    } finally {
      await client.stop();
    }
  });
});

describe("engine client validation", () => {
  async function captureError<T>(operation: Promise<T>): Promise<Error> {
    try {
      await operation;
      throw new Error("Expected operation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      return error as Error;
    }
  }

  test("normalizes typed request validation errors to invalid_params", async () => {
    const client = new EngineClient(LINUX_STUB_PATH, 2000);
    try {
      const error = await captureError(
        client.agentRun({
          preflightToken: "",
          runtimeBudgetMinutes: 10,
          transcriptionProvider: "imported_transcript",
          importedTranscriptPath: "/tmp/example.json",
        }),
      );
      expect(error).toBeInstanceOf(EngineRequestValidationError);
      expect(error.message).toContain("invalid_params: agent.run request validation failed");
      expect(error.message).toContain("Call agent.preflight first");
      expect(error.message).toContain("params.preflightToken");
    } finally {
      await client.stop();
    }
  });

  test("sendRaw surfaces engine-originated invalid_params responses", async () => {
    const client = new EngineClient(LINUX_STUB_PATH, 2000);
    try {
      const error = await captureError(client.sendRaw("agent.run", {}));
      expect(error).toBeInstanceOf(EngineResponseError);
      expect(error.message).toContain(
        "invalid_params: agent.preflight must be called first. preflightToken is required.",
      );
    } finally {
      await client.stop();
    }
  });

  test("sendRaw is disabled in production unless explicitly allowed", async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousRawAllow = process.env.GG_ENGINE_ALLOW_RAW_RPC;
    process.env.NODE_ENV = "production";
    delete process.env.GG_ENGINE_ALLOW_RAW_RPC;
    const client = new EngineClient(LINUX_STUB_PATH, 2000);
    try {
      const error = await captureError(client.sendRaw("system.ping", {}));
      expect(error).toBeInstanceOf(EngineResponseError);
      expect(error.message).toContain("permission_denied: sendRaw is disabled in production");
    } finally {
      if (previousNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = previousNodeEnv;
      }
      if (previousRawAllow === undefined) {
        delete process.env.GG_ENGINE_ALLOW_RAW_RPC;
      } else {
        process.env.GG_ENGINE_ALLOW_RAW_RPC = previousRawAllow;
      }
      await client.stop();
    }
  });
});
