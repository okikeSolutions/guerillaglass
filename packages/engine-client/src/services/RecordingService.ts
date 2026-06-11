import type { CaptureStatusResult } from "@guerillaglass/engine-contract/domains/capture";
import { Context, Effect, Layer } from "effect";
import type { EngineClientError } from "../errors";
import { EngineClient, type RecordingStartRequest } from "../service";

/**
 * Domain service for recording lifecycle operations.
 */
export type RecordingServiceShape = {
  /**
   * Starts recording within the active capture session.
   */
  readonly start: (
    request: RecordingStartRequest,
  ) => Effect.Effect<CaptureStatusResult, EngineClientError>;
  /**
   * Stops the active recording.
   */
  readonly stop: Effect.Effect<CaptureStatusResult, EngineClientError>;
};

/**
 * Effect service tag for recording-domain engine operations.
 */
export class RecordingService extends Context.Service<RecordingService, RecordingServiceShape>()(
  "@guerillaglass/engine-client/RecordingService",
) {}

/**
 * Layer deriving recording-domain operations from {@link EngineClient}.
 */
export const layerRecordingService: Layer.Layer<RecordingService, never, EngineClient> =
  Layer.effect(
    RecordingService,
    Effect.map(EngineClient, (client) =>
      RecordingService.of({
        start: client.recordingStart,
        stop: client.recordingStop,
      }),
    ),
  );
