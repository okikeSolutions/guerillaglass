import { describe, expect, test } from "vitest";
import { it } from "@effect/vitest";
import { EngineClientError } from "@guerillaglass/engine-client/errors";
import { Deferred, Effect, Layer, Queue, Schema } from "effect";
import { TestClock } from "effect/testing";
import { captureSessionIdSchema } from "@guerillaglass/engine-contract/schema-primitives";
import {
  captureStatusResultSchema,
  type CaptureStatusResult,
} from "@guerillaglass/engine-contract/domains/capture";
import { CaptureService } from "@guerillaglass/engine-client/services/CaptureService";
import { AgentService } from "@guerillaglass/engine-client/services/AgentService";
import { ExportService } from "@guerillaglass/engine-client/services/ExportService";
import { PermissionsService } from "@guerillaglass/engine-client/services/PermissionsService";
import { ProjectService } from "@guerillaglass/engine-client/services/ProjectService";
import { RecordingService } from "@guerillaglass/engine-client/services/RecordingService";
import { SourcesService } from "@guerillaglass/engine-client/services/SourcesService";
import { SystemService } from "@guerillaglass/engine-client/services/SystemService";
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

describe("desktop app runtime capture status polling", () => {
  it.effect("forwards capture status polling results", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const delivered = yield* Deferred.make<CaptureStatusResult>();
        const first = makeCaptureStatus({ isRunning: true, isRecording: true });
        const statusCodec = Schema.toCodecJson(captureStatusResultSchema);
        const decodedFirst = yield* Schema.decodeEffect(statusCodec)(first);
        const encodedFirst = yield* Schema.encodeUnknownEffect(statusCodec)(decodedFirst);

        yield* makeCaptureStatusPollingEffect(0, 50).pipe(
          Effect.provide(
            Layer.mergeAll(
              Layer.mock(CaptureService, {
                status: Effect.succeed(decodedFirst),
              }),
              Layer.succeed(DesktopShell, {
                start: () => Effect.void,
                publishCaptureStatus: (status: CaptureStatusResult) =>
                  Deferred.succeed(delivered, status).pipe(Effect.asVoid),
                publishReviewEvent: () => Effect.void,
                dispose: Effect.void,
              }),
            ),
          ),
          Effect.forkScoped,
        );

        expect(yield* Deferred.await(delivered)).toEqual(encodedFirst);
      }),
    ),
  );

  it.effect("continues when capture status polling fails", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const attempts = yield* Queue.unbounded<void>();
        const delivered = yield* Queue.unbounded<CaptureStatusResult>();

        yield* makeCaptureStatusPollingEffect(0, 50).pipe(
          Effect.provide(
            Layer.mergeAll(
              Layer.mock(CaptureService, {
                status: Queue.offer(attempts, undefined).pipe(
                  Effect.andThen(
                    Effect.fail(
                      new EngineClientError({
                        code: "ENGINE_HTTP_REQUEST_FAILED",
                        description: "status probe failed",
                      }),
                    ),
                  ),
                ),
              }),
              Layer.succeed(DesktopShell, {
                start: () => Effect.void,
                publishCaptureStatus: (status: CaptureStatusResult) =>
                  Queue.offer(delivered, status).pipe(Effect.asVoid),
                publishReviewEvent: () => Effect.void,
                dispose: Effect.void,
              }),
            ),
          ),
          Effect.forkScoped,
        );

        yield* Queue.take(attempts);
        yield* TestClock.adjust("50 millis");
        yield* Queue.take(attempts);
        expect(yield* Queue.size(delivered)).toBe(0);
      }),
    ),
  );

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
      projectSessionLayer: Layer.mock(ProjectSession, {}),
      desktopTempDirectoryLayer: Layer.succeed(DesktopTempDirectory, { path: "/tmp" }),
      engineDomainServicesLayer: Layer.mergeAll(
        Layer.mock(AgentService, {}),
        Layer.mock(ExportService, {}),
        Layer.mock(PermissionsService, {}),
        Layer.mock(ProjectService, {}),
        Layer.mock(RecordingService, {}),
        Layer.mock(SourcesService, {}),
        Layer.mock(SystemService, {}),
        Layer.effect(
          CaptureService,
          Effect.acquireRelease(
            Effect.suspend(() => {
              acquisitions += 1;
              return Effect.succeed(
                CaptureService.of({
                  status: Effect.never,
                  stop: Effect.die("unused"),
                  previewFrame: Effect.die("unused"),
                  startDisplay: () => Effect.die("unused"),
                  startCurrentWindow: () => Effect.die("unused"),
                  startWindow: () => Effect.die("unused"),
                }),
              );
            }),
            () =>
              Effect.sync(() => {
                releases += 1;
              }),
          ),
        ),
      ),
      reviewGatewayLayer: Layer.mock(ReviewGateway, {}),
      mediaSourceServiceLayer: Layer.mock(MediaSourceService, {}),
    });

    expect(acquisitions).toBe(1);
    await runtime.dispose();
    expect(releases).toBe(1);
  });
});
