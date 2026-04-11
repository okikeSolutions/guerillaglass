import { describe, expect, test } from "bun:test";
import { Cause, Effect, Exit, ManagedRuntime, Option } from "effect";
import { EngineOperationError } from "@shared/errors";
import { EngineTransport, makeEngineTransportLive } from "../src/bun/engine/service";

function createEngineClientStub(overrides: Partial<Record<string, unknown>> = {}) {
  const makeCaptureStatus = (isRunning: boolean) => ({
    isRunning,
    isRecording: false,
    captureSessionId: isRunning ? "capture-session-1" : null,
    recordingDurationSeconds: 0,
    recordingURL: null,
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
    },
  });
  return {
    start: async () => {},
    stop: async () => {},
    ping: async () => ({
      app: "guerillaglass",
      engineVersion: "0.0.0-test",
      protocolVersion: "2",
      platform: "test",
    }),
    getPermissions: async () => ({
      screenRecordingGranted: true,
      microphoneGranted: true,
      inputMonitoring: "authorized",
    }),
    agentPreflight: async () => ({
      ready: true,
      blockingReasons: [],
      canApplyDestructive: true,
      preflightToken: "token",
    }),
    agentRun: async () => ({
      jobId: "job-1",
      status: "queued",
      blockingReason: null,
    }),
    agentStatus: async () => ({
      jobId: "job-1",
      status: "queued",
      blockingReason: null,
    }),
    agentApply: async () => ({ success: true }),
    requestScreenRecordingPermission: async () => ({ success: true }),
    requestMicrophonePermission: async () => ({ success: true }),
    requestInputMonitoringPermission: async () => ({ success: true }),
    openInputMonitoringSettings: async () => ({ success: true }),
    listSources: async () => ({ displays: [], windows: [] }),
    startDisplayCapture: async () => makeCaptureStatus(true),
    startCurrentWindowCapture: async () => makeCaptureStatus(true),
    startWindowCapture: async () => makeCaptureStatus(true),
    stopCapture: async () => makeCaptureStatus(false),
    startRecording: async () => ({
      isRunning: true,
      isRecording: true,
      captureSessionId: "capture-session-1",
      recordingDurationSeconds: 0,
      recordingURL: null,
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
      },
    }),
    stopRecording: async () => ({
      isRunning: true,
      isRecording: false,
      recordingDurationSeconds: 0,
      recordingURL: null,
      lastError: null,
      eventsURL: null,
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
      },
    }),
    captureStatus: async () => ({
      isRunning: false,
      isRecording: false,
      recordingDurationSeconds: 0,
      recordingURL: null,
      lastError: null,
      eventsURL: null,
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
      },
    }),
    exportInfo: async () => ({ presets: [] }),
    runExport: async () => ({ outputURL: "/tmp/out.mp4" }),
    runCutPlanExport: async () => ({ outputURL: "/tmp/out.mp4" }),
    projectCurrent: async () => ({
      projectPath: null,
      recordingURL: null,
      eventsURL: null,
      autoZoom: {
        isEnabled: true,
        intensity: 1,
        minimumKeyframeInterval: 1 / 30,
      },
      captureMetadata: null,
    }),
    projectOpen: async () => ({
      projectPath: "/tmp/project.gglassproj",
      recordingURL: null,
      eventsURL: null,
      autoZoom: {
        isEnabled: true,
        intensity: 1,
        minimumKeyframeInterval: 1 / 30,
      },
      captureMetadata: null,
    }),
    projectSave: async () => ({
      projectPath: "/tmp/project.gglassproj",
      recordingURL: null,
      eventsURL: null,
      autoZoom: {
        isEnabled: true,
        intensity: 1,
        minimumKeyframeInterval: 1 / 30,
      },
      captureMetadata: null,
    }),
    projectRecents: async () => ({ items: [] }),
    ...overrides,
  };
}

async function readRuntimeFailure(
  runtime: ManagedRuntime.ManagedRuntime<EngineTransport, unknown>,
  effect: Effect.Effect<unknown, unknown, EngineTransport>,
): Promise<unknown> {
  const exit = await runtime.runPromiseExit(effect);
  if (Exit.isSuccess(exit)) {
    throw new Error("Expected runtime effect to fail");
  }
  const failure = Cause.failureOption(exit.cause);
  return Option.isSome(failure) ? failure.value : Cause.squash(exit.cause);
}

describe("engine transport service", () => {
  test("owns client startup and shutdown through the live layer", async () => {
    let started = 0;
    let stopped = 0;
    const runtime = ManagedRuntime.make(
      makeEngineTransportLive({
        createClient: () =>
          createEngineClientStub({
            start: async () => {
              started += 1;
            },
            stop: async () => {
              stopped += 1;
            },
          }) as never,
      }),
    );

    try {
      const ping = await runtime.runPromise(
        Effect.flatMap(EngineTransport, (transport) => transport.ping),
      );

      expect(ping.protocolVersion).toBe("2");
      expect(started).toBe(1);
    } finally {
      await runtime.dispose();
      expect(stopped).toBe(1);
    }
  });

  test("normalizes unexpected client failures into EngineOperationError", async () => {
    const runtime = ManagedRuntime.make(
      makeEngineTransportLive({
        createClient: () =>
          createEngineClientStub({
            ping: async () => {
              throw new Error("engine exploded");
            },
          }) as never,
      }),
    );

    try {
      const error = await readRuntimeFailure(
        runtime,
        Effect.flatMap(EngineTransport, (transport) => transport.ping),
      );
      expect(error).toBeInstanceOf(EngineOperationError);
    } finally {
      await runtime.dispose();
    }
  });
});
