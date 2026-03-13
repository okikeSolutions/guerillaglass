import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { EngineClient, resolveEnginePath } from "../apps/desktop-electrobun/src/bun/engine/client.ts";
import type { CaptureFrameRate } from "../packages/engine-protocol/src/index.ts";

type BenchmarkScenarioID =
  | "display-60-no-mic"
  | "display-60-mic"
  | "window-60-no-mic"
  | "window-60-input-tracking"
  | "display-120-no-mic"
  | "display-120-mic"
  | "window-120-no-mic"
  | "window-120-input-tracking";

type ScenarioConfig = {
  id: BenchmarkScenarioID;
  name: string;
  captureType: "display" | "window";
  enableMic: boolean;
  trackInputEvents: boolean;
  captureFps: CaptureFrameRate;
};

type CaptureTelemetry = Awaited<ReturnType<EngineClient["captureStatus"]>>["telemetry"];
type CaptureStatus = Awaited<ReturnType<EngineClient["captureStatus"]>>;
type SourceListing = Awaited<ReturnType<EngineClient["listSources"]>>;
type WindowSource = SourceListing["windows"][number];
type DisplaySource = SourceListing["displays"][number];

type BenchmarkSample = {
  relativeSeconds: number;
  telemetry: CaptureTelemetry;
};

type StartupThresholds = {
  maxPrimingMs: number;
  maxWriterBackpressureDrops: number;
};

type StartupReport = {
  primingMs: number | null;
  status: "passed" | "failed" | "error";
  writerBackpressureDrops: number | null;
};

type InputTrackingDiagnostics = {
  cursorEventsObserved: number | null;
  cursorEventsEmitted: number | null;
  clickEventsEmitted: number | null;
};

type ScenarioVerdicts = {
  droppedFramesWithinTarget: boolean | null;
  averageCpuWithinTarget: boolean | null;
  achievedFpsWithinTarget: boolean;
  writerBackpressureClear: boolean;
  exact1080pDisplayMatched: boolean | null;
  retinaWindowMatched: boolean | null;
};

type ScenarioThresholds = {
  maxDroppedFramePercent: number;
  maxAverageCpuPercent: number;
  minAchievedFps: number;
  maxWriterBackpressureDrops: number;
};

type ScenarioReport = {
  runIndex: number;
  id: BenchmarkScenarioID;
  name: string;
  status: "passed" | "failed" | "error" | "skipped";
  captureType: "display" | "window";
  enableMic: boolean;
  trackInputEvents: boolean;
  captureFps: CaptureFrameRate;
  startupThresholds: StartupThresholds;
  thresholds: ScenarioThresholds;
  startup: StartupReport;
  durationSeconds: number;
  source: {
    displayId?: number;
    windowId?: number;
    title?: string;
    appName?: string;
    width: number;
    height: number;
    pixelScale: number | null;
    refreshHz: number | null;
    supportedCaptureFrameRates: CaptureFrameRate[];
  } | null;
  effectivePixelCount: number | null;
  inputTracking: InputTrackingDiagnostics;
  notes: string[];
  finalTelemetry: CaptureTelemetry | null;
  aggregates: {
    averageAchievedFps: number;
    minimumAchievedFps: number;
    averageCpuPercent: number | null;
    peakCpuPercent: number | null;
    averageMemoryBytes: number | null;
    peakMemoryBytes: number | null;
    averageCaptureCallbackMs: number;
    peakCaptureCallbackMs: number;
    averageRecordQueueLagMs: number;
    peakRecordQueueLagMs: number;
    averageWriterAppendMs: number;
    peakWriterAppendMs: number;
    overallDroppedFrames: number | null;
    overallDroppedFramePercent: number | null;
  };
  verdicts: ScenarioVerdicts;
  recordingURL: string | null;
  eventsURL: string | null;
  samples: BenchmarkSample[];
  failure?: string;
};

type ScenarioSeriesReport = {
  id: BenchmarkScenarioID;
  name: string;
  status: "passed" | "failed" | "error" | "skipped";
  captureType: "display" | "window";
  enableMic: boolean;
  trackInputEvents: boolean;
  captureFps: CaptureFrameRate;
  startupThresholds: StartupThresholds;
  thresholds: ScenarioThresholds;
  source: ScenarioReport["source"];
  runs: ScenarioReport[];
  summary: {
    worstStartupPrimingMs: number | null;
    averageAchievedFps: number;
    overallDroppedFramePercent: number | null;
    averageCpuPercent: number | null;
    cursorEventsObserved: number | null;
    cursorEventsEmitted: number | null;
  };
};

type BenchmarkReport = {
  generatedAt: string;
  machine: {
    hostname: string;
    platform: NodeJS.Platform;
    arch: string;
    cpus: number;
    release: string;
  };
  enginePath: string;
  config: {
    durationSeconds: number;
    pollIntervalMs: number;
    warmupMs: number;
  };
  thresholds: {
    startup60: StartupThresholds;
    startup120: StartupThresholds;
    fps60: ScenarioThresholds;
    fps120: ScenarioThresholds;
  };
  scenarios: ScenarioSeriesReport[];
};

