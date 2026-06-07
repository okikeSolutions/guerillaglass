import { describe, expect, it } from "@effect/vitest";
import { Effect, Fiber, Layer, Stream } from "effect";
import { type CaptureStatusResult } from "@guerillaglass/engine/protocol/domains/capture";
import { EngineTransport } from "@guerillaglass/engine/client/service";
import { MediaSourceService } from "../src/bun/media/service";
import { ReviewGateway } from "../src/bun/review/service";
import {
  createHostRuntime,
  HostCaptureStatusSink,
  makeCaptureStatusStreamEffect,
} from "../src/bun/runtime/hostRuntime";

function makeCaptureStatus(overrides: Partial<Record<string, unknown>> = {}): CaptureStatusResult {
  const isRunning = overrides.isRunning === true;
  return {
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
    ...overrides,
  };
}

describe("host runtime capture status stream", () => {
  it.effect("forwards capture status stream chunks", () =>
    Effect.gen(function* () {
      const delivered: CaptureStatusResult[] = [];
      const first = makeCaptureStatus({ isRunning: true, isRecording: true });
      const second = makeCaptureStatus({ isRunning: true, isRecording: false });

      yield* makeCaptureStatusStreamEffect().pipe(
        Effect.provide(
          Layer.mergeAll(
            Layer.succeed(EngineTransport, {
              "capture.statusStream": () => Stream.make(first, second),
            } as never),
            Layer.succeed(HostCaptureStatusSink, {
              sendCaptureStatus: (status: CaptureStatusResult) => {
                delivered.push(status);
              },
            }),
          ),
        ),
      );

      expect(delivered).toEqual([first, second]);
    }),
  );

  it.effect("logs and completes when capture status stream fails", () =>
    Effect.gen(function* () {
      const delivered: CaptureStatusResult[] = [];

      yield* makeCaptureStatusStreamEffect().pipe(
        Effect.provide(
          Layer.mergeAll(
            Layer.succeed(EngineTransport, {
              "capture.statusStream": () => Stream.fail("status probe failed"),
            } as never),
            Layer.succeed(HostCaptureStatusSink, {
              sendCaptureStatus: (status: CaptureStatusResult) => {
                delivered.push(status);
              },
            }),
          ),
        ),
      );

      expect(delivered).toEqual([]);
    }),
  );

  it.effect("stops forwarding once the stream fiber is interrupted", () =>
    Effect.gen(function* () {
      const delivered: CaptureStatusResult[] = [];

      yield* Effect.scoped(
        Effect.gen(function* () {
          const fiber = yield* Effect.forkScoped(makeCaptureStatusStreamEffect());
          yield* Effect.yieldNow;
          yield* Fiber.interrupt(fiber);
        }),
      ).pipe(
        Effect.provide(
          Layer.mergeAll(
            Layer.succeed(EngineTransport, {
              "capture.statusStream": () => Stream.never,
            } as never),
            Layer.succeed(HostCaptureStatusSink, {
              sendCaptureStatus: (status: CaptureStatusResult) => {
                delivered.push(status);
              },
            }),
          ),
        ),
      );

      expect(delivered).toEqual([]);
    }),
  );

  it.effect("shares one engine transport acquisition with the capture status worker", () =>
    Effect.gen(function* () {
      let acquisitions = 0;
      let releases = 0;

      const runtime = yield* Effect.promise(() =>
        createHostRuntime({
          sendCaptureStatus: () => {},
          engineTransportLayer: Layer.effect(
            EngineTransport,
            Effect.acquireRelease(
              Effect.suspend(() => {
                acquisitions += 1;
                return Effect.succeed({
                  "capture.statusStream": () => Stream.never,
                } as never);
              }),
              () =>
                Effect.sync(() => {
                  releases += 1;
                }),
            ),
          ),
          reviewGatewayLayer: Layer.succeed(ReviewGateway, {} as never),
          mediaSourceServiceLayer: Layer.succeed(MediaSourceService, {} as never),
        }),
      );

      expect(acquisitions).toBe(1);
      yield* Effect.promise(() => runtime.dispose());
      expect(releases).toBe(1);
    }),
  );
});
