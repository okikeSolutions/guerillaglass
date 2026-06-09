import type {
  CapturePreviewFrameResult,
  CaptureStatusResult,
} from "@guerillaglass/engine-contract/domains/capture";
import { Context, Effect, Layer } from "effect";
import type { EngineClientError } from "../errors";
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
export const layerCaptureService: Layer.Layer<CaptureService, never, EngineClient> = Layer.effect(
  CaptureService,
  Effect.map(EngineClient, (client) =>
    CaptureService.of({
      startDisplay: client.captureStartDisplay,
      startCurrentWindow: client.captureStartCurrentWindow,
      startWindow: client.captureStartWindow,
      stop: client.captureStop,
      status: client.captureStatus,
      previewFrame: client.capturePreviewFrame,
    }),
  ),
);
