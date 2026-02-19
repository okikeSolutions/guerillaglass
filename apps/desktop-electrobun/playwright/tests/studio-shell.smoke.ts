import { mkdirSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { expect, test } from "@playwright/test";

function installMockBridge() {
  const browserWindow = globalThis as unknown as Record<string, unknown> & {
    localStorage: Storage;
    ggEngineProjectCurrent: () => Promise<unknown>;
  };
  const state = {
    isRunning: false,
    isRecording: false,
    recordingDurationSeconds: 0,
    recordingURL: null,
    eventsURL: null,
    lastError: null,
    projectPath: null,
    autoZoom: {
      isEnabled: true,
      intensity: 1,
      minimumKeyframeInterval: 1 / 30,
    },
  };

  const defaultCaptureMetadata = {
    source: "display",
    contentRect: {
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
    },
    pixelScale: 2,
  };

  const captureStatus = () => ({
    isRunning: state.isRunning,
    isRecording: state.isRecording,
    recordingDurationSeconds: state.recordingDurationSeconds,
    recordingURL: state.recordingURL,
    lastError: state.lastError,
    eventsURL: state.eventsURL,
  });

  browserWindow.ggEnginePing = async () => ({
    app: "guerillaglass-engine",
    engineVersion: "0.1.0",
    protocolVersion: "1.0.0",
    platform: "darwin",
  });

  browserWindow.ggEngineGetPermissions = async () => ({
    screenRecordingGranted: true,
    microphoneGranted: true,
    inputMonitoring: "authorized",
  });

  browserWindow.ggEngineRequestScreenRecordingPermission = async () => ({
    success: true,
    message: "Granted",
  });

  browserWindow.ggEngineRequestMicrophonePermission = async () => ({
    success: true,
    message: "Granted",
  });

  browserWindow.ggEngineRequestInputMonitoringPermission = async () => ({
    success: true,
    message: "Granted",
  });

  browserWindow.ggEngineOpenInputMonitoringSettings = async () => ({
    success: true,
  });

  browserWindow.ggEngineListSources = async () => ({
    displays: [{ id: 1, width: 1920, height: 1080 }],
    windows: [
      {
        id: 1001,
        title: "Mock Studio Window",
        appName: "Guerillaglass",
        width: 1440,
        height: 900,
        isOnScreen: true,
      },
    ],
  });

  browserWindow.ggEngineStartDisplayCapture = async () => {
    state.isRunning = true;
    state.lastError = null;
    return captureStatus();
  };

  browserWindow.ggEngineStartWindowCapture = async () => {
    state.isRunning = true;
    state.lastError = null;
    return captureStatus();
  };

  browserWindow.ggEngineStopCapture = async () => {
    state.isRunning = false;
    state.isRecording = false;
    return captureStatus();
  };

  browserWindow.ggEngineStartRecording = async () => {
    state.isRecording = true;
    state.isRunning = true;
    state.recordingDurationSeconds = 12.5;
    state.recordingURL = "/tmp/guerillaglass-ui-smoke.mov";
    state.eventsURL = null;
    return captureStatus();
  };

  browserWindow.ggEngineStopRecording = async () => {
    state.isRecording = false;
    state.recordingDurationSeconds = 18.25;
    return captureStatus();
  };

  browserWindow.ggEngineCaptureStatus = async () => captureStatus();

  browserWindow.ggEngineExportInfo = async () => ({
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
        name: "Vertical 1080x1920",
        width: 1080,
        height: 1920,
        fps: 60,
        fileType: "mp4",
      },
    ],
  });

  browserWindow.ggEngineRunExport = async () => ({
    outputURL: "/tmp/guerillaglass-ui-smoke-export.mp4",
  });

  browserWindow.ggEngineProjectCurrent = async () => ({
    projectPath: state.projectPath,
    recordingURL: state.recordingURL,
    eventsURL: state.eventsURL,
    autoZoom: state.autoZoom,
    captureMetadata: state.recordingURL ? defaultCaptureMetadata : null,
  });

  browserWindow.ggEngineProjectOpen = async (projectPath) => {
    state.projectPath = projectPath;
    return browserWindow.ggEngineProjectCurrent();
  };

  browserWindow.ggEngineProjectSave = async ({ projectPath, autoZoom } = {}) => {
    if (projectPath) {
      state.projectPath = projectPath;
    } else if (!state.projectPath) {
      state.projectPath = "/tmp/guerillaglass-ui-smoke.gglassproj";
    }
    if (autoZoom) {
      state.autoZoom = autoZoom;
    }
    return browserWindow.ggEngineProjectCurrent();
  };

  browserWindow.ggEngineProjectRecents = async () => ({
    items: [
      {
        projectPath: "/tmp/alpha.gglassproj",
        displayName: "Alpha",
        lastOpenedAt: "2026-02-19T10:00:00.000Z",
      },
    ],
  });

  browserWindow.ggPickDirectory = async () => "/tmp";
  browserWindow.ggReadTextFile = async () =>
    JSON.stringify({
      schemaVersion: 1,
      events: [],
    });
  browserWindow.ggHostSendMenuState = () => {};
}

