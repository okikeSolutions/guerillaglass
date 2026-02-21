import { describe, expect, test } from "bun:test";
import type { CaptureTelemetry } from "@guerillaglass/engine-protocol";
import {
  buildCaptureTelemetryPresentation,
  buildDroppedFramesTooltip,
} from "../src/mainview/app/studio/model/captureTelemetryViewModel";

const formatter = {
  formatInteger: (value: number) => value.toFixed(0),
  formatDecimal: (value: number) => value.toFixed(2),
};

describe("capture telemetry presentation", () => {
  test("builds a default presentation when telemetry is unavailable", () => {
    const presentation = buildCaptureTelemetryPresentation(undefined, formatter);

    expect(presentation).toEqual({
      droppedFrames: "0 (0.00%)",
      sourceDroppedFrames: "0 (0.00%)",
      writerDroppedFrames: "0 (0.00%)",
      writerBackpressureDrops: "0",
      achievedFps: "0.00 fps",
    });
  });

  test("formats telemetry values and builds tooltip content", () => {
    const telemetry = {
      totalFrames: 600,
      droppedFrames: 9,
      droppedFramePercent: 1.5,
      sourceDroppedFrames: 4,
      sourceDroppedFramePercent: 0.67,
      writerDroppedFrames: 5,
      writerBackpressureDrops: 2,
      writerDroppedFramePercent: 0.83,
      achievedFps: 59.8,
      audioLevelDbfs: null,
      health: "warning",
      healthReason: "elevated_dropped_frame_rate",
    } satisfies CaptureTelemetry;
    const presentation = buildCaptureTelemetryPresentation(telemetry, formatter);
    const tooltip = buildDroppedFramesTooltip(
      {
        droppedFrames: "Dropped",
        sourceDroppedFrames: "Source",
        writerDroppedFrames: "Writer",
        writerBackpressureDrops: "Backpressure",
        achievedFps: "FPS",
      },
      presentation,
    );

    expect(presentation).toEqual({
      droppedFrames: "9 (1.50%)",
      sourceDroppedFrames: "4 (0.67%)",
      writerDroppedFrames: "5 (0.83%)",
      writerBackpressureDrops: "2",
      achievedFps: "59.80 fps",
    });
    expect(tooltip).toBe(
      "Dropped: 9 (1.50%) | Source: 4 (0.67%) | Writer: 5 (0.83%) | Backpressure: 2 | FPS: 59.80 fps",
    );
  });
});
