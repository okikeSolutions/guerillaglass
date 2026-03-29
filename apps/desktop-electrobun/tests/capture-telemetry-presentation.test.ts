import { describe, expect, test } from "bun:test";
import type { CaptureTelemetry } from "@guerillaglass/engine-protocol";
import {
  buildCaptureTelemetryPresentation,
  buildDroppedFramesTooltip,
} from "@studio/view-model/captureTelemetryViewModel";

const formatter = {
  formatInteger: (value: number) => value.toFixed(0),
  formatDecimal: (value: number) => value.toFixed(2),
};

describe("capture telemetry presentation", () => {
  test("builds a default presentation when telemetry is unavailable", () => {
    const presentation = buildCaptureTelemetryPresentation(undefined, formatter);

    expect(presentation).toEqual({
      sourceDroppedFrames: "0",
      writerDroppedFrames: "0",
      writerBackpressureDrops: "0",
      achievedFps: "0.00 fps",
      captureCallback: "0.00 ms",
      recordQueueLag: "0.00 ms",
      writerAppend: "0.00 ms",
    });
  });

  test("formats telemetry values and builds tooltip content", () => {
    const telemetry = {
      sourceDroppedFrames: 4,
      writerDroppedFrames: 5,
      writerBackpressureDrops: 2,
      achievedFps: 59.8,
      cpuPercent: null,
      memoryBytes: null,
      recordingBitrateMbps: null,
      captureCallbackMs: 0.44,
      recordQueueLagMs: 0.21,
      writerAppendMs: 1.37,
    } satisfies CaptureTelemetry;
    const presentation = buildCaptureTelemetryPresentation(telemetry, formatter);
    const tooltip = buildDroppedFramesTooltip(
      {
        sourceDroppedFrames: "Source",
        writerDroppedFrames: "Writer",
        writerBackpressureDrops: "Backpressure",
        achievedFps: "FPS",
        captureCallback: "Callback",
        recordQueueLag: "Queue Lag",
        writerAppend: "Append",
      },
      presentation,
    );

    expect(presentation).toEqual({
      sourceDroppedFrames: "4",
      writerDroppedFrames: "5",
      writerBackpressureDrops: "2",
      achievedFps: "59.80 fps",
      captureCallback: "0.44 ms",
      recordQueueLag: "0.21 ms",
      writerAppend: "1.37 ms",
    });
    expect(tooltip).toBe(
      "Source: 4 | Writer: 5 | Backpressure: 2 | FPS: 59.80 fps | Callback: 0.44 ms | Queue Lag: 0.21 ms | Append: 1.37 ms",
    );
  });
});
