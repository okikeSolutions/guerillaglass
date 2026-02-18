import { describe, expect, test } from "bun:test";
import {
  buildRequest,
  captureStatusResultSchema,
  engineRequestSchema,
  exportInfoResultSchema,
  parseResponse,
  permissionsResultSchema,
  projectStateSchema,
  sourcesResultSchema,
} from "@guerillaglass/engine-protocol";

describe("engine protocol", () => {
  test("builds and validates parity method requests", () => {
    const startRecordingRequest = buildRequest("recording.start", { trackInputEvents: true });
    const saveProjectRequest = buildRequest("project.save", {
      projectPath: "/tmp/test.gglassproj",
      autoZoom: {
        isEnabled: true,
        intensity: 0.8,
        minimumKeyframeInterval: 1 / 30,
      },
    });

    expect(engineRequestSchema.parse(startRecordingRequest).method).toBe("recording.start");
    expect(engineRequestSchema.parse(saveProjectRequest).method).toBe("project.save");
  });

  test("validates critical result payloads", () => {
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
      eventsURL: null,
    });

    const exportInfo = exportInfoResultSchema.parse({
      presets: [
        {
          id: "h264-1080p-30",
          name: "1080p 30fps",
          width: 1920,
          height: 1080,
          fps: 30,
          fileType: "mp4",
        },
      ],
    });

    const projectState = projectStateSchema.parse({
      projectPath: "/tmp/project.gglassproj",
      recordingURL: "/tmp/project.gglassproj/recording.mov",
      eventsURL: null,
      autoZoom: {
        isEnabled: true,
        intensity: 1,
        minimumKeyframeInterval: 1 / 30,
      },
      captureMetadata: null,
    });

    expect(permissions.inputMonitoring).toBe("notDetermined");
    expect(sources.windows[0]?.appName).toBe("Xcode");
    expect(captureStatus.eventsURL).toBeNull();
    expect(exportInfo.presets.length).toBe(1);
    expect(projectState.projectPath).toContain("project.gglassproj");
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
