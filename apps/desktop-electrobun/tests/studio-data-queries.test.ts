import { describe, expect, test } from "vitest";
import { captureStatusResultSchema } from "@guerillaglass/engine-contract/domains/capture";
import {
  captureSessionIdSchema,
  projectPathSchema,
  eventsUrlSchema,
  recordingUrlSchema,
} from "@guerillaglass/engine-contract/schema-primitives";
import {
  captureStatusResultsEqual,
  resolveStudioMediaSources,
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
    const previous = captureStatusResultSchema.make({
      isRunning: true,
      isRecording: false,
      captureSessionId: captureSessionIdSchema.make("capture-session-1"),
      recordingDurationSeconds: 12.5,
      recordingURL: recordingUrlSchema.make("/tmp/recording.mov"),
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
    });
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

describe("workspace media identity", () => {
  const staleCapture = {
    recordingURL: recordingUrlSchema.make("/tmp/old.mov"),
    eventsURL: eventsUrlSchema.make("/tmp/old.events"),
  };
  test("saved project sources take precedence over old capture state", () => {
    const project = {
      projectPath: projectPathSchema.make("/tmp/saved.gglassproj"),
      recordingURL: recordingUrlSchema.make("/tmp/saved.mov"),
      eventsURL: eventsUrlSchema.make("/tmp/saved.events"),
    };
    expect(resolveStudioMediaSources(project, staleCapture)).toEqual({
      recordingURL: project.recordingURL,
      eventsURL: project.eventsURL,
    });
  });
  test("missing saved sources do not fall back to another recording", () => {
    expect(
      resolveStudioMediaSources(
        { projectPath: projectPathSchema.make("/tmp/import.gglassproj") },
        staleCapture,
      ),
    ).toEqual({ recordingURL: null, eventsURL: null });
  });
  test("unsaved captures use the active recording", () => {
    expect(resolveStudioMediaSources(undefined, staleCapture)).toEqual(staleCapture);
  });
});
