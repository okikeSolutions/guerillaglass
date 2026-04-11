import { describe, expect, test } from "bun:test";
import {
  benchmarkSceneWindow,
  collectBenchmarkFailures,
  compareBenchmarkReports,
  regressionThresholds,
  selectWindowSource,
  startupThresholdsForCaptureFrameRate,
  thresholds,
  thresholdsForCaptureFrameRate,
  type BenchmarkReport,
  type BenchmarkScenarioID,
  type ScenarioSeriesReport,
} from "../../../Scripts/capture_benchmark.ts";

function makeScenario(
  id: BenchmarkScenarioID,
  overrides?: Partial<ScenarioSeriesReport>,
): ScenarioSeriesReport {
  return {
    id,
    name: id,
    status: "passed",
    captureType: id.startsWith("display") ? "display" : "window",
    enableMic: false,
    enablePreview: true,
    trackInputEvents: false,
    captureFps: 30,
    startupThresholds: thresholds.startup30,
    thresholds: thresholds.fps30,
    source: {
      displayId: 1,
      windowId: undefined,
      title: undefined,
      appName: undefined,
      width: 3024,
      height: 1964,
      pixelScale: 2,
      refreshHz: 60,
      supportedCaptureFrameRates: [24, 30, 60],
    },
    runs: [],
    summary: {
      worstStartupPrimingMs: 220,
      averageAchievedFps: 29.8,
      overallDroppedFramePercent: 0.1,
      averageCpuPercent: 14,
      averageCaptureCallbackMs: 0.6,
      averageRecordQueueLagMs: 0.2,
      averageWriterAppendMs: 0.8,
      averagePreviewEncodeMs: 1.4,
      cursorEventsObserved: null,
      cursorEventsEmitted: null,
    },
    ...overrides,
  };
}

function makeReport(scenarios: ScenarioSeriesReport[]): BenchmarkReport {
  return {
    generatedAt: "2026-04-10T00:00:00.000Z",
    machine: {
      hostname: "bench-host",
      platform: "darwin",
      arch: "arm64",
      cpus: 8,
      release: "25.0.0",
    },
    enginePath: "/tmp/guerillaglass-engine",
    config: {
      durationSeconds: 10,
      pollIntervalMs: 500,
      warmupMs: 1000,
    },
    thresholds,
    scenarios,
  };
}

describe("capture benchmark policy", () => {
  test("covers the 30 fps default path with dedicated thresholds", () => {
    expect(startupThresholdsForCaptureFrameRate(30)).toEqual(thresholds.startup30);
    expect(thresholdsForCaptureFrameRate(30)).toEqual(thresholds.fps30);
    expect(thresholdsForCaptureFrameRate(24)).toEqual(thresholds.fps30);
  });

  test("collects non-passing scenarios as benchmark failures", () => {
    const report = makeReport([
      makeScenario("display-30-no-mic"),
      makeScenario("window-30-no-mic", { status: "failed" }),
      makeScenario("display-60-no-mic", { status: "error" }),
    ]);

    expect(collectBenchmarkFailures(report)).toEqual([
      {
        scenarioId: "window-30-no-mic",
        status: "failed",
        message: "window-30-no-mic finished with status failed.",
      },
      {
        scenarioId: "display-60-no-mic",
        status: "error",
        message: "display-60-no-mic finished with status error.",
      },
    ]);
  });

  test("flags same-machine regressions in FPS and native latency metrics", () => {
    const baseline = makeReport([
      makeScenario("display-30-no-mic"),
      makeScenario("window-30-no-mic"),
    ]);
    const candidate = makeReport([
      makeScenario("display-30-no-mic", {
        summary: {
          worstStartupPrimingMs: 360,
          averageAchievedFps: 28.5,
          overallDroppedFramePercent: 0.5,
          averageCpuPercent: 19.5,
          averageCaptureCallbackMs: 2.4,
          averageRecordQueueLagMs: 2.1,
          averageWriterAppendMs: 2.5,
          averagePreviewEncodeMs: 4.1,
          cursorEventsObserved: null,
          cursorEventsEmitted: null,
        },
      }),
      makeScenario("window-30-no-mic"),
    ]);

    const comparison = compareBenchmarkReports(baseline, candidate);

    expect(comparison.warnings).toHaveLength(0);
    expect(comparison.regressions.map((entry) => entry.metric)).toEqual([
      "averageAchievedFps",
      "overallDroppedFramePercent",
      "averageCpuPercent",
      "worstStartupPrimingMs",
      "averageCaptureCallbackMs",
      "averageRecordQueueLagMs",
      "averageWriterAppendMs",
      "averagePreviewEncodeMs",
    ]);
    expect(comparison.regressions[0]?.scenarioId).toBe("display-30-no-mic");
    expect(regressionThresholds.maxAverageFpsDrop).toBeGreaterThan(0);
  });

  test("prefers the dedicated animated benchmark window over arbitrary large windows", () => {
    const source = selectWindowSource(
      {
        displays: [],
        windows: [
          {
            id: 41,
            title: "package.json — guerillaglass",
            appName: "Code",
            width: 2200,
            height: 1400,
            isOnScreen: true,
            pixelScale: 2,
            refreshHz: 60,
            supportedCaptureFrameRates: [24, 30, 60],
          },
          {
            id: 55,
            title: "GG Capture Benchmark",
            appName: "Guerillaglass",
            width: 1440,
            height: 900,
            isOnScreen: true,
            pixelScale: 2,
            refreshHz: 60,
            supportedCaptureFrameRates: [24, 30, 60],
          },
        ],
      },
      benchmarkSceneWindow,
    );

    expect(source?.id).toBe(55);
  });
});
