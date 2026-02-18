import { beforeEach, describe, expect, test } from "bun:test";
import { engineApi } from "../src/mainview/lib/engine";

beforeEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe("renderer engine bridge", () => {
  test("throws a clear error when bridge is missing", async () => {
    (globalThis as { window: unknown }).window = {};
    await expect(engineApi.ping()).rejects.toThrow("Missing Electrobun bridge");
  });

  test("parses a valid ping payload", async () => {
    (globalThis as { window: Record<string, unknown> }).window = {
      ggEnginePing: async () => ({
        app: "guerillaglass",
        engineVersion: "0.1.0",
        protocolVersion: "1",
        platform: "macOS",
      }),
    };

    const ping = await engineApi.ping();
    expect(ping.app).toBe("guerillaglass");
  });

  test("parses permissions, sources, and capture status payloads", async () => {
    (globalThis as { window: Record<string, unknown> }).window = {
      ggEngineGetPermissions: async () => ({
        screenRecordingGranted: true,
        microphoneGranted: false,
        inputMonitoring: "authorized",
      }),
      ggEngineListSources: async () => ({
        displays: [{ id: 1, width: 3024, height: 1964 }],
        windows: [
          {
            id: 12,
            title: "Demo",
            appName: "Xcode",
            width: 800,
            height: 600,
            isOnScreen: true,
          },
        ],
      }),
      ggEngineCaptureStatus: async () => ({
        isRunning: false,
        isRecording: false,
        recordingDurationSeconds: 0,
        recordingURL: null,
        lastError: null,
      }),
    };

    const permissions = await engineApi.getPermissions();
    const sources = await engineApi.listSources();
    const capture = await engineApi.captureStatus();

    expect(permissions.inputMonitoring).toBe("authorized");
    expect(sources.displays.length).toBe(1);
    expect(capture.recordingURL).toBeNull();
  });
});
