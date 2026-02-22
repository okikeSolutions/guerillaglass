import { beforeEach, describe, expect, test } from "bun:test";
import { defaultCaptureTelemetry } from "@guerillaglass/engine-protocol";
import {
  desktopApi,
  engineApi,
  parseInputEventLog,
  sendHostMenuState,
} from "../src/mainview/lib/engine";

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
    let lastMenuState: unknown;
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
      ggEngineRequestScreenRecordingPermission: async () => ({
        success: true,
      }),
      ggEngineRequestMicrophonePermission: async () => ({
        success: true,
      }),
      ggEngineRequestInputMonitoringPermission: async () => ({
        success: true,
      }),
      ggEngineOpenInputMonitoringSettings: async () => ({
        success: true,
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
      ggEngineStartCurrentWindowCapture: async () => ({
        ...makeCaptureStatus({ isRunning: true }),
      }),
      ggEngineStartWindowCapture: async () => ({
        ...makeCaptureStatus({ isRunning: true }),
      }),
      ggEngineStopCapture: async () => ({
        ...makeCaptureStatus({ isRunning: false }),
      }),
      ggEngineStartRecording: async () => ({
        ...makeCaptureStatus({ isRunning: true, isRecording: true }),
      }),
      ggEngineStopRecording: async () => ({
        ...makeCaptureStatus({ isRunning: true, isRecording: false }),
      }),
      ggEngineRunExport: async () => ({ outputURL: "/tmp/out.mp4" }),
      ggEngineProjectOpen: async () => ({
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
      ggPickPath: async ({ mode }: { mode: string }) =>
        mode === "saveProjectAs" ? "/tmp/alpha.gglassproj" : "/tmp",
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
      ggResolveMediaSourceURL: async () => "media://token",
      ggHostSendMenuState: (state: unknown) => {
        lastMenuState = state;
      },
    };

    const ping = await engineApi.ping();
    const permissions = await engineApi.getPermissions();
    const requestedScreenPermission = await engineApi.requestScreenRecordingPermission();
    const requestedMicPermission = await engineApi.requestMicrophonePermission();
    const requestedInputPermission = await engineApi.requestInputMonitoringPermission();
    const openedInputMonitoringSettings = await engineApi.openInputMonitoringSettings();
    const sources = await engineApi.listSources();
    const capture = await engineApi.captureStatus();
    const exportInfo = await engineApi.exportInfo();
    const project = await engineApi.projectCurrent();
    const started = await engineApi.startDisplayCapture(true);
    const startedCurrentWindow = await engineApi.startCurrentWindowCapture(true);
    const startedWindow = await engineApi.startWindowCapture(12, true);
    const recording = await engineApi.startRecording(true);
    const stoppedRecording = await engineApi.stopRecording();
    const stoppedCapture = await engineApi.stopCapture();
    const exportResult = await engineApi.runExport({
      outputURL: "/tmp/out.mp4",
      presetId: "h264-1080p-30",
      trimStartSeconds: 0,
      trimEndSeconds: 10,
    });
    const openedProject = await engineApi.projectOpen("/tmp/project.gglassproj");
    const savedProject = await engineApi.projectSave({ projectPath: "/tmp/project.gglassproj" });
    const recentProjects = await engineApi.projectRecents(5);
    const picked = await desktopApi.pickPath({ mode: "export" });
    const eventsRaw = await desktopApi.readTextFile("/tmp/events.json");
    const mediaSourceURL = await desktopApi.resolveMediaSourceURL("/tmp/out.mp4");
    sendHostMenuState({
      canSave: true,
      canExport: true,
      isRecording: false,
      locale: "en-US",
      densityMode: "comfortable",
    });
    const events = parseInputEventLog(eventsRaw);

    expect(ping.protocolVersion).toBe("2");
    expect(permissions.inputMonitoring).toBe("authorized");
    expect(requestedScreenPermission.success).toBe(true);
    expect(requestedMicPermission.success).toBe(true);
    expect(requestedInputPermission.success).toBe(true);
    expect(openedInputMonitoringSettings.success).toBe(true);
    expect(sources.displays.length).toBe(1);
    expect(capture.eventsURL).toBeNull();
    expect(exportInfo.presets[0]?.id).toBe("h264-1080p-30");
    expect(project.autoZoom.isEnabled).toBe(true);
    expect(started.isRunning).toBe(true);
    expect(startedCurrentWindow.isRunning).toBe(true);
    expect(startedWindow.isRunning).toBe(true);
    expect(recording.isRecording).toBe(true);
    expect(stoppedRecording.isRecording).toBe(false);
    expect(stoppedCapture.isRunning).toBe(false);
    expect(exportResult.outputURL).toContain("out.mp4");
    expect(openedProject.projectPath).toContain("project.gglassproj");
    expect(savedProject.projectPath).toContain("project.gglassproj");
    expect(recentProjects.items).toHaveLength(1);
    expect(picked).toBe("/tmp");
    expect(mediaSourceURL).toBe("media://token");
    expect(lastMenuState).toEqual({
      canSave: true,
      canExport: true,
      isRecording: false,
      locale: "en-US",
      densityMode: "comfortable",
    });
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("cursorMoved");
  });

  test("sendHostMenuState is a no-op when host sender is not available", () => {
    (globalThis as unknown as { window: Record<string, unknown> }).window = {};
    expect(() =>
      sendHostMenuState({
        canSave: false,
        canExport: false,
        isRecording: false,
      }),
    ).not.toThrow();
  });
});
