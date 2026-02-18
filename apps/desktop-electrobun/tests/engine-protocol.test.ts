import { describe, expect, test } from "bun:test";
import {
  buildRequest,
  captureStatusResultSchema,
  engineRequestSchema,
  parseResponse,
  permissionsResultSchema,
  sourcesResultSchema,
} from "@guerillaglass/engine-protocol";

describe("engine protocol", () => {
  test("builds and validates a sources.list request", () => {
    const request = buildRequest("sources.list", {});
    const parsed = engineRequestSchema.parse(request);

    expect(parsed.method).toBe("sources.list");
    expect(parsed.id.length).toBeGreaterThan(0);
  });

  test("validates permissions and source payload shapes", () => {
    const permissions = permissionsResultSchema.parse({
      screenRecordingGranted: true,
      microphoneGranted: false,
      inputMonitoring: "notDetermined",
    });

    const sources = sourcesResultSchema.parse({
      displays: [{ id: 1, width: 3024, height: 1964 }],
      windows: [
        {
          id: 42,
          title: "Simulator",
          appName: "Xcode",
          width: 1280,
          height: 720,
          isOnScreen: true,
        },
      ],
    });

    const captureStatus = captureStatusResultSchema.parse({
      isRunning: false,
      isRecording: false,
      recordingDurationSeconds: 0,
      recordingURL: null,
      lastError: null,
    });

    expect(permissions.inputMonitoring).toBe("notDetermined");
    expect(sources.windows[0]?.appName).toBe("Xcode");
    expect(captureStatus.isRunning).toBe(false);
  });

  test("parses success and error response envelopes", () => {
    const success = parseResponse({
      id: "abc",
      ok: true,
      result: {
        healthy: true,
      },
    });

    const failure = parseResponse({
      id: "def",
      ok: false,
      error: {
        code: "runtime_error",
        message: "boom",
      },
    });

    expect(success.ok).toBe(true);
    expect(failure.ok).toBe(false);
  });
});
