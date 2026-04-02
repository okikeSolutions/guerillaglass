import { describe, expect, test } from "bun:test";
import { Effect, Fiber, Layer, TestClock, TestContext } from "effect";
import { EngineOperationError } from "@shared/errors";
import { EngineTransport } from "../src/bun/engine/service";
import { MediaSourceService } from "../src/bun/media/service";
import { ReviewGateway } from "../src/bun/review/service";
import {
  createHostRuntime,
  HostCaptureStatusSink,
  makeCaptureStatusStreamEffect,
} from "../src/bun/runtime/hostRuntime";

function makeCaptureStatus(overrides: Partial<Record<string, unknown>> = {}) {
  return {
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
    ...overrides,
  };
}

describe("host runtime capture status stream", () => {
  test("uses status-driven cadence for successive capture polls", async () => {
    const polledAt: number[] = [];
    let callCount = 0;

    const testProgram = Effect.scoped(
      Effect.gen(function* () {
        const fiber = yield* Effect.forkScoped(makeCaptureStatusStreamEffect());
        yield* Effect.yieldNow();

        expect(polledAt).toEqual([0]);

        yield* TestClock.adjust("249 millis");
        expect(polledAt).toEqual([0]);

        yield* TestClock.adjust("1 millis");
        expect(polledAt).toEqual([0, 250]);

        yield* TestClock.adjust("499 millis");
        expect(polledAt).toEqual([0, 250]);

        yield* TestClock.adjust("1 millis");
        expect(polledAt).toEqual([0, 250, 750]);

        yield* Fiber.interrupt(fiber);
      }),
    ).pipe(
      Effect.provide(
        Layer.mergeAll(
          TestContext.TestContext,
          Layer.succeed(EngineTransport, {
            captureStatus: Effect.flatMap(TestClock.currentTimeMillis, (now) =>
              Effect.sync(() => {
                polledAt.push(now);
                callCount += 1;
                if (callCount === 1) {
                  return makeCaptureStatus({ isRunning: true, isRecording: true });
                }
                if (callCount === 2) {
                  return makeCaptureStatus({ isRunning: true, isRecording: false });
                }
                return makeCaptureStatus();
              }),
            ),
          } as never),
          Layer.succeed(HostCaptureStatusSink, {
            sendCaptureStatus: () => {},
          }),
        ),
      ),
    );

    await Effect.runPromise(testProgram);
  });

  test("backs off to one second after capture status failures", async () => {
    const attemptedAt: number[] = [];
    let callCount = 0;

    const testProgram = Effect.scoped(
      Effect.gen(function* () {
        const fiber = yield* Effect.forkScoped(makeCaptureStatusStreamEffect());
        yield* Effect.yieldNow();

        expect(attemptedAt).toEqual([0]);

        yield* TestClock.adjust("999 millis");
        expect(attemptedAt).toEqual([0]);

        yield* TestClock.adjust("1 millis");
        expect(attemptedAt).toEqual([0, 1000]);

        yield* Fiber.interrupt(fiber);
      }),
    ).pipe(
      Effect.provide(
        Layer.mergeAll(
          TestContext.TestContext,
          Layer.succeed(EngineTransport, {
            captureStatus: Effect.flatMap(TestClock.currentTimeMillis, (now) =>
              Effect.suspend(() => {
                attemptedAt.push(now);
                callCount += 1;
                if (callCount === 1) {
                  return Effect.fail(
                    new EngineOperationError({
                      operation: "capture.status",
                      description: "status probe failed",
                    }),
                  );
                }
                return Effect.succeed(makeCaptureStatus());
              }),
            ),
          } as never),
          Layer.succeed(HostCaptureStatusSink, {
            sendCaptureStatus: () => {},
          }),
        ),
      ),
    );

    await Effect.runPromise(testProgram);
  });

  test("stops polling once the runtime is disposed", async () => {
    const polledAt: number[] = [];

    const testProgram = Effect.scoped(
      Effect.gen(function* () {
        const fiber = yield* Effect.forkScoped(makeCaptureStatusStreamEffect());
        yield* Effect.yieldNow();
        expect(polledAt).toEqual([0]);

        yield* TestClock.adjust("250 millis");
        expect(polledAt).toEqual([0, 250]);

        yield* Fiber.interrupt(fiber);

        yield* TestClock.adjust("5 seconds");
        expect(polledAt).toEqual([0, 250]);
      }),
    ).pipe(
      Effect.provide(
        Layer.mergeAll(
          TestContext.TestContext,
          Layer.succeed(EngineTransport, {
            captureStatus: Effect.flatMap(TestClock.currentTimeMillis, (now) =>
              Effect.sync(() => {
                polledAt.push(now);
                return makeCaptureStatus({ isRunning: true, isRecording: true });
              }),
            ),
          } as never),
          Layer.succeed(HostCaptureStatusSink, {
            sendCaptureStatus: () => {},
          }),
        ),
      ),
    );

    await Effect.runPromise(testProgram);
  });

  test("shares one engine transport acquisition with the capture status worker", async () => {
    let acquisitions = 0;
    let releases = 0;

    const runtime = await createHostRuntime({
      sendCaptureStatus: () => {},
      engineTransportLayer: Layer.scoped(
        EngineTransport,
        Effect.acquireRelease(
          Effect.sync(() => {
            acquisitions += 1;
            return {
              captureStatus: Effect.succeed(makeCaptureStatus()),
            } as never;
          }),
          () =>
            Effect.sync(() => {
              releases += 1;
            }),
        ),
      ),
      reviewGatewayLayer: Layer.succeed(ReviewGateway, {} as never),
      mediaSourceServiceLayer: Layer.succeed(MediaSourceService, {} as never),
    });

    try {
      expect(acquisitions).toBe(1);
    } finally {
      await runtime.dispose();
      expect(releases).toBe(1);
    }
  });
});