const scenarioCatalog: readonly ScenarioConfig[] = Object.freeze([
  {
    id: "display-60-no-mic",
    name: "Display capture at 60 fps, microphone disabled",
    captureType: "display",
    enableMic: false,
    trackInputEvents: false,
    captureFps: 60,
  },
  {
    id: "display-60-mic",
    name: "Display capture at 60 fps, microphone enabled",
    captureType: "display",
    enableMic: true,
    trackInputEvents: false,
    captureFps: 60,
  },
  {
    id: "window-60-no-mic",
    name: "Window capture at 60 fps, microphone disabled",
    captureType: "window",
    enableMic: false,
    trackInputEvents: false,
    captureFps: 60,
  },
  {
    id: "window-60-input-tracking",
    name: "Window capture at 60 fps with input tracking enabled",
    captureType: "window",
    enableMic: false,
    trackInputEvents: true,
    captureFps: 60,
  },
  {
    id: "display-120-no-mic",
    name: "Display capture at 120 fps, microphone disabled",
    captureType: "display",
    enableMic: false,
    trackInputEvents: false,
    captureFps: 120,
  },
  {
    id: "display-120-mic",
    name: "Display capture at 120 fps, microphone enabled",
    captureType: "display",
    enableMic: true,
    trackInputEvents: false,
    captureFps: 120,
  },
  {
    id: "window-120-no-mic",
    name: "Window capture at 120 fps, microphone disabled",
    captureType: "window",
    enableMic: false,
    trackInputEvents: false,
    captureFps: 120,
  },
  {
    id: "window-120-input-tracking",
    name: "Window capture at 120 fps with input tracking enabled",
    captureType: "window",
    enableMic: false,
    trackInputEvents: true,
    captureFps: 120,
  },
]);

const thresholds = Object.freeze({
  startup60: {
    maxPrimingMs: 400,
    maxWriterBackpressureDrops: 0,
  },
  startup120: {
    maxPrimingMs: 550,
    maxWriterBackpressureDrops: 0,
  },
  fps60: {
    maxDroppedFramePercent: 0.5,
    maxAverageCpuPercent: 20,
    minAchievedFps: 59,
    maxWriterBackpressureDrops: 0,
  },
  fps120: {
    maxDroppedFramePercent: 1.0,
    maxAverageCpuPercent: 35,
    minAchievedFps: 114,
    maxWriterBackpressureDrops: 0,
  },
});

function thresholdsForCaptureFrameRate(captureFps: CaptureFrameRate): ScenarioThresholds {
  return captureFps >= 120 ? thresholds.fps120 : thresholds.fps60;
}

function startupThresholdsForCaptureFrameRate(captureFps: CaptureFrameRate): StartupThresholds {
  return captureFps >= 120 ? thresholds.startup120 : thresholds.startup60;
}

