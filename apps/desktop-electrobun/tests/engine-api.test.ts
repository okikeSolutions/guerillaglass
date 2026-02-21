import { beforeEach, describe, expect, test } from "bun:test";
import { defaultCaptureTelemetry } from "@guerillaglass/engine-protocol";
import { desktopApi, engineApi, parseInputEventLog } from "../src/mainview/lib/engine";

function makeCaptureStatus(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    isRunning: false,
    isRecording: false,
    recordingDurationSeconds: 0,
    recordingURL: null,
    lastError: null,
    eventsURL: null,
    telemetry: { ...defaultCaptureTelemetry },
    ...overrides,
  };
}

beforeEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe("renderer engine bridge", () => {
  test("throws a clear error when bridge is missing", async () => {
    (globalThis as { window: unknown }).window = {};
    try {
      await engineApi.ping();
      throw new Error("Expected ping to fail when bridge is missing");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain("Missing Electrobun bridge");
    }
  });

  test("parses parity command payloads", async () => {
    (globalThis as unknown as { window: Record<string, unknown> }).window = {
      ggEnginePing: async () => ({
        app: "guerillaglass",
        engineVersion: "0.2.0",
        protocolVersion: "2",
        platform: "macOS",
      }),
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
        ...makeCaptureStatus(),
      }),
      ggEngineExportInfo: async () => ({
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
      }),
      ggEngineProjectCurrent: async () => ({
        projectPath: null,
        recordingURL: null,
        eventsURL: null,
        autoZoom: {
          isEnabled: true,
          intensity: 1,
          minimumKeyframeInterval: 1 / 30,
        },
        captureMetadata: null,
      }),
      ggEngineStartDisplayCapture: async () => ({
        ...makeCaptureStatus({ isRunning: true }),
      }),
      ggEngineStartRecording: async () => ({
        ...makeCaptureStatus({ isRunning: true, isRecording: true }),
      }),
      ggEngineRunExport: async () => ({ outputURL: "/tmp/out.mp4" }),
      ggEngineProjectSave: async () => ({
        projectPath: "/tmp/project.gglassproj",
        recordingURL: "/tmp/project.gglassproj/recording.mov",
        eventsURL: null,
        autoZoom: {
          isEnabled: true,
          intensity: 1,
          minimumKeyframeInterval: 1 / 30,
        },
        captureMetadata: null,
      }),
      ggEngineProjectRecents: async () => ({
        items: [
          {
            projectPath: "/tmp/project.gglassproj",
            displayName: "project",
            lastOpenedAt: "2026-02-19T10:00:00.000Z",
          },
        ],
      }),
      ggPickDirectory: async () => "/tmp",
      ggReadTextFile: async () =>
        JSON.stringify({
          schemaVersion: 1,
          events: [
            {
              type: "cursorMoved",
              timestamp: 0.15,
              position: { x: 100, y: 120 },
            },
          ],
        }),
    };

    const ping = await engineApi.ping();
    const permissions = await engineApi.getPermissions();
    const sources = await engineApi.listSources();
    const capture = await engineApi.captureStatus();
    const exportInfo = await engineApi.exportInfo();
    const project = await engineApi.projectCurrent();
    const started = await engineApi.startDisplayCapture(true);
    const recording = await engineApi.startRecording(true);
    const exportResult = await engineApi.runExport({
      outputURL: "/tmp/out.mp4",
      presetId: "h264-1080p-30",
      trimStartSeconds: 0,
      trimEndSeconds: 10,
    });
    const savedProject = await engineApi.projectSave({ projectPath: "/tmp/project.gglassproj" });
    const recentProjects = await engineApi.projectRecents(5);
    const picked = await desktopApi.pickDirectory();
    const eventsRaw = await desktopApi.readTextFile("/tmp/events.json");
    const events = parseInputEventLog(eventsRaw);

    expect(ping.protocolVersion).toBe("2");
    expect(permissions.inputMonitoring).toBe("authorized");
    expect(sources.displays.length).toBe(1);
    expect(capture.eventsURL).toBeNull();
    expect(exportInfo.presets[0]?.id).toBe("h264-1080p-30");
    expect(project.autoZoom.isEnabled).toBe(true);
    expect(started.isRunning).toBe(true);
    expect(recording.isRecording).toBe(true);
    expect(exportResult.outputURL).toContain("out.mp4");
    expect(savedProject.projectPath).toContain("project.gglassproj");
    expect(recentProjects.items).toHaveLength(1);
    expect(picked).toBe("/tmp");
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("cursorMoved");
  });
});