function screenshotPath(name) {
  const artifactDir = join(process.cwd(), "test-results", "ui-smoke-snapshots");
  mkdirSync(artifactDir, { recursive: true });
  return join(artifactDir, name);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(installMockBridge);
});

test("renders shell and navigates capture/edit/deliver modes", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "Guerillaglass" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Capture" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Edit" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Deliver" })).toBeVisible();

  await expect(page.getByText("Preview Stage")).toBeVisible();
  await page.screenshot({ path: screenshotPath("capture-mode.png"), fullPage: true });

  await page.getByRole("link", { name: "Edit" }).click();
  await expect(page.getByRole("heading", { name: "Editor Stage" })).toBeVisible();
  await expect(page.getByText("Edit Inspector")).toBeVisible();
  await page.screenshot({ path: screenshotPath("edit-mode.png"), fullPage: true });

  await page.getByRole("link", { name: "Deliver" }).click();
  await expect(page.getByRole("heading", { name: "Delivery Summary" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Export" })).toBeVisible();
  await page.screenshot({ path: screenshotPath("deliver-mode.png"), fullPage: true });
});

test("switches locale and keeps locale-scoped routes for every mode", async ({ page }) => {
  await page.goto("/");

  const localeSelect = page.getByRole("combobox").first();
  await localeSelect.selectOption("de-DE");
  await expect(localeSelect).toHaveValue("de-DE");
  await expect(page.getByRole("link", { name: "Aufnahme" })).toBeVisible();

  await page.getByRole("link", { name: "Bearbeiten" }).click();
  await expect(page.getByRole("heading", { name: "Editor-Bereich" })).toBeVisible();

  await page.getByRole("link", { name: "Liefern" }).click();
  await expect(localeSelect).toHaveValue("de-DE");
  await expect(page.getByRole("heading", { name: "Lieferzusammenfassung" })).toBeVisible();
});

test("redirects unknown locale routes to the default locale", async ({ page }) => {
  await page.goto("/fr-FR/edit");
  await expect(page.getByText("Preview Stage")).toBeVisible();
  await expect(page.getByRole("combobox").first()).toHaveValue("en-US");
});

test("starts preview and recording through the shell controls", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("No active preview")).toBeVisible();

  await page.getByRole("button", { name: "Start Preview" }).click();
  await expect(page.getByText("Live preview active")).toBeVisible();

  await page.getByRole("button", { name: "Start Recording" }).click();
  await expect(page.getByRole("button", { name: "Stop Recording" })).toBeVisible();
  await expect(page.getByText("Status: recording")).toBeVisible();

  await page.getByRole("link", { name: "Deliver" }).click();
  await expect(page.getByText("Recording URL: /tmp/guerillaglass-ui-smoke.mov")).toBeVisible();
});

test("restores workspace route and pane collapse from persisted layout", async ({ page }) => {
  await page.addInitScript(() => {
    globalThis.localStorage.setItem(
      "gg.studio.layout.v1",
      JSON.stringify({
        leftPaneWidthPx: 240,
        rightPaneWidthPx: 320,
        leftCollapsed: true,
        rightCollapsed: false,
        timelineHeightPx: 240,
        lastRoute: "/deliver",
        locale: "en-US",
      }),
    );
  });

  await page.goto("/");

  await expect(page.getByRole("heading", { level: 2, name: "Export" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Delivery Summary" })).toBeHidden();
});
