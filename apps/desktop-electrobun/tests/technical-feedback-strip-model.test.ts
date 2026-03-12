import { describe, expect, test } from "bun:test";
import type { CaptureTelemetry } from "@guerillaglass/engine-protocol";
import {
  buildTechnicalFeedbackMetrics,
  formatTelemetryMemoryBytes,
} from "../src/mainview/app/studio/model/technicalFeedbackStripModel";

const formatter = {
  formatInteger: (value: number) => value.toFixed(0),
  formatDecimal: (value: number) => value.toFixed(2),
};

const labels = {
  sourceDroppedFrames: "Source",
  writerDroppedFrames: "Writer",
  writerBackpressureDrops: "Backpressure",
  achievedFps: "FPS",
  cpuUsage: "CPU",
  memoryUsage: "Memory",
  recordingBitrate: "Bitrate",
  captureCallback: "Callback",
  recordQueueLag: "Queue Lag",
  writerAppend: "Append",
};

describe("technical feedback strip model", () => {
  test("builds fallback metrics when telemetry is unavailable", () => {
    const metrics = buildTechnicalFeedbackMetrics(undefined, labels, formatter);

    expect(metrics).toEqual([
      { id: "source-drops", label: "Source", value: "0", tone: "neutral" },
      { id: "writer-drops", label: "Writer", value: "0", tone: "neutral" },
      { id: "writer-backpressure", label: "Backpressure", value: "0", tone: "neutral" },
      { id: "achieved-fps", label: "FPS", value: "0.00 fps", tone: "neutral" },
      { id: "cpu-usage", label: "CPU", value: "-", tone: "neutral" },
      { id: "memory-usage", label: "Memory", value: "-", tone: "neutral" },
      { id: "recording-bitrate", label: "Bitrate", value: "-", tone: "neutral" },
      { id: "capture-callback", label: "Callback", value: "-", tone: "neutral" },
      { id: "record-queue-lag", label: "Queue Lag", value: "-", tone: "neutral" },
      { id: "writer-append", label: "Append", value: "-", tone: "neutral" },
    ]);
  });

  test("formats runtime metrics", () => {
    const telemetry = {
      sourceDroppedFrames: 3,
      writerDroppedFrames: 5,
      writerBackpressureDrops: 1,
      achievedFps: 58.6,
      cpuPercent: 23.451,
      memoryBytes: 1_610_612_736,
      recordingBitrateMbps: 37.291,
      captureCallbackMs: 0.48,
      recordQueueLagMs: 0.23,
      writerAppendMs: 1.72,
    } satisfies CaptureTelemetry;

    const metrics = buildTechnicalFeedbackMetrics(telemetry, labels, formatter);

    expect(metrics).toEqual([
      { id: "source-drops", label: "Source", value: "3", tone: "neutral" },
      { id: "writer-drops", label: "Writer", value: "5", tone: "neutral" },
      { id: "writer-backpressure", label: "Backpressure", value: "1", tone: "neutral" },
      { id: "achieved-fps", label: "FPS", value: "58.60 fps", tone: "neutral" },
      { id: "cpu-usage", label: "CPU", value: "23.45%", tone: "neutral" },
      { id: "memory-usage", label: "Memory", value: "1.50 GiB", tone: "neutral" },
      { id: "recording-bitrate", label: "Bitrate", value: "37.29 Mbps", tone: "neutral" },
      { id: "capture-callback", label: "Callback", value: "0.48 ms", tone: "neutral" },
      { id: "record-queue-lag", label: "Queue Lag", value: "0.23 ms", tone: "neutral" },
      { id: "writer-append", label: "Append", value: "1.72 ms", tone: "neutral" },
    ]);
  });

  test("formats memory in mebibytes below one gibibyte", () => {
    expect(formatTelemetryMemoryBytes(314_572_800, formatter)).toBe("300.00 MiB");
  });
});
