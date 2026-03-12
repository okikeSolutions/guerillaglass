import { describe, expect, test } from "bun:test";
import { parseCaptureStatusEvent } from "../src/mainview/app/studio/hooks/core/useStudioDataQueries";

describe("studio capture status stream events", () => {
  test("parses valid capture status payloads", () => {
    const event = new CustomEvent("gg-host-capture-status", {
      detail: {
        captureStatus: {
          isRunning: true,
          isRecording: true,
          recordingDurationSeconds: 12.5,
          recordingURL: "/tmp/recording.mov",
          captureMetadata: null,
          lastError: null,
          eventsURL: null,
          telemetry: {
            sourceDroppedFrames: 1,
            writerDroppedFrames: 1,
            writerBackpressureDrops: 0,
            achievedFps: 59.7,
            cpuPercent: 14.2,
            memoryBytes: 512_000_000,
            recordingBitrateMbps: 26.4,
            captureCallbackMs: 0.42,
            recordQueueLagMs: 0.18,
            writerAppendMs: 1.11,
          },
        },
      },
    });

    const captureStatus = parseCaptureStatusEvent(event);
    expect(captureStatus?.isRecording).toBe(true);
    expect(captureStatus?.telemetry.recordingBitrateMbps).toBe(26.4);
  });

  test("returns null when event payload is invalid", () => {
    const invalid = new CustomEvent("gg-host-capture-status", {
      detail: {
        captureStatus: {
          isRunning: true,
        },
      },
    });
    expect(parseCaptureStatusEvent(invalid)).toBeNull();
    expect(parseCaptureStatusEvent(new Event("gg-host-capture-status"))).toBeNull();
  });
});
