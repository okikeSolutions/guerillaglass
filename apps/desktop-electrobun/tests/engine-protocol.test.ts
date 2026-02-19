import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "bun:test";
import {
  buildRequest,
  capabilitiesResultSchema,
  captureStatusResultSchema,
  engineRequestSchema,
  exportInfoResultSchema,
  parseResponse,
  permissionsResultSchema,
  projectRecentsResultSchema,
  projectStateSchema,
  sourcesResultSchema,
} from "@guerillaglass/engine-protocol";

describe("engine protocol", () => {
  test("parses shared contract fixtures", () => {
    const fixtureDir = path.resolve(import.meta.dir, "../../../packages/engine-protocol/fixtures");
    const capabilitiesRaw = fs.readFileSync(
      path.join(fixtureDir, "engine-capabilities.request.json"),
      "utf8",
    );
    const saveRaw = fs.readFileSync(path.join(fixtureDir, "project-save.request.json"), "utf8");
    const recentsRaw = fs.readFileSync(
      path.join(fixtureDir, "project-recents.request.json"),
      "utf8",
    );

    const capabilitiesRequest = JSON.parse(capabilitiesRaw);
    const saveRequest = JSON.parse(saveRaw);
    const recentsRequest = JSON.parse(recentsRaw);

    expect(engineRequestSchema.parse(capabilitiesRequest).method).toBe("engine.capabilities");
    expect(engineRequestSchema.parse(saveRequest).method).toBe("project.save");
    expect(engineRequestSchema.parse(recentsRequest).method).toBe("project.recents");
  });

  test("builds and validates parity method requests", () => {
    const capabilitiesRequest = buildRequest("engine.capabilities", {});
    const startRecordingRequest = buildRequest("recording.start", { trackInputEvents: true });
    const saveProjectRequest = buildRequest("project.save", {
      projectPath: "/tmp/test.gglassproj",
      autoZoom: {
        isEnabled: true,
        intensity: 0.8,
        minimumKeyframeInterval: 1 / 30,
      },
    });
    const recentsRequest = buildRequest("project.recents", {
      limit: 5,
    });

    expect(engineRequestSchema.parse(capabilitiesRequest).method).toBe("engine.capabilities");
    expect(engineRequestSchema.parse(startRecordingRequest).method).toBe("recording.start");
    expect(engineRequestSchema.parse(saveProjectRequest).method).toBe("project.save");
    expect(engineRequestSchema.parse(recentsRequest).method).toBe("project.recents");
  });

  test("validates critical result payloads", () => {
    const capabilities = capabilitiesResultSchema.parse({
      protocolVersion: "2",
      platform: "linux",
      phase: "foundation",
      capture: {
        display: true,
        window: true,
        systemAudio: true,
        microphone: true,
      },
      recording: {
        inputTracking: true,
      },
      export: {
        presets: true,
      },
      project: {
        openSave: true,
      },
    });

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

    const recents = projectRecentsResultSchema.parse({
      items: [
        {
          projectPath: "/tmp/project.gglassproj",
          displayName: "project",
          lastOpenedAt: "2026-02-19T10:00:00.000Z",
        },
      ],
    });

    expect(capabilities.capture.display).toBe(true);
    expect(permissions.inputMonitoring).toBe("notDetermined");
    expect(sources.windows[0]?.appName).toBe("Xcode");
    expect(captureStatus.eventsURL).toBeNull();
    expect(exportInfo.presets.length).toBe(1);
    expect(projectState.projectPath).toContain("project.gglassproj");
    expect(recents.items[0]?.displayName).toBe("project");
  });

  test("parses success and error response envelopes", () => {
    const fixtureDir = path.resolve(import.meta.dir, "../../../packages/engine-protocol/fixtures");
    const recentsResponseRaw = fs.readFileSync(
      path.join(fixtureDir, "project-recents.response.json"),
      "utf8",
    );

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
    const recentsEnvelope = parseResponse(JSON.parse(recentsResponseRaw));
    if (!recentsEnvelope.ok) {
      throw new Error("Expected recents response fixture to be successful");
    }
    const recents = projectRecentsResultSchema.parse(recentsEnvelope.result);

    expect(success.ok).toBe(true);
    expect(failure.ok).toBe(false);
    expect(recents.items[0]?.projectPath).toContain("fixture.gglassproj");
  });
});
