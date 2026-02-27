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
            totalFrames: 120,
            droppedFrames: 2,
            droppedFramePercent: 1.66,
            sourceDroppedFrames: 1,
            sourceDroppedFramePercent: 0.83,
            writerDroppedFrames: 1,
            writerBackpressureDrops: 0,
            writerDroppedFramePercent: 0.83,
            achievedFps: 59.7,
            cpuPercent: 14.2,
            memoryBytes: 512_000_000,
            recordingBitrateMbps: 26.4,
            audioLevelDbfs: -7.5,
            health: "good",
            healthReason: null,
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
