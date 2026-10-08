import { describe, expect, test } from "vitest";
import type { CaptureStatusResult } from "@guerillaglass/engine-contract/domains/capture";
import type { ProjectState } from "@guerillaglass/engine-contract/domains/project";
import { EngineResponseError } from "@guerillaglass/engine-client/errors";
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
    const status = { lastRecordingTelemetry: undefined } satisfies Pick<
      CaptureStatusResult,
      "lastRecordingTelemetry"
    >;
    const project = {
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
    } satisfies Pick<ProjectState, "lastRecordingTelemetry">;

    expect(resolveCompletedRecordingTelemetry(status, project)?.achievedFps).toBe(28.9);
  });

  test("preserves finished recording telemetry when stopCapture drops it", () => {
    const stoppedStatus = {
      isRunning: false,
      isRecording: false,
      recordingDurationSeconds: 25,
      telemetry: {},
    } satisfies CaptureStatusResult;
    const recordingStopStatus = {
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
    } satisfies Pick<CaptureStatusResult, "lastRecordingTelemetry">;
    const merged = mergeFinishedCaptureStatus(stoppedStatus, recordingStopStatus);

    expect(merged.lastRecordingTelemetry?.achievedFps).toBe(28.9);
  });
});
