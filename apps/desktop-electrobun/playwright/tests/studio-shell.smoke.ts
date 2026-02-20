import { mkdirSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { expect, type Page, test } from "@playwright/test";

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

function durationStringToMs(value: string): number {
  const normalized = value.trim();
  if (normalized.endsWith("ms")) {
    return Number(normalized.replace("ms", ""));
  }
  if (normalized.endsWith("s")) {
    return Number(normalized.replace("s", "")) * 1000;
  }
  return Number(normalized);
}

async function readPlayheadSeconds(page: Page): Promise<number> {
  const playheadSummary = page
    .locator(".grid.grid-cols-3.text-xs.text-muted-foreground span")
    .nth(1);
  const text = (await playheadSummary.textContent()) ?? "";
  const match = text.match(/([0-9]+\.[0-9]+)/);
  if (!match) {
    throw new Error(`Unable to parse playhead seconds from: ${text}`);
  }
  return Number(match[1]);
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
  await expect(page.getByText("Timeline Tools")).toBeVisible();
  await expect(page.getByRole("button", { name: "Snap" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Blade" })).toBeVisible();
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

test("supports keyboard tab navigation and keyboard-driven pane resizing", async ({ page }) => {
  await page.goto("/");

  const captureModeLink = page.getByRole("link", { name: "Capture" });
  const editModeLink = page.getByRole("link", { name: "Edit" });
  const deliverModeLink = page.getByRole("link", { name: "Deliver" });

  await captureModeLink.focus();
  await expect(captureModeLink).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(editModeLink).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(deliverModeLink).toBeFocused();

  const leftPaneSeparator = page.getByRole("separator", { name: "Resize left panel" });
  await leftPaneSeparator.focus();
  const leftBefore = Number(await leftPaneSeparator.getAttribute("aria-valuenow"));
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(async () => Number(await leftPaneSeparator.getAttribute("aria-valuenow")))
    .toBeGreaterThan(leftBefore);

  const timelineSeparator = page.getByRole("separator", { name: "Resize timeline" });
  await timelineSeparator.focus();
  const timelineBefore = Number(await timelineSeparator.getAttribute("aria-valuenow"));
  await page.keyboard.press("ArrowUp");
  await expect
    .poll(async () => Number(await timelineSeparator.getAttribute("aria-valuenow")))
    .toBeGreaterThan(timelineBefore);
});

test("supports pointer-driven pane and timeline resizing", async ({ page }) => {
  await page.goto("/");

  const leftPaneSeparator = page.getByRole("separator", { name: "Resize left panel" });
  const leftBefore = Number(await leftPaneSeparator.getAttribute("aria-valuenow"));
  const leftBox = await leftPaneSeparator.boundingBox();
  expect(leftBox).not.toBeNull();
  if (!leftBox) {
    throw new Error("Left pane separator bounds unavailable");
  }

  const leftStartX = leftBox.x + leftBox.width / 2;
  const leftY = leftBox.y + leftBox.height / 2;
  await page.mouse.move(leftStartX, leftY);
  await page.mouse.down();
  await page.mouse.move(leftStartX + 72, leftY, { steps: 2 });
  await page.mouse.up();
  await expect
    .poll(async () => Number(await leftPaneSeparator.getAttribute("aria-valuenow")))
    .toBeGreaterThan(leftBefore + 40);

  const timelineSeparator = page.getByRole("separator", { name: "Resize timeline" });
  const timelineBefore = Number(await timelineSeparator.getAttribute("aria-valuenow"));
  const timelineBox = await timelineSeparator.boundingBox();
  expect(timelineBox).not.toBeNull();
  if (!timelineBox) {
    throw new Error("Timeline separator bounds unavailable");
  }

  const timelineX = timelineBox.x + timelineBox.width / 2;
  const timelineStartY = timelineBox.y + timelineBox.height / 2;
  await page.mouse.move(timelineX, timelineStartY);
  await page.mouse.down();
  await page.mouse.move(timelineX, timelineStartY - 64, { steps: 2 });
  await page.mouse.up();
  await expect
    .poll(async () => Number(await timelineSeparator.getAttribute("aria-valuenow")))
    .toBeGreaterThan(timelineBefore + 30);
});

test("applies single-key shortcuts only when enabled and outside interactive controls", async ({
  page,
}) => {
  await page.goto("/");

  const startRecordingButton = page.getByRole("button", { name: "Start Recording" });
  await expect(startRecordingButton).toBeVisible();

  await page.locator("body").click();
  await page.keyboard.press("r");
  await expect(page.getByRole("button", { name: "Stop Recording" })).toBeVisible();
  await page.getByRole("button", { name: "Stop Recording" }).click();
  await expect(startRecordingButton).toBeVisible();

  const singleKeyShortcutToggle = page.getByLabel("Enable single-key shortcuts");
  await singleKeyShortcutToggle.uncheck();
  await expect(singleKeyShortcutToggle).not.toBeChecked();
  await page.locator("body").click();
  await page.keyboard.press("r");
  await expect(page.getByRole("button", { name: "Stop Recording" })).toHaveCount(0);
  await expect(startRecordingButton).toBeVisible();

  await singleKeyShortcutToggle.check();
  await page.getByRole("link", { name: "Edit" }).focus();
  await page.keyboard.press("r");
  await expect(startRecordingButton).toBeVisible();
});

test("keeps timeline playhead stable on pointer cancel", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start Recording" }).click();

  const timelineSurface = page.locator(".gg-timeline-surface");
  const surfaceBox = await timelineSurface.boundingBox();
  expect(surfaceBox).not.toBeNull();
  if (!surfaceBox) {
    throw new Error("Timeline surface bounds unavailable");
  }

  const y = surfaceBox.y + surfaceBox.height / 2;
  const startX = surfaceBox.x + surfaceBox.width * 0.12;
  const moveX = surfaceBox.x + surfaceBox.width * 0.34;
  const cancelX = surfaceBox.x + surfaceBox.width * 0.94;

  await timelineSurface.dispatchEvent("pointerdown", {
    button: 0,
    buttons: 1,
    clientX: startX,
    clientY: y,
    isPrimary: true,
    pointerId: 7,
    pointerType: "mouse",
  });
  await timelineSurface.dispatchEvent("pointermove", {
    button: 0,
    buttons: 1,
    clientX: moveX,
    clientY: y,
    isPrimary: true,
    pointerId: 7,
    pointerType: "mouse",
  });

  await expect.poll(async () => readPlayheadSeconds(page)).toBeGreaterThan(3);

  await timelineSurface.dispatchEvent("pointercancel", {
    button: 0,
    buttons: 0,
    clientX: cancelX,
    clientY: y,
    isPrimary: true,
    pointerId: 7,
    pointerType: "mouse",
  });

  await expect.poll(async () => readPlayheadSeconds(page)).toBeLessThan(8);
});

test("honors reduced-motion and increased-contrast accessibility preferences", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce", contrast: "more" });
  await page.goto("/");

  const resizeTransitionDuration = await page
    .locator(".gg-pane-resize-handle")
    .first()
    .evaluate((element) => getComputedStyle(element).transitionDuration);
  const durations = resizeTransitionDuration.split(",").map(durationStringToMs);
  expect(durations.every((duration) => duration === 0)).toBe(true);

  const headerBackdropFilter = await page
    .locator("header")
    .evaluate((element) => getComputedStyle(element).backdropFilter);
  expect(headerBackdropFilter).toBe("none");

  const localeControlColors = await page.evaluate(() => {
    const localeControl = document.querySelector("#studio-locale-select");
    if (
      localeControl == null ||
      typeof localeControl !== "object" ||
      !("nodeType" in localeControl)
    ) {
      throw new Error("Locale control not found");
    }
    const style = getComputedStyle(localeControl as Element);
    return {
      foreground: style.color,
      background: style.backgroundColor,
    };
  });

  const contrast = await page.evaluate((colors) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Unable to create canvas context");
    }

    context.fillStyle = colors.foreground;
    context.fillRect(0, 0, 1, 1);
    const foregroundPixel = context.getImageData(0, 0, 1, 1).data;

    context.clearRect(0, 0, 1, 1);
    context.fillStyle = colors.background;
    context.fillRect(0, 0, 1, 1);
    const backgroundPixel = context.getImageData(0, 0, 1, 1).data;

    const foregroundRed = foregroundPixel[0] / 255;
    const foregroundGreen = foregroundPixel[1] / 255;
    const foregroundBlue = foregroundPixel[2] / 255;
    const backgroundRed = backgroundPixel[0] / 255;
    const backgroundGreen = backgroundPixel[1] / 255;
    const backgroundBlue = backgroundPixel[2] / 255;

    const foregroundRedLinear =
      foregroundRed <= 0.039_28 ? foregroundRed / 12.92 : ((foregroundRed + 0.055) / 1.055) ** 2.4;
    const foregroundGreenLinear =
      foregroundGreen <= 0.039_28
        ? foregroundGreen / 12.92
        : ((foregroundGreen + 0.055) / 1.055) ** 2.4;
    const foregroundBlueLinear =
      foregroundBlue <= 0.039_28
        ? foregroundBlue / 12.92
        : ((foregroundBlue + 0.055) / 1.055) ** 2.4;
    const backgroundRedLinear =
      backgroundRed <= 0.039_28 ? backgroundRed / 12.92 : ((backgroundRed + 0.055) / 1.055) ** 2.4;
    const backgroundGreenLinear =
      backgroundGreen <= 0.039_28
        ? backgroundGreen / 12.92
        : ((backgroundGreen + 0.055) / 1.055) ** 2.4;
    const backgroundBlueLinear =
      backgroundBlue <= 0.039_28
        ? backgroundBlue / 12.92
        : ((backgroundBlue + 0.055) / 1.055) ** 2.4;

    const foregroundLum =
      0.2126 * foregroundRedLinear + 0.7152 * foregroundGreenLinear + 0.0722 * foregroundBlueLinear;
    const backgroundLum =
      0.2126 * backgroundRedLinear + 0.7152 * backgroundGreenLinear + 0.0722 * backgroundBlueLinear;
    const lighter = Math.max(foregroundLum, backgroundLum);
    const darker = Math.min(foregroundLum, backgroundLum);
    return (lighter + 0.05) / (darker + 0.05);
  }, localeControlColors);

  expect(contrast).toBeGreaterThanOrEqual(4.5);
});
