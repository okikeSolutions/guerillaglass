import type {
  CapturePreviewFrameResult,
  CaptureStatusResult,
} from "@guerillaglass/engine-contract/domains/capture";
import { Context, Effect, Layer, Metric } from "effect";
import type { EngineClientFailure } from "../errors";
import {
  captureOperationDuration,
  captureOperationFailuresTotal,
  captureOperationsTotal,
} from "../metrics";
import {
  EngineClient,
  type CaptureStartCurrentWindowRequest,
  type CaptureStartDisplayRequest,
  type CaptureStartWindowRequest,
} from "../service";

/**
 * Domain service for capture lifecycle and polling operations.
 */
export type CaptureServiceShape = {
  /**
   * Starts capture for a display source.
   */
  readonly startDisplay: (
    request: CaptureStartDisplayRequest,
  ) => Effect.Effect<CaptureStatusResult, EngineClientFailure>;
  /**
   * Starts capture for the current foreground window.
   */
  readonly startCurrentWindow: (
    request: CaptureStartCurrentWindowRequest,
  ) => Effect.Effect<CaptureStatusResult, EngineClientFailure>;
  /**
   * Starts capture for a specific window source.
   */
  readonly startWindow: (
    request: CaptureStartWindowRequest,
  ) => Effect.Effect<CaptureStatusResult, EngineClientFailure>;
  /**
   * Stops the active capture session.
   */
  readonly stop: Effect.Effect<CaptureStatusResult, EngineClientFailure>;
  /**
   * Polls current capture and recording status.
   */
  readonly status: Effect.Effect<CaptureStatusResult, EngineClientFailure>;
  /**
   * Polls the latest preview frame.
   */
  readonly previewFrame: Effect.Effect<CapturePreviewFrameResult, EngineClientFailure>;
};

/**
 * Effect service tag for capture-domain engine operations.
 */
export class CaptureService extends Context.Service<CaptureService, CaptureServiceShape>()(
  "@guerillaglass/engine-client/CaptureService",
) {}

/**
 * Layer deriving capture-domain operations from {@link EngineClient}.
 */
const captureOperation = Effect.fn("CaptureService.captureOperation")(
  <A, E>(operation: string, effect: Effect.Effect<A, E>): Effect.Effect<A, E> =>
    effect.pipe(
      Effect.ensuring(
        Metric.update(Metric.withAttributes(captureOperationsTotal, { operation }), 1),
      ),
      Effect.tapError(() =>
        Metric.update(Metric.withAttributes(captureOperationFailuresTotal, { operation }), 1),
      ),
      Effect.trackDuration(Metric.withAttributes(captureOperationDuration, { operation })),
      Effect.annotateLogs({ component: "capture-service", operation }),
      Effect.withLogSpan(`capture.${operation}`),
      Effect.withSpan(`capture.${operation}`, {
        attributes: {
          "capture.operation": operation,
        },
      }),
    ),
);

const captureStartOperation = Effect.fn("CaptureService.captureStartOperation")(
  (
    operation: string,
    request:
      | CaptureStartDisplayRequest
      | CaptureStartCurrentWindowRequest
      | CaptureStartWindowRequest,
    effect: Effect.Effect<CaptureStatusResult, EngineClientFailure>,
  ): Effect.Effect<CaptureStatusResult, EngineClientFailure> =>
    captureOperation(operation, effect).pipe(
      Effect.annotateLogs({
        requestKeys: Object.keys(request).sort(),
      }),
      Effect.annotateSpans({
        "capture.request_keys": Object.keys(request).sort().join(","),
      }),
    ),
);

export const layerCaptureService: Layer.Layer<CaptureService, never, EngineClient> = Layer.effect(
  CaptureService,
  Effect.gen(function* () {
    const client = yield* EngineClient;
    return CaptureService.of({
      startDisplay: Effect.fn("CaptureService.startDisplay")(
        (request: CaptureStartDisplayRequest) =>
          captureStartOperation("start-display", request, client.captureStartDisplay(request)),
      ),
      startCurrentWindow: Effect.fn("CaptureService.startCurrentWindow")(
        (request: CaptureStartCurrentWindowRequest) =>
          captureStartOperation(
            "start-current-window",
            request,
            client.captureStartCurrentWindow(request),
          ),
      ),
      startWindow: Effect.fn("CaptureService.startWindow")((request: CaptureStartWindowRequest) =>
        captureStartOperation("start-window", request, client.captureStartWindow(request)).pipe(
          Effect.onInterrupt(() =>
            request.windowId === 0
              ? client.captureStop.pipe(
                  Effect.timeout("5 seconds"),
                  Effect.catch((error) =>
                    Effect.logWarning("Unable to dismiss interrupted capture picker", error),
                  ),
                  Effect.asVoid,
                )
              : Effect.void,
          ),
        ),
      ),
      stop: captureOperation("stop", client.captureStop),
      status: captureOperation("status", client.captureStatus),
      previewFrame: captureOperation("preview-frame", client.capturePreviewFrame),
    });
  }),
);
