import { describe, expect, test } from "bun:test";
import { EngineResponseError } from "@shared/errors";
import {
  isSelectedWindowUnavailableError,
  mergeFinishedCaptureStatus,
  resolveCompletedRecordingTelemetry,
} from "@studio/hooks/core/useStudioMutations";

describe("window capture fallback", () => {
  test("detects stale selected window capture failures", () => {
    const error = new EngineResponseError({
      code: "runtime_error",
      description: "The selected window is no longer available for capture.",
    });

    expect(isSelectedWindowUnavailableError(error)).toBe(true);
  });

  test("does not treat unrelated runtime errors as stale window failures", () => {
    const error = new EngineResponseError({
      code: "runtime_error",
      description: "Something else failed.",
    });

    expect(isSelectedWindowUnavailableError(error)).toBe(false);
  });

  test("prefers durable project telemetry when stop status summary is empty", () => {
    expect(
      resolveCompletedRecordingTelemetry(
        { lastRecordingTelemetry: null } as never,
        {
          lastRecordingTelemetry: {
            sourceDroppedFrames: 1,
            writerDroppedFrames: 0,
            writerBackpressureDrops: 0,
            achievedFps: 28.9,
            cpuPercent: 12.3,
            memoryBytes: 100,
            recordingBitrateMbps: 8.2,
            captureCallbackMs: 0.4,
            recordQueueLagMs: 0.2,
            writerAppendMs: 0.8,
            previewEncodeMs: 0.1,
          },
        } as never,
      )?.achievedFps,
    ).toBe(28.9);
  });

  test("preserves finished recording telemetry when stopCapture drops it", () => {
    const merged = mergeFinishedCaptureStatus(
      {
        isRunning: false,
        isRecording: false,
        captureSessionId: null,
        recordingDurationSeconds: 25,
        recordingURL: "/tmp/out.mov",
        captureMetadata: null,
        lastError: null,
        eventsURL: null,
        lastRecordingTelemetry: null,
        telemetry: {
          sourceDroppedFrames: 0,
          writerDroppedFrames: 0,
          writerBackpressureDrops: 0,
          achievedFps: 0,
          cpuPercent: null,
          memoryBytes: null,
          recordingBitrateMbps: null,
          captureCallbackMs: 0,
          recordQueueLagMs: 0,
          writerAppendMs: 0,
          previewEncodeMs: 0,
        },
      } as never,
      {
        lastRecordingTelemetry: {
          sourceDroppedFrames: 1,
          writerDroppedFrames: 0,
          writerBackpressureDrops: 0,
          achievedFps: 28.9,
          cpuPercent: 12.3,
          memoryBytes: 100,
          recordingBitrateMbps: 8.2,
          captureCallbackMs: 0.4,
          recordQueueLagMs: 0.2,
          writerAppendMs: 0.8,
          previewEncodeMs: 0.1,
        },
      } as never,
    );

    expect(merged.lastRecordingTelemetry?.achievedFps).toBe(28.9);
  });
});
