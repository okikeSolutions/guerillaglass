import type {
  CapturePreviewFrameResult,
  CaptureStatusResult,
} from "@guerillaglass/engine-contract/domains/capture";
import { Context, Effect, Layer, Metric } from "effect";
import type { EngineClientError } from "../errors";
import {
  captureOperationDuration,
  captureOperationFailuresTotal,
  captureOperationsTotal,
} from "../metrics";
import { EngineClient, type CaptureStartRequest } from "../service";

/**
 * Domain service for capture lifecycle and polling operations.
 */
export type CaptureServiceShape = {
  /**
   * Starts capture for a display source.
   */
  readonly startDisplay: (
    request: CaptureStartRequest,
  ) => Effect.Effect<CaptureStatusResult, EngineClientError>;
  /**
   * Starts capture for the current foreground window.
   */
  readonly startCurrentWindow: (
    request: CaptureStartRequest,
  ) => Effect.Effect<CaptureStatusResult, EngineClientError>;
  /**
   * Starts capture for a specific window source.
   */
  readonly startWindow: (
    request: CaptureStartRequest,
  ) => Effect.Effect<CaptureStatusResult, EngineClientError>;
  /**
   * Stops the active capture session.
   */
  readonly stop: Effect.Effect<CaptureStatusResult, EngineClientError>;
  /**
   * Polls current capture and recording status.
   */
  readonly status: Effect.Effect<CaptureStatusResult, EngineClientError>;
  /**
   * Polls the latest preview frame.
   */
  readonly previewFrame: Effect.Effect<CapturePreviewFrameResult, EngineClientError>;
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
const captureOperation = <A, E>(
  operation: string,
  effect: Effect.Effect<A, E>,
): Effect.Effect<A, E> =>
  effect.pipe(
    Effect.ensuring(Metric.update(Metric.withAttributes(captureOperationsTotal, { operation }), 1)),
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
  );

const captureStartOperation = (
  operation: string,
  request: CaptureStartRequest,
  effect: Effect.Effect<CaptureStatusResult, EngineClientError>,
): Effect.Effect<CaptureStatusResult, EngineClientError> =>
  captureOperation(operation, effect).pipe(
    Effect.annotateLogs({
      requestKeys: Object.keys(request).sort(),
    }),
    Effect.annotateSpans({
      "capture.request_keys": Object.keys(request).sort().join(","),
    }),
  );

export const layerCaptureService: Layer.Layer<CaptureService, never, EngineClient> = Layer.effect(
  CaptureService,
  Effect.map(EngineClient, (client) =>
    CaptureService.of({
      startDisplay: (request) =>
        captureStartOperation("start-display", request, client.captureStartDisplay(request)),
      startCurrentWindow: (request) =>
        captureStartOperation(
          "start-current-window",
          request,
          client.captureStartCurrentWindow(request),
        ),
      startWindow: (request) =>
        captureStartOperation("start-window", request, client.captureStartWindow(request)),
      stop: captureOperation("stop", client.captureStop),
      status: captureOperation("status", client.captureStatus),
      previewFrame: captureOperation("preview-frame", client.capturePreviewFrame),
    }),
  ),
);
