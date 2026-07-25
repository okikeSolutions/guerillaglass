import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";
import { defaultBackgroundFramingSettings } from "@guerillaglass/engine-contract/shared/valueObjects";
import App from "../../src/mainview/App";

let backgroundFramingSupported = true;

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
  windowWithBridge.ggEngineCapabilities = async () => ({
    protocolVersion: "1.0.0",
    phase: "native",
    platform: "macos",
    capture: { display: true, window: true, systemAudio: true, microphone: true },
    recording: { inputTracking: true },
    export: { presets: true, cutPlan: true, backgroundFraming: backgroundFramingSupported },
    project: { openSave: true },
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
        fps: 60,
        fileType: "mp4",
      },
      {
        id: "preset-vertical",
        name: "Vertical 1080p",
        width: 1080,
        height: 1920,
        fps: 30,
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
    backgroundFraming: {
      ...defaultBackgroundFramingSettings,
      enabled: !backgroundFramingSupported,
    },
  });
  windowWithBridge.ggEngineProjectOpen = async ({
    projectPath,
  }: { projectPath?: string } = {}) => ({
    projectPath: projectPath ?? "/tmp/mock.gglassproj",
    autoZoom: { isEnabled: true, intensity: 1, minimumKeyframeInterval: 1 / 30 },
    backgroundFraming: defaultBackgroundFramingSettings,
  });
  windowWithBridge.ggEngineProjectSave = async ({
    projectPath,
  }: { projectPath?: string } = {}) => ({
    projectPath: projectPath ?? "/tmp/mock.gglassproj",
    autoZoom: { isEnabled: true, intensity: 1, minimumKeyframeInterval: 1 / 30 },
    backgroundFraming: defaultBackgroundFramingSettings,
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
  backgroundFramingSupported = true;
  localStorage.clear();
  window.history.replaceState({}, "", "/capture");
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
  test("background framing controls update the real preview stage", async () => {
    await expect.element(page.getByTestId("background-framing-stage")).toBeVisible();
    await page.getByRole("button", { name: "EFFECTS" }).click();
    const framingToggle = page.getByRole("checkbox", { name: "Background framing" });
    await expect.element(framingToggle).toBeVisible();
    await framingToggle.click();

    await expect
      .element(page.getByTestId("background-framing-stage"))
      .toHaveAttribute("data-framing-enabled", "true");
    await expect.element(page.getByTestId("background-framing-card")).toBeVisible();
    await expect
      .element(page.getByTestId("background-framing-card"))
      .toHaveAttribute("data-camera-reframe", "true");
    await expect
      .element(page.getByRole("slider", { name: "Background padding" }))
      .toBeInTheDocument();
    await expect
      .element(page.getByRole("slider", { name: "Corner roundness" }))
      .toBeInTheDocument();
    await expect.element(page.getByRole("slider", { name: "Shadow strength" })).toBeInTheDocument();
    await page.screenshot({ path: "../../test-results/screenshots/background-framing.png" });
  });

  test("vertical presets switch the auto-zoom preview to a portrait viewport", async () => {
    await page.getByRole("link", { name: "Deliver" }).click();
    await page
      .getByTestId("editor-center-pane")
      .getByRole("combobox")
      .selectOptions("preset-vertical");
    await page.getByRole("link", { name: "Edit" }).click();
    await expect.element(page.getByTestId("background-framing-card")).toBeVisible();

    const card = document.querySelector<HTMLElement>("[data-testid='background-framing-card']");
    expect(card).not.toBeNull();
    const bounds = card!.getBoundingClientRect();
    expect(bounds.height).toBeGreaterThan(bounds.width);
    await expect
      .element(page.getByTestId("background-framing-card"))
      .toHaveAttribute("data-camera-reframe", "true");
    await page.screenshot({ path: "../../test-results/screenshots/vertical-camera-preview.png" });
    await page.getByRole("link", { name: "Capture" }).click();
  });

  test("unsupported native renderers hide framing controls and keep preview disabled", async () => {
    root?.unmount();
    backgroundFramingSupported = false;
    installMockBridge();
    root = createRoot(document.getElementById("root")!);
    root.render(<App />);

    await expect.element(page.getByTestId("background-framing-stage")).toBeVisible();
    await page.getByRole("button", { name: "EFFECTS" }).click();
    await expect
      .element(page.getByTestId("background-framing-stage"))
      .toHaveAttribute("data-framing-enabled", "false");
    await expect
      .element(page.getByRole("checkbox", { name: "Background framing" }))
      .not.toBeInTheDocument();
  });

  test("renders shell and navigates capture/edit modes", async () => {
    await expect
      .element(page.getByRole("heading", { level: 1, name: "Guerillaglass" }))
      .toBeVisible();
    await expect.element(page.getByRole("link", { name: "Capture" })).toBeVisible();
    await expect.element(page.getByRole("link", { name: "Edit" })).toBeVisible();
    await expect.element(page.getByRole("link", { name: "Deliver" })).toBeVisible();

    await expect.element(page.getByText("Preview Stage")).toBeVisible();
    await page.screenshot({ path: "../../test-results/screenshots/acceptance-capture.png" });

    await page.getByRole("link", { name: "Edit" }).click();
    await expect.element(page.getByRole("heading", { name: "Editor Stage" })).toBeVisible();
    await page.screenshot({ path: "../../test-results/screenshots/acceptance-edit.png" });

    await page.getByRole("link", { name: "Deliver" }).click();
    await expect
      .element(page.getByRole("link", { name: "Deliver" }))
      .toHaveAttribute("aria-current");
    await page.screenshot({ path: "../../test-results/screenshots/acceptance-deliver.png" });
  });
});