function parseArgs(argv: string[]) {
  let durationSeconds = 10;
  let pollIntervalMs = 500;
  let warmupMs = 1_000;
  let outputDir = path.join(process.cwd(), ".tmp", "capture-benchmarks");
  let scenarioFilter: BenchmarkScenarioID[] | null = null;

  for (const arg of argv) {
    if (arg === "--help") {
      printUsage();
      process.exit(0);
    }
    if (arg.startsWith("--duration=")) {
      durationSeconds = parsePositiveInteger(arg.slice("--duration=".length), "duration");
      continue;
    }
    if (arg.startsWith("--poll-ms=")) {
      pollIntervalMs = parsePositiveInteger(arg.slice("--poll-ms=".length), "poll-ms");
      continue;
    }
    if (arg.startsWith("--warmup-ms=")) {
      warmupMs = parseNonNegativeInteger(arg.slice("--warmup-ms=".length), "warmup-ms");
      continue;
    }
    if (arg.startsWith("--output-dir=")) {
      outputDir = path.resolve(process.cwd(), arg.slice("--output-dir=".length));
      continue;
    }
    if (arg.startsWith("--scenario=")) {
      const requested = arg
        .slice("--scenario=".length)
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      scenarioFilter = requested.map(parseScenarioID);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  const scenarios =
    scenarioFilter === null
      ? [...scenarioCatalog]
      : scenarioCatalog.filter((scenario) => scenarioFilter.includes(scenario.id));

  return {
    durationSeconds,
    pollIntervalMs,
    warmupMs,
    outputDir,
    scenarios,
  };
}

function printUsage() {
  console.log(`Usage: bun ./Scripts/capture_benchmark.ts [options]

Options:
  --duration=<seconds>     Recording duration for each scenario (default: 10)
  --poll-ms=<milliseconds> Telemetry polling interval while recording (default: 500)
  --warmup-ms=<milliseconds>
                           Delay between capture start and recording start (default: 1000)
  --scenario=<ids>         Comma-separated scenario IDs to run
  --output-dir=<path>      Directory for JSON and Markdown reports
  --help                   Show this message

Scenarios:
  ${scenarioCatalog.map((scenario) => scenario.id).join("\n  ")}`);
}

function parseScenarioID(rawValue: string): BenchmarkScenarioID {
  const candidate = rawValue as BenchmarkScenarioID;
  if (scenarioCatalog.some((scenario) => scenario.id === candidate)) {
    return candidate;
  }
  throw new Error(`Unknown scenario: ${rawValue}`);
}

function parsePositiveInteger(rawValue: string, name: string): number {
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function parseNonNegativeInteger(rawValue: string, name: string): number {
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return parsed;
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs} ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

async function stopCaptureSession(engine: EngineClient) {
  try {
    await withTimeout(engine.stopRecording(), 5_000, "stopRecording cleanup");
  } catch {}

  try {
    await withTimeout(engine.stopCapture(), 5_000, "stopCapture cleanup");
  } catch {}
}

function mean(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function minimum(values: number[]): number {
  return values.length === 0 ? 0 : Math.min(...values);
}

function maximum(values: number[]): number | null {
  return values.length === 0 ? null : Math.max(...values);
}

function toSteadyStateSamples(samples: BenchmarkSample[]) {
  if (samples.length <= 1) {
    return samples;
  }

  const steadyByTime = samples.filter((sample) => sample.relativeSeconds >= 1);
  if (steadyByTime.length >= 3) {
    return steadyByTime;
  }

  const skipCount = Math.min(2, Math.floor(samples.length / 4));
  if (skipCount > 0 && samples.length - skipCount >= 3) {
    return samples.slice(skipCount);
  }

  return samples;
}

function formatDecimal(value: number | null, digits = 2) {
  if (value === null) {
    return "n/a";
  }
  return value.toFixed(digits);
}

function formatBytes(value: number | null) {
  if (value === null) {
    return "n/a";
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  let current = value;
  let unitIndex = 0;
  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024;
    unitIndex += 1;
  }
  return `${current.toFixed(current >= 100 ? 0 : 1)} ${units[unitIndex]}`;
}

function effectivePixelCountForSource(
  source:
    | {
        width: number;
        height: number;
        pixelScale: number | null;
      }
    | null
    | undefined,
) {
  if (!source) {
    return null;
  }
  const pixelScale = Math.max(1, source.pixelScale ?? 1);
  return source.width * source.height * pixelScale * pixelScale;
}

function makeInputTrackingMetricsPath(eventsURL: string) {
  return eventsURL.replace(/\.json$/u, ".stats.json");
}

async function loadInputTrackingDiagnostics(eventsURL: string | null): Promise<InputTrackingDiagnostics> {
  if (!eventsURL) {
    return {
      cursorEventsObserved: null,
      cursorEventsEmitted: null,
      clickEventsEmitted: null,
    };
  }

  const metricsPath = makeInputTrackingMetricsPath(eventsURL);
  if (!existsSync(metricsPath)) {
    return {
      cursorEventsObserved: null,
      cursorEventsEmitted: null,
      clickEventsEmitted: null,
    };
  }

  const raw = await readFile(metricsPath, "utf8");
  const parsed = JSON.parse(raw) as {
    schemaVersion: number;
    metrics: {
      cursorEventsObserved: number;
      cursorEventsEmitted: number;
      clickEventsEmitted: number;
    };
  };

  return {
    cursorEventsObserved: parsed.metrics.cursorEventsObserved,
    cursorEventsEmitted: parsed.metrics.cursorEventsEmitted,
    clickEventsEmitted: parsed.metrics.clickEventsEmitted,
  };
}

async function ensurePermissions(engine: EngineClient, scenario: ScenarioConfig) {
  let permissions = await engine.getPermissions();

  if (!permissions.screenRecordingGranted) {
    const response = await engine.requestScreenRecordingPermission();
    if (!response.success) {
      throw new Error("Screen Recording permission request was rejected by the engine.");
    }
    await sleep(1_000);
    permissions = await engine.getPermissions();
  }

  if (!permissions.screenRecordingGranted) {
    throw new Error("Screen Recording permission is required for capture benchmarks.");
  }

  if (scenario.enableMic && !permissions.microphoneGranted) {
    const response = await engine.requestMicrophonePermission();
    if (!response.success) {
      throw new Error("Microphone permission request was rejected by the engine.");
    }
    await sleep(1_000);
    permissions = await engine.getPermissions();
  }

  if (scenario.enableMic && !permissions.microphoneGranted) {
    throw new Error("Microphone permission is required for the microphone benchmark scenario.");
  }

  if (scenario.trackInputEvents && permissions.inputMonitoring !== "authorized") {
    const response = await engine.requestInputMonitoringPermission();
    if (!response.success) {
      throw new Error("Input Monitoring permission request was rejected by the engine.");
    }
    await sleep(1_000);
    permissions = await engine.getPermissions();
  }

  if (scenario.trackInputEvents && permissions.inputMonitoring !== "authorized") {
    throw new Error(
      "Input Monitoring permission is required for the input-tracking benchmark scenario.",
    );
  }

  return permissions;
}

function selectDisplaySource(sources: SourceListing, captureFps: CaptureFrameRate) {
  const supportedDisplays = sources.displays.filter((display) =>
    display.supportedCaptureFrameRates.includes(captureFps),
  );
  const exact1080p = supportedDisplays.find(
    (display) => display.width === 1920 && display.height === 1080,
  );
  return {
    source: exact1080p ?? supportedDisplays[0] ?? null,
    fallbackSource: sources.displays[0] ?? null,
    exact1080pMatched: exact1080p !== undefined,
  };
}

function rankWindowSources(candidates: WindowSource[]) {
  const rankedCandidates =
    candidates.filter((window) => window.title.trim().length > 0) || candidates;
  const sourcePool = rankedCandidates.length > 0 ? rankedCandidates : candidates;
  sourcePool.sort((left, right) => {
    const areaDelta = right.width * right.height - left.width * left.height;
    if (areaDelta !== 0) {
      return areaDelta;
    }
    return right.id - left.id;
  });
  return sourcePool;
}

function isBenchmarkableWindow(window: WindowSource) {
  if (!window.isOnScreen) {
    return false;
  }
  if (!window.appName.trim()) {
    return false;
  }
  if (window.width < 400 || window.height < 300) {
    return false;
  }
  if (window.appName === "Guerillaglass-dev") {
    return false;
  }
  if (window.appName === "Hintergrundbild" || window.appName === "loginwindow") {
    return false;
  }
  if (
    window.title === "Menubar" ||
    window.title === "Menüleiste" ||
    window.title === "Display 1 Backstop" ||
    window.title === "Display 1 Shield" ||
    window.title === "underbelly" ||
    window.title === "Offscreen Wallpaper Window"
  ) {
    return false;
  }
  return true;
}

function selectWindowSource(sources: SourceListing): WindowSource | null {
  const candidates = sources.windows.filter(isBenchmarkableWindow);
  return rankWindowSources(candidates)[0] ?? null;
}

function buildSourceDetails(
  source:
    | (DisplaySource & { title?: never; appName?: never; isOnScreen?: never })
    | WindowSource
    | null,
  overrides?: {
    pixelScale?: number | null;
    displayId?: number;
    windowId?: number;
    title?: string;
    appName?: string;
    width?: number;
    height?: number;
  },
) {
  if (!source && !overrides) {
    return null;
  }

  return {
    displayId: overrides?.displayId,
    windowId: overrides?.windowId,
    title: overrides?.title,
    appName: overrides?.appName,
    width: overrides?.width ?? source?.width ?? 0,
    height: overrides?.height ?? source?.height ?? 0,
    pixelScale: overrides?.pixelScale ?? null,
    refreshHz: source?.refreshHz ?? null,
    supportedCaptureFrameRates: source?.supportedCaptureFrameRates ?? [],
  };
}

async function runScenarioRun(
  engine: EngineClient,
  scenario: ScenarioConfig,
  options: { durationSeconds: number; pollIntervalMs: number; warmupMs: number },
  runIndex: number,
): Promise<ScenarioReport> {
  const scenarioThresholds = thresholdsForCaptureFrameRate(scenario.captureFps);
  const startupThresholds = startupThresholdsForCaptureFrameRate(scenario.captureFps);
  const notes: string[] = [];
  let finalStatus: CaptureStatus | null = null;
  const samples: BenchmarkSample[] = [];
  let selectedWindow: WindowSource | null = null;
  let selectedDisplay: DisplaySource | null = null;
  let exact1080pMatched: boolean | null = null;
  const startedAt = performance.now();
  let startup: StartupReport = {
    primingMs: null,
    status: "error",
    writerBackpressureDrops: null,
  };

  try {
    const sources = await engine.listSources();
    if (scenario.captureType === "display") {
      const selection = selectDisplaySource(sources, scenario.captureFps);
      selectedDisplay = selection.source ?? selection.fallbackSource;
      exact1080pMatched = selection.exact1080pMatched;
      if (!selection.source) {
        notes.push(
          `No display source advertised support for ${scenario.captureFps} fps; running direct display capture without preselected source metadata.`,
        );
      }
      if (selectedDisplay && !selection.exact1080pMatched) {
        notes.push(
          `No 1920x1080 display source was available; display benchmark ran at ${selectedDisplay.width}x${selectedDisplay.height}.`,
        );
      }
    } else {
      selectedWindow = selectWindowSource(sources);
      if (!selectedWindow) {
        return {
          runIndex,
          id: scenario.id,
          name: scenario.name,
          status: "skipped",
          captureType: scenario.captureType,
          enableMic: scenario.enableMic,
          trackInputEvents: scenario.trackInputEvents,
          captureFps: scenario.captureFps,
          startupThresholds,
          thresholds: scenarioThresholds,
          startup,
          durationSeconds: 0,
          source: null,
          effectivePixelCount: null,
          inputTracking: {
            cursorEventsObserved: null,
            cursorEventsEmitted: null,
            clickEventsEmitted: null,
          },
          notes: [
            `No on-screen window source advertised support for ${scenario.captureFps} fps.`,
          ],
          finalTelemetry: null,
          aggregates: {
            averageAchievedFps: 0,
            minimumAchievedFps: 0,
            averageCpuPercent: null,
            peakCpuPercent: null,
            averageMemoryBytes: null,
            peakMemoryBytes: null,
            averageCaptureCallbackMs: 0,
            peakCaptureCallbackMs: 0,
            averageRecordQueueLagMs: 0,
            peakRecordQueueLagMs: 0,
            averageWriterAppendMs: 0,
            peakWriterAppendMs: 0,
            overallDroppedFrames: null,
            overallDroppedFramePercent: null,
          },
          verdicts: {
            droppedFramesWithinTarget: null,
            averageCpuWithinTarget: null,
            achievedFpsWithinTarget: false,
            writerBackpressureClear: false,
            exact1080pDisplayMatched: null,
            retinaWindowMatched: null,
          },
          recordingURL: null,
          eventsURL: null,
          samples,
        };
      }
      if (!selectedWindow.supportedCaptureFrameRates.includes(scenario.captureFps)) {
        return {
          runIndex,
          id: scenario.id,
          name: scenario.name,
          status: "skipped",
          captureType: scenario.captureType,
          enableMic: scenario.enableMic,
          trackInputEvents: scenario.trackInputEvents,
          captureFps: scenario.captureFps,
          startupThresholds,
          thresholds: scenarioThresholds,
          startup,
          durationSeconds: 0,
          source: buildSourceDetails(selectedWindow, {
            windowId: selectedWindow.id,
            title: selectedWindow.title,
            appName: selectedWindow.appName,
          }),
          effectivePixelCount: effectivePixelCountForSource({
            width: selectedWindow.width,
            height: selectedWindow.height,
            pixelScale: null,
          }),
          inputTracking: {
            cursorEventsObserved: null,
            cursorEventsEmitted: null,
            clickEventsEmitted: null,
          },
          notes: [
            `Selected window source ${selectedWindow.id}: ${selectedWindow.appName} — ${selectedWindow.title}.`,
            `Window source does not advertise support for ${scenario.captureFps} fps; supported values are ${selectedWindow.supportedCaptureFrameRates.join(", ")}.`,
          ],
          finalTelemetry: null,
          aggregates: {
            averageAchievedFps: 0,
            minimumAchievedFps: 0,
            averageCpuPercent: null,
            peakCpuPercent: null,
            averageMemoryBytes: null,
            peakMemoryBytes: null,
            averageCaptureCallbackMs: 0,
            peakCaptureCallbackMs: 0,
            averageRecordQueueLagMs: 0,
            peakRecordQueueLagMs: 0,
            averageWriterAppendMs: 0,
            peakWriterAppendMs: 0,
            overallDroppedFrames: null,
            overallDroppedFramePercent: null,
          },
          verdicts: {
            droppedFramesWithinTarget: null,
            averageCpuWithinTarget: null,
            achievedFpsWithinTarget: false,
            writerBackpressureClear: false,
            exact1080pDisplayMatched: null,
            retinaWindowMatched: null,
          },
          recordingURL: null,
          eventsURL: null,
          samples,
        };
      }
      notes.push(
        `Selected window source ${selectedWindow.id}: ${selectedWindow.appName} — ${selectedWindow.title}.`,
      );
    }

    const permissions = await ensurePermissions(engine, scenario);
    notes.push(
      `Permissions: screen=${permissions.screenRecordingGranted}, mic=${permissions.microphoneGranted}, input=${permissions.inputMonitoring}.`,
    );

    if (scenario.captureType === "display") {
      await withTimeout(
        engine.startDisplayCapture(scenario.enableMic, scenario.captureFps),
        15_000,
        "startDisplayCapture",
      );
    } else if (selectedWindow) {
      await withTimeout(
        engine.startWindowCapture(selectedWindow.id, scenario.enableMic, scenario.captureFps),
        15_000,
        "startWindowCapture",
      );
    }

    if (options.warmupMs > 0) {
      await sleep(options.warmupMs);
    }

    const startupStartedAt = performance.now();
    finalStatus = await withTimeout(
      engine.startRecording(scenario.trackInputEvents),
      15_000,
      "startRecording",
    );
    startup = {
      primingMs: performance.now() - startupStartedAt,
      status: "failed",
      writerBackpressureDrops: finalStatus?.telemetry.writerBackpressureDrops ?? 0,
    };
    const sampleStart = performance.now();
    const sampleDeadline = sampleStart + options.durationSeconds * 1_000;

    while (performance.now() < sampleDeadline) {
      const status = await engine.captureStatus();
      finalStatus = status;
      samples.push({
        relativeSeconds: (performance.now() - sampleStart) / 1_000,
        telemetry: status.telemetry,
      });
      await sleep(options.pollIntervalMs);
    }

    finalStatus = await withTimeout(engine.stopRecording(), 15_000, "stopRecording");
    const recordingStatus = finalStatus;
    await withTimeout(engine.stopCapture(), 15_000, "stopCapture");
    const inputTracking = await loadInputTrackingDiagnostics(recordingStatus.eventsURL);

    const sourceMetadata = recordingStatus.captureMetadata;
    const source =
      sourceMetadata
        ? buildSourceDetails(
            scenario.captureType === "display" ? selectedDisplay : selectedWindow,
            {
              displayId:
                scenario.captureType === "display" && selectedDisplay ? selectedDisplay.id : undefined,
              windowId: sourceMetadata.window?.id,
              title: sourceMetadata.window?.title ?? undefined,
              appName: sourceMetadata.window?.appName ?? undefined,
              width: sourceMetadata.contentRect.width,
              height: sourceMetadata.contentRect.height,
              pixelScale: sourceMetadata.pixelScale,
            },
          )
        : selectedDisplay
          ? buildSourceDetails(selectedDisplay, {
              displayId: selectedDisplay.id,
            })
          : selectedWindow
            ? buildSourceDetails(selectedWindow, {
                windowId: selectedWindow.id,
                title: selectedWindow.title,
                appName: selectedWindow.appName,
              })
            : null;
    const steadySamples = toSteadyStateSamples(samples);
    const averageAchievedFps =
      mean(steadySamples.map((sample) => sample.telemetry.achievedFps)) ?? 0;
    const minimumAchievedFps = minimum(
      steadySamples.map((sample) => sample.telemetry.achievedFps),
    );
    const averageCpuPercent = mean(
      steadySamples
        .map((sample) => sample.telemetry.cpuPercent)
        .filter((value): value is number => value !== null),
    );
    const peakCpuPercent = maximum(
      steadySamples
        .map((sample) => sample.telemetry.cpuPercent)
        .filter((value): value is number => value !== null),
    );
    const averageMemoryBytes = mean(
      steadySamples
        .map((sample) => sample.telemetry.memoryBytes)
        .filter((value): value is number => value !== null),
    );
    const peakMemoryBytes = maximum(
      steadySamples
        .map((sample) => sample.telemetry.memoryBytes)
        .filter((value): value is number => value !== null),
    );
    const averageCaptureCallbackMs =
      mean(steadySamples.map((sample) => sample.telemetry.captureCallbackMs)) ?? 0;
    const peakCaptureCallbackMs =
      maximum(steadySamples.map((sample) => sample.telemetry.captureCallbackMs)) ?? 0;
    const averageRecordQueueLagMs =
      mean(steadySamples.map((sample) => sample.telemetry.recordQueueLagMs)) ?? 0;
    const peakRecordQueueLagMs =
      maximum(steadySamples.map((sample) => sample.telemetry.recordQueueLagMs)) ?? 0;
    const averageWriterAppendMs =
      mean(steadySamples.map((sample) => sample.telemetry.writerAppendMs)) ?? 0;
    const peakWriterAppendMs =
      maximum(steadySamples.map((sample) => sample.telemetry.writerAppendMs)) ?? 0;
    const overallDroppedFrames =
      recordingStatus.telemetry.sourceDroppedFrames + recordingStatus.telemetry.writerDroppedFrames;
    const expectedFrames = Math.max(
      1,
      recordingStatus.recordingDurationSeconds * Number(scenario.captureFps),
    );
    const overallDroppedFramePercent = (overallDroppedFrames / expectedFrames) * 100;
    const retinaWindowMatched =
      scenario.captureType === "window" ? (sourceMetadata?.pixelScale ?? 0) > 1 : null;
    const effectivePixelCount = effectivePixelCountForSource(source);

    startup = {
      primingMs: startup.primingMs,
      status:
        (startup.primingMs ?? Number.POSITIVE_INFINITY) <= startupThresholds.maxPrimingMs &&
        recordingStatus.telemetry.writerBackpressureDrops <= startupThresholds.maxWriterBackpressureDrops
          ? "passed"
          : "failed",
      writerBackpressureDrops: recordingStatus.telemetry.writerBackpressureDrops,
    };

    const verdicts: ScenarioVerdicts = {
      droppedFramesWithinTarget:
        Number.isFinite(overallDroppedFramePercent)
          ? overallDroppedFramePercent <= scenarioThresholds.maxDroppedFramePercent
          : null,
      averageCpuWithinTarget:
        averageCpuPercent === null ? null : averageCpuPercent <= scenarioThresholds.maxAverageCpuPercent,
      achievedFpsWithinTarget: averageAchievedFps >= scenarioThresholds.minAchievedFps,
      writerBackpressureClear:
        recordingStatus.telemetry.writerBackpressureDrops <=
        scenarioThresholds.maxWriterBackpressureDrops,
      exact1080pDisplayMatched: scenario.captureType === "display" ? exact1080pMatched : null,
      retinaWindowMatched,
    };

    const passed =
      startup.status === "passed" &&
      verdicts.droppedFramesWithinTarget !== false &&
      verdicts.averageCpuWithinTarget !== false &&
      verdicts.achievedFpsWithinTarget &&
      verdicts.writerBackpressureClear;

    return {
      runIndex,
      id: scenario.id,
      name: scenario.name,
      status: passed ? "passed" : "failed",
      captureType: scenario.captureType,
      enableMic: scenario.enableMic,
      trackInputEvents: scenario.trackInputEvents,
      captureFps: scenario.captureFps,
      startupThresholds,
      thresholds: scenarioThresholds,
      startup,
      durationSeconds: recordingStatus.recordingDurationSeconds,
      source,
      effectivePixelCount,
      inputTracking,
      notes,
      finalTelemetry: recordingStatus.telemetry,
      aggregates: {
        averageAchievedFps,
        minimumAchievedFps,
        averageCpuPercent,
        peakCpuPercent,
        averageMemoryBytes,
        peakMemoryBytes,
        averageCaptureCallbackMs,
        peakCaptureCallbackMs,
        averageRecordQueueLagMs,
        peakRecordQueueLagMs,
        averageWriterAppendMs,
        peakWriterAppendMs,
        overallDroppedFrames,
        overallDroppedFramePercent,
      },
      verdicts,
      recordingURL: recordingStatus.recordingURL,
      eventsURL: recordingStatus.eventsURL,
      samples,
    };
  } catch (error) {
    await stopCaptureSession(engine);

    return {
      runIndex,
      id: scenario.id,
      name: scenario.name,
      status: "error",
      captureType: scenario.captureType,
      enableMic: scenario.enableMic,
      trackInputEvents: scenario.trackInputEvents,
      captureFps: scenario.captureFps,
      startupThresholds,
      thresholds: scenarioThresholds,
      startup: {
        ...startup,
        status: "error",
      },
      durationSeconds: (performance.now() - startedAt) / 1_000,
      source: selectedDisplay
        ? buildSourceDetails(selectedDisplay, {
            displayId: selectedDisplay.id,
          })
        : selectedWindow
          ? buildSourceDetails(selectedWindow, {
              windowId: selectedWindow.id,
              title: selectedWindow.title,
              appName: selectedWindow.appName,
            })
          : null,
      effectivePixelCount: effectivePixelCountForSource(
        selectedDisplay
          ? { width: selectedDisplay.width, height: selectedDisplay.height, pixelScale: 1 }
          : selectedWindow
            ? { width: selectedWindow.width, height: selectedWindow.height, pixelScale: null }
            : null,
      ),
      inputTracking: {
        cursorEventsObserved: null,
        cursorEventsEmitted: null,
        clickEventsEmitted: null,
      },
      notes,
      finalTelemetry: finalStatus?.telemetry ?? null,
      aggregates: {
        averageAchievedFps: 0,
        minimumAchievedFps: 0,
        averageCpuPercent: null,
        peakCpuPercent: null,
        averageMemoryBytes: null,
        peakMemoryBytes: null,
        averageCaptureCallbackMs: 0,
        peakCaptureCallbackMs: 0,
        averageRecordQueueLagMs: 0,
        peakRecordQueueLagMs: 0,
        averageWriterAppendMs: 0,
        peakWriterAppendMs: 0,
        overallDroppedFrames: null,
        overallDroppedFramePercent: null,
      },
      verdicts: {
        droppedFramesWithinTarget: null,
        averageCpuWithinTarget: null,
        achievedFpsWithinTarget: false,
        writerBackpressureClear: false,
        exact1080pDisplayMatched: exact1080pMatched,
        retinaWindowMatched: null,
      },
      recordingURL: finalStatus?.recordingURL ?? null,
      eventsURL: finalStatus?.eventsURL ?? null,
      samples,
      failure: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runScenarioSeries(
  engine: EngineClient,
  scenario: ScenarioConfig,
  options: { durationSeconds: number; pollIntervalMs: number; warmupMs: number },
): Promise<ScenarioSeriesReport> {
  const runs: ScenarioReport[] = [];
  for (let runIndex = 1; runIndex <= 3; runIndex += 1) {
    const runReport = await runScenarioRun(engine, scenario, options, runIndex);
    runs.push(runReport);
    if (runReport.status === "skipped") {
      break;
    }
  }

  const firstRun = runs[0];
  const averageAchievedFps = mean(runs.map((run) => run.aggregates.averageAchievedFps)) ?? 0;
  const overallDroppedFramePercent = mean(
    runs
      .map((run) => run.aggregates.overallDroppedFramePercent)
      .filter((value): value is number => value !== null),
  );
  const averageCpuPercent = mean(
    runs
      .map((run) => run.aggregates.averageCpuPercent)
      .filter((value): value is number => value !== null),
  );
  const worstStartupPrimingMs = maximum(
    runs.map((run) => run.startup.primingMs).filter((value): value is number => value !== null),
  );
  const cursorEventsObserved = mean(
    runs
      .map((run) => run.inputTracking.cursorEventsObserved)
      .filter((value): value is number => value !== null),
  );
  const cursorEventsEmitted = mean(
    runs
      .map((run) => run.inputTracking.cursorEventsEmitted)
      .filter((value): value is number => value !== null),
  );

  const status =
    runs[0]?.status === "skipped"
      ? "skipped"
      : runs.every((run) => run.status === "passed")
        ? "passed"
        : runs.some((run) => run.status === "error")
          ? "error"
          : "failed";

  return {
    id: scenario.id,
    name: scenario.name,
    status,
    captureType: scenario.captureType,
    enableMic: scenario.enableMic,
    trackInputEvents: scenario.trackInputEvents,
    captureFps: scenario.captureFps,
    startupThresholds: startupThresholdsForCaptureFrameRate(scenario.captureFps),
    thresholds: thresholdsForCaptureFrameRate(scenario.captureFps),
    source: firstRun?.source ?? null,
    runs,
    summary: {
      worstStartupPrimingMs,
      averageAchievedFps,
      overallDroppedFramePercent,
      averageCpuPercent,
      cursorEventsObserved,
      cursorEventsEmitted,
    },
  };
}

function buildMarkdownReport(report: BenchmarkReport) {
  const lines = [
    "# Capture Benchmark Report",
    "",
    `Generated: ${report.generatedAt}`,
    `Machine: ${report.machine.hostname} (${report.machine.platform} ${report.machine.arch}, macOS ${report.machine.release})`,
    `Engine: \`${report.enginePath}\``,
    "",
    "## Thresholds",
    "",
    `- Startup 60 fps: priming <= ${report.thresholds.startup60.maxPrimingMs} ms, writer backpressure <= ${report.thresholds.startup60.maxWriterBackpressureDrops}`,
    `- Startup 120 fps: priming <= ${report.thresholds.startup120.maxPrimingMs} ms, writer backpressure <= ${report.thresholds.startup120.maxWriterBackpressureDrops}`,
    `- 60 fps: dropped <= ${report.thresholds.fps60.maxDroppedFramePercent.toFixed(2)}%, CPU <= ${report.thresholds.fps60.maxAverageCpuPercent.toFixed(2)}%, achieved FPS >= ${report.thresholds.fps60.minAchievedFps.toFixed(2)}, writer backpressure <= ${report.thresholds.fps60.maxWriterBackpressureDrops}`,
    `- 120 fps: dropped <= ${report.thresholds.fps120.maxDroppedFramePercent.toFixed(2)}%, CPU <= ${report.thresholds.fps120.maxAverageCpuPercent.toFixed(2)}%, achieved FPS >= ${report.thresholds.fps120.minAchievedFps.toFixed(2)}, writer backpressure <= ${report.thresholds.fps120.maxWriterBackpressureDrops}`,
    "",
    "## Scenarios",
    "",
    "| Scenario | Status | Target FPS | Source | Refresh Hz | Supported FPS | Worst startup ms | Avg FPS | Drop % | Avg CPU |",
    "| --- | --- | ---: | --- | ---: | --- | ---: | ---: | ---: | ---: |",
  ];

  for (const scenario of report.scenarios) {
    const sourceLabel = scenario.source
      ? `${Math.round(scenario.source.width)}x${Math.round(scenario.source.height)} @ ${scenario.source.pixelScale ?? "n/a"}x`
      : "n/a";
    lines.push(
      `| ${scenario.id} | ${scenario.status} | ${scenario.captureFps} | ${sourceLabel} | ${formatDecimal(scenario.source?.refreshHz ?? null)} | ${scenario.source?.supportedCaptureFrameRates.join(", ") || "n/a"} | ${formatDecimal(scenario.summary.worstStartupPrimingMs)} | ${formatDecimal(scenario.summary.averageAchievedFps)} | ${formatDecimal(scenario.summary.overallDroppedFramePercent)} | ${formatDecimal(scenario.summary.averageCpuPercent)} |`,
    );
  }

  for (const scenario of report.scenarios) {
    lines.push("");
    lines.push(`### ${scenario.id}`);
    lines.push("");
    lines.push(`- Status: ${scenario.status}`);
    if (scenario.source) {
      lines.push(
        `- Source: ${Math.round(scenario.source.width)}x${Math.round(scenario.source.height)} at pixel scale ${scenario.source.pixelScale ?? "n/a"}`,
      );
      lines.push(`- Refresh rate: ${formatDecimal(scenario.source.refreshHz)} Hz`);
      lines.push(
        `- Supported capture frame rates: ${scenario.source.supportedCaptureFrameRates.join(", ") || "n/a"}`,
      );
    }
    lines.push(`- Target FPS: ${scenario.captureFps}`);
    lines.push(`- Worst startup priming: ${formatDecimal(scenario.summary.worstStartupPrimingMs)} ms`);
    lines.push(`- Average FPS across runs: ${formatDecimal(scenario.summary.averageAchievedFps)}`);
    lines.push(
      `- Average dropped frame percent across runs: ${formatDecimal(scenario.summary.overallDroppedFramePercent)}%`,
    );
    lines.push(`- Average CPU across runs: ${formatDecimal(scenario.summary.averageCpuPercent)}%`);
    lines.push(
      `- Cursor events observed/emitted: ${formatDecimal(scenario.summary.cursorEventsObserved, 0)} / ${formatDecimal(scenario.summary.cursorEventsEmitted, 0)}`,
    );
    for (const run of scenario.runs) {
      lines.push(`- Run ${run.runIndex}: ${run.status}`);
      if (run.failure) {
        lines.push(`  - Failure: ${run.failure}`);
      }
      lines.push(`  - Startup priming: ${formatDecimal(run.startup.primingMs)} ms (${run.startup.status})`);
      lines.push(`  - Duration: ${formatDecimal(run.durationSeconds)} s`);
      lines.push(`  - Effective pixel count: ${formatDecimal(run.effectivePixelCount, 0)}`);
      lines.push(`  - Average FPS: ${formatDecimal(run.aggregates.averageAchievedFps)}`);
      lines.push(
        `  - Dropped frames: ${run.aggregates.overallDroppedFrames ?? "n/a"} (${formatDecimal(run.aggregates.overallDroppedFramePercent)}%)`,
      );
      lines.push(`  - Average CPU: ${formatDecimal(run.aggregates.averageCpuPercent)}%`);
      lines.push(`  - Peak CPU: ${formatDecimal(run.aggregates.peakCpuPercent)}%`);
      lines.push(`  - Average memory: ${formatBytes(run.aggregates.averageMemoryBytes)}`);
      lines.push(`  - Peak memory: ${formatBytes(run.aggregates.peakMemoryBytes)}`);
      lines.push(
        `  - Average capture callback: ${formatDecimal(run.aggregates.averageCaptureCallbackMs)} ms`,
      );
      lines.push(
        `  - Average record queue lag: ${formatDecimal(run.aggregates.averageRecordQueueLagMs)} ms`,
      );
      lines.push(
        `  - Average writer append: ${formatDecimal(run.aggregates.averageWriterAppendMs)} ms`,
      );
      lines.push(`  - Writer backpressure drops: ${run.finalTelemetry?.writerBackpressureDrops ?? "n/a"}`);
      lines.push(
        `  - Cursor observed/emitted/clicks: ${formatDecimal(run.inputTracking.cursorEventsObserved, 0)} / ${formatDecimal(run.inputTracking.cursorEventsEmitted, 0)} / ${formatDecimal(run.inputTracking.clickEventsEmitted, 0)}`,
      );
      if (run.notes.length > 0) {
        lines.push("  - Notes:");
        for (const note of run.notes) {
          lines.push(`    - ${note}`);
        }
      }
    }
  }

  return `${lines.join("\n")}\n`;
}

async function writeReports(report: BenchmarkReport, outputDir: string) {
  const timestamp = report.generatedAt.replaceAll(":", "-");
  const reportDir = path.join(outputDir, timestamp);
  await mkdir(reportDir, { recursive: true });

  const jsonPath = path.join(reportDir, "report.json");
  const markdownPath = path.join(reportDir, "report.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, buildMarkdownReport(report), "utf8");

  return { reportDir, jsonPath, markdownPath };
}

async function main() {
  const config = parseArgs(process.argv.slice(2));
  const enginePath = resolveEnginePath();
  const engine = new EngineClient(enginePath);
  const scenarioReports: ScenarioSeriesReport[] = [];

  try {
    for (const scenario of config.scenarios) {
      console.log(`Running ${scenario.id}...`);
      const report = await runScenarioSeries(engine, scenario, config);
      scenarioReports.push(report);
      console.log(
        `Finished ${scenario.id}: ${report.status} (runs=${report.runs.length}, avg fps=${formatDecimal(report.summary.averageAchievedFps)}, drop=${formatDecimal(report.summary.overallDroppedFramePercent)}%, cpu=${formatDecimal(report.summary.averageCpuPercent)}%)`,
      );
    }
  } finally {
    await stopCaptureSession(engine);
    await engine.stop();
  }

  const report: BenchmarkReport = {
    generatedAt: new Date().toISOString(),
    machine: {
      hostname: os.hostname(),
      platform: process.platform,
      arch: process.arch,
      cpus: os.cpus().length,
      release: os.release(),
    },
    enginePath,
    config: {
      durationSeconds: config.durationSeconds,
      pollIntervalMs: config.pollIntervalMs,
      warmupMs: config.warmupMs,
    },
    thresholds,
    scenarios: scenarioReports,
  };

  const outputs = await writeReports(report, config.outputDir);
  console.log(`Benchmark report written to ${outputs.reportDir}`);
  console.log(`JSON: ${outputs.jsonPath}`);
  console.log(`Markdown: ${outputs.markdownPath}`);
}

await main();
