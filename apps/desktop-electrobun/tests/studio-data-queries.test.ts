import { describe, expect, test } from "bun:test";
import {
  captureStatusResultsEqual,
  parseCaptureStatusEvent,
} from "@studio/hooks/core/useStudioDataQueries";

describe("studio capture status stream events", () => {
  test("parses valid capture status payloads", () => {
    const event = new CustomEvent("gg-host-capture-status", {
      detail: {
        captureStatus: {
          isRunning: true,
          isRecording: true,
          captureSessionId: "capture-session-1",
          recordingDurationSeconds: 12.5,
          recordingURL: "/tmp/recording.mov",
          captureMetadata: null,
          lastError: null,
          eventsURL: null,
          lastRecordingTelemetry: null,
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

  test("treats structurally identical capture status payloads as unchanged", () => {
    const previous = {
      isRunning: true,
      isRecording: false,
      captureSessionId: "capture-session-1",
      recordingDurationSeconds: 12.5,
      recordingURL: "/tmp/recording.mov",
      captureMetadata: null,
      lastError: null,
      eventsURL: null,
      lastRecordingTelemetry: {
        sourceDroppedFrames: 2,
        writerDroppedFrames: 0,
        writerBackpressureDrops: 0,
        achievedFps: 29.4,
        cpuPercent: 12.1,
        memoryBytes: 480_000_000,
        recordingBitrateMbps: 15.2,
        captureCallbackMs: 0.31,
        recordQueueLagMs: 0.14,
        writerAppendMs: 0.9,
      },
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
    };
    const next = structuredClone(previous);

    expect(captureStatusResultsEqual(previous, next)).toBe(true);
    expect(
      captureStatusResultsEqual(previous, {
        ...next,
        telemetry: {
          ...next.telemetry,
          achievedFps: 58.9,
        },
      }),
    ).toBe(false);
  });
});
