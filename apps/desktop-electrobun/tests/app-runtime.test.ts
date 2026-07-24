import { describe, expect, test } from "vitest";
import { Effect, Fiber, Layer, Schema } from "effect";
import { captureSessionIdSchema } from "@guerillaglass/engine-contract/schema-primitives";
import {
  captureStatusResultSchema,
  type CaptureStatusResult,
} from "@guerillaglass/engine-contract/domains/capture";
import { CaptureService } from "@guerillaglass/engine-client/services/CaptureService";
import type { EngineDomainServices } from "@guerillaglass/engine-client/services/domainServices";
import { MediaSourceService } from "../src/bun/media/service";
import { ReviewGateway } from "../src/bun/review/service";
import { makeCaptureStatusPollingEffect } from "../src/bun/app/AppLayer";
import { DesktopShell } from "../src/bun/shell/DesktopShell";
import { ProjectSession } from "../src/bun/session/ProjectSession";
import { DesktopTempDirectory } from "../src/bun/security/DesktopTempDirectory";
import { makeDesktopAppRuntime } from "../src/bun/app/AppRuntime";

function makeCaptureStatus(overrides: Partial<CaptureStatusResult> = {}): CaptureStatusResult {
  const isRunning = overrides.isRunning === true;
  return captureStatusResultSchema.make({
    isRunning,
    isRecording: false,
    ...(isRunning ? { captureSessionId: captureSessionIdSchema.make("capture-session-1") } : {}),
    recordingDurationSeconds: 0,
    telemetry: {
      sourceDroppedFrames: 0,
      writerDroppedFrames: 0,
      writerBackpressureDrops: 0,
      achievedFps: 0,
      captureCallbackMs: 0,
      recordQueueLagMs: 0,
      writerAppendMs: 0,
    },
    ...overrides,
  });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("desktop app runtime capture status polling", () => {
  test("forwards capture status polling results", async () => {
    const delivered: CaptureStatusResult[] = [];
    const first = makeCaptureStatus({ isRunning: true, isRecording: true });
    const statusCodec = Schema.toCodecJson(captureStatusResultSchema);
    const decodeStatus = Schema.decodeUnknownSync(statusCodec);
    const encodeStatus = Schema.encodeUnknownSync(statusCodec);

    const fiber = Effect.runFork(
      makeCaptureStatusPollingEffect(0, 50).pipe(
        Effect.provide(
          Layer.mergeAll(
            Layer.succeed(CaptureService, {
              status: Effect.succeed(decodeStatus(first)),
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
      ) as Effect.Effect<void, never, never>,
    );

    await sleep(20);
    await Effect.runPromise(Fiber.interrupt(fiber));

    expect(delivered[0]).toEqual(encodeStatus(decodeStatus(first)));
  });

  test("continues when capture status polling fails", async () => {
    const delivered: CaptureStatusResult[] = [];

    const fiber = Effect.runFork(
      makeCaptureStatusPollingEffect(0, 50).pipe(
        Effect.provide(
          Layer.mergeAll(
            Layer.succeed(CaptureService, {
              status: Effect.fail("status probe failed"),
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
      ) as Effect.Effect<void, never, never>,
    );

    await sleep(20);
    await Effect.runPromise(Fiber.interrupt(fiber));

    expect(delivered).toEqual([]);
  });

  test("shares one engine domain service acquisition with the capture status worker", async () => {
    let acquisitions = 0;
    let releases = 0;

    const runtime = await makeDesktopAppRuntime({
      desktopShellLayer: Layer.succeed(DesktopShell, {
        start: () => Effect.void,
        publishCaptureStatus: () => Effect.void,
        publishReviewEvent: () => Effect.void,
        dispose: Effect.void,
      }),
      projectSessionLayer: Layer.succeed(ProjectSession, {} as never),
      desktopTempDirectoryLayer: Layer.succeed(DesktopTempDirectory, { path: "/tmp" }),
      engineDomainServicesLayer: Layer.effect(
        CaptureService,
        Effect.acquireRelease(
          Effect.suspend(() => {
            acquisitions += 1;
            return Effect.succeed({
              status: Effect.never,
            } as never);
          }),
          () =>
            Effect.sync(() => {
              releases += 1;
            }),
        ),
      ) as Layer.Layer<EngineDomainServices>,
      reviewGatewayLayer: Layer.succeed(ReviewGateway, {} as never),
      mediaSourceServiceLayer: Layer.succeed(MediaSourceService, {} as never),
    });

    expect(acquisitions).toBe(1);
    await runtime.dispose();
    expect(releases).toBe(1);
  });
});
