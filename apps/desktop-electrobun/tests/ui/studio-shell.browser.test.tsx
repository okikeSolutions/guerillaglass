import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";
import App from "../../src/mainview/App";

const captureStatus = {
  isRunning: false,
  isRecording: false,
  recordingDurationSeconds: 0,
  recordingURL: null,
  eventsURL: null,
  lastError: null,
};

function installMockBridge() {
  const windowWithBridge = window as unknown as Record<string, unknown>;
  windowWithBridge.ggEnginePing = async () => ({
    app: "guerillaglass-engine",
    engineVersion: "0.1.0",
    protocolVersion: "1.0.0",
    platform: "darwin",
  });
  windowWithBridge.ggEngineGetPermissions = async () => ({
    screenRecordingGranted: true,
    microphoneGranted: true,
    inputMonitoring: "authorized",
  });
  windowWithBridge.ggEngineRequestScreenRecordingPermission = async () => ({ success: true });
  windowWithBridge.ggEngineRequestMicrophonePermission = async () => ({ success: true });
  windowWithBridge.ggEngineRequestInputMonitoringPermission = async () => ({ success: true });
  windowWithBridge.ggEngineOpenInputMonitoringSettings = async () => ({ success: true });
  windowWithBridge.ggEngineListSources = async () => ({
    displays: [
      {
        id: 1,
        displayName: "Built-in Display",
        isPrimary: true,
        width: 1920,
        height: 1080,
        pixelScale: 1,
        refreshHz: 60,
        supportedCaptureFrameRates: [24, 30, 60],
      },
    ],
    windows: [
      {
        id: 1001,
        title: "Mock Studio Window",
        appName: "Guerillaglass",
        width: 1440,
        height: 900,
        isOnScreen: true,
        pixelScale: 1,
        refreshHz: 60,
        supportedCaptureFrameRates: [24, 30, 60],
      },
    ],
  });
  windowWithBridge.ggEngineStartDisplayCapture = async () => ({
    ...captureStatus,
    isRunning: true,
  });
  windowWithBridge.ggEngineStartCurrentWindowCapture = async () => ({
    ...captureStatus,
    isRunning: true,
  });
  windowWithBridge.ggEngineStartWindowCapture = async () => ({ ...captureStatus, isRunning: true });
  windowWithBridge.ggEngineStopCapture = async () => captureStatus;
  windowWithBridge.ggEngineStartRecording = async () => ({
    ...captureStatus,
    isRunning: true,
    isRecording: true,
    recordingDurationSeconds: 12.5,
    recordingURL: "/tmp/guerillaglass-ui-smoke.mov",
  });
  windowWithBridge.ggEngineStopRecording = async () => ({ ...captureStatus, isRunning: true });
  windowWithBridge.ggEngineCaptureStatus = async () => captureStatus;
  windowWithBridge.ggEngineCapturePreviewFrame = async () => ({ previewFrameURL: null });
  windowWithBridge.ggEngineExportInfo = async () => ({
    presets: [
      {
        id: "preset-1080p",
        name: "1080p",
        width: 1920,
        height: 1080,
        frameRate: 60,
        videoBitRate: 8_000_000,
        audioBitRate: 192_000,
        fileType: "mp4",
      },
    ],
  });
  windowWithBridge.ggEngineRunExport = async () => ({
    jobId: "export-1",
    outputURL: "/tmp/export.mp4",
  });
  windowWithBridge.ggEngineRunCutPlanExport = async () => ({
    jobId: "export-cut-1",
    outputURL: "/tmp/export-cut.mp4",
  });
  windowWithBridge.ggEngineProjectCurrent = async () => ({
    projectPath: null,
    autoZoom: { isEnabled: true, intensity: 1, minimumKeyframeInterval: 1 / 30 },
  });
  windowWithBridge.ggEngineProjectOpen = async ({
    projectPath,
  }: { projectPath?: string } = {}) => ({
    projectPath: projectPath ?? "/tmp/mock.gglassproj",
    autoZoom: { isEnabled: true, intensity: 1, minimumKeyframeInterval: 1 / 30 },
  });
  windowWithBridge.ggEngineProjectSave = async ({
    projectPath,
  }: { projectPath?: string } = {}) => ({
    projectPath: projectPath ?? "/tmp/mock.gglassproj",
    autoZoom: { isEnabled: true, intensity: 1, minimumKeyframeInterval: 1 / 30 },
  });
  windowWithBridge.ggEngineProjectRecents = async () => ({ items: [] });
  windowWithBridge.ggResolveCapturePreviewURL = async () => null;
  windowWithBridge.ggResolveMediaSourceURL = async () => null;
  windowWithBridge.ggGrantCapturePreviewCapability = async () => ({ success: true });
  windowWithBridge.ggGrantMediaSourceCapability = async () => ({ success: true });
  windowWithBridge.ggPickPath = async () => null;
  windowWithBridge.ggReadTextFile = async () => "";
  windowWithBridge.ggHostSendMenuState = () => {};
  windowWithBridge.ggHostSendStudioDiagnostics = () => {};
}

let root: Root | undefined;

beforeEach(() => {
  localStorage.clear();
  installMockBridge();
  document.body.innerHTML = '<div id="root"></div>';
  root = createRoot(document.getElementById("root")!);
  root.render(<App />);
});

afterEach(() => {
  root?.unmount();
  root = undefined;
  document.body.innerHTML = "";
});

describe("studio shell browser smoke", () => {
  test("renders shell and navigates capture/edit modes", async () => {
    await expect
      .element(page.getByRole("heading", { level: 1, name: "Guerillaglass" }))
      .toBeVisible();
    await expect.element(page.getByRole("link", { name: "Capture" })).toBeVisible();
    await expect.element(page.getByRole("link", { name: "Edit" })).toBeVisible();
    await expect.element(page.getByRole("link", { name: "Deliver" })).toBeVisible();

    await expect.element(page.getByText("Preview Stage")).toBeVisible();
    await page.getByRole("link", { name: "Edit" }).click();
    await expect.element(page.getByRole("heading", { name: "Editor Stage" })).toBeVisible();
  });
});
