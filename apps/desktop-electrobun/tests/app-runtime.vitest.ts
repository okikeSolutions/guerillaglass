import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Schema, Stream } from "effect";
import {
  captureStatusResultSchema,
  type CaptureStatusResult,
} from "@guerillaglass/engine/protocol/domains/capture";
import { EngineTransport } from "@guerillaglass/engine/client/service";
import { MediaSourceService } from "../src/bun/media/service";
import { ReviewGateway } from "../src/bun/review/service";
import { makeCaptureStatusStreamEffect } from "../src/bun/app/AppLayer";
import { DesktopShell } from "../src/bun/shell/DesktopShell";
import { ProjectSession } from "../src/bun/session/ProjectSession";
import { makeDesktopAppRuntime } from "../src/bun/app/AppRuntime";

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

describe("desktop app runtime capture status stream", () => {
  it.effect("forwards capture status stream chunks", () =>
    Effect.gen(function* () {
      const delivered: CaptureStatusResult[] = [];
      const first = makeCaptureStatus({ isRunning: true, isRecording: true });
      const second = makeCaptureStatus({ isRunning: true, isRecording: false });
      const statusCodec = Schema.toCodecJson(captureStatusResultSchema);
      const decodeStatus = Schema.decodeUnknownSync(statusCodec);
      const encodeStatus = Schema.encodeUnknownSync(statusCodec);

      yield* makeCaptureStatusStreamEffect().pipe(
        Effect.provide(
          Layer.mergeAll(
            Layer.succeed(EngineTransport, {
              "capture.statusStream": () => Stream.make(decodeStatus(first), decodeStatus(second)),
            } as never),
            Layer.succeed(DesktopShell, {
              start: () => Effect.void,
              publishCaptureStatus: (status: CaptureStatusResult) =>
                Effect.sync(() => {
                  delivered.push(status);
                }),
              publishReviewEvent: () => Effect.void,
              dispose: Effect.void,
            }),
          ),
        ),
      );

      expect(delivered).toEqual([
        encodeStatus(decodeStatus(first)),
        encodeStatus(decodeStatus(second)),
      ]);
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
            Layer.succeed(DesktopShell, {
              start: () => Effect.void,
              publishCaptureStatus: (status: CaptureStatusResult) =>
                Effect.sync(() => {
                  delivered.push(status);
                }),
              publishReviewEvent: () => Effect.void,
              dispose: Effect.void,
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
        makeDesktopAppRuntime({
          desktopShellLayer: Layer.succeed(DesktopShell, {
            start: () => Effect.void,
            publishCaptureStatus: () => Effect.void,
            publishReviewEvent: () => Effect.void,
            dispose: Effect.void,
          }),
          projectSessionLayer: Layer.succeed(ProjectSession, {} as never),
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
