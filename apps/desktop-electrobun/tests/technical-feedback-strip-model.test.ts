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
  droppedFrames: "Dropped",
  cpuUsage: "CPU",
  memoryUsage: "Memory",
  recordingBitrate: "Bitrate",
  audioLevel: "Audio",
  health: "Health",
  good: "Good",
  warning: "Warning",
  critical: "Critical",
  healthReasonEngineError: "Engine Error",
  healthReasonHighDroppedFrameRate: "High Drops",
  healthReasonElevatedDroppedFrameRate: "Elevated Drops",
  healthReasonLowMicrophoneLevel: "Low Mic",
};

describe("technical feedback strip model", () => {
  test("builds fallback metrics when telemetry is unavailable", () => {
    const metrics = buildTechnicalFeedbackMetrics(undefined, labels, formatter);

    expect(metrics).toEqual([
      { id: "dropped-frames", label: "Dropped", value: "0 (0.00%)", tone: "neutral" },
      { id: "cpu-usage", label: "CPU", value: "-", tone: "neutral" },
      { id: "memory-usage", label: "Memory", value: "-", tone: "neutral" },
      { id: "recording-bitrate", label: "Bitrate", value: "-", tone: "neutral" },
      { id: "audio-level", label: "Audio", value: "-", tone: "neutral" },
      { id: "health", label: "Health", value: "Good", tone: "live" },
    ]);
  });

  test("formats runtime metrics and localized health reason", () => {
    const telemetry = {
      totalFrames: 420,
      droppedFrames: 8,
      droppedFramePercent: 1.9,
      sourceDroppedFrames: 3,
      sourceDroppedFramePercent: 0.7,
      writerDroppedFrames: 5,
      writerBackpressureDrops: 1,
      writerDroppedFramePercent: 1.2,
      achievedFps: 58.6,
      cpuPercent: 23.451,
      memoryBytes: 1_610_612_736,
      recordingBitrateMbps: 37.291,
      audioLevelDbfs: -9.42,
      health: "warning",
      healthReason: "low_microphone_level",
    } satisfies CaptureTelemetry;

    const metrics = buildTechnicalFeedbackMetrics(telemetry, labels, formatter);

    expect(metrics).toEqual([
      { id: "dropped-frames", label: "Dropped", value: "8 (1.90%)", tone: "neutral" },
      { id: "cpu-usage", label: "CPU", value: "23.45%", tone: "neutral" },
      { id: "memory-usage", label: "Memory", value: "1.50 GiB", tone: "neutral" },
      { id: "recording-bitrate", label: "Bitrate", value: "37.29 Mbps", tone: "neutral" },
      { id: "audio-level", label: "Audio", value: "-9.42 dBFS", tone: "neutral" },
      { id: "health", label: "Health", value: "Low Mic", tone: "selectedAlt" },
    ]);
  });

  test("formats memory in mebibytes below one gibibyte", () => {
    expect(formatTelemetryMemoryBytes(314_572_800, formatter)).toBe("300.00 MiB");
  });
});
