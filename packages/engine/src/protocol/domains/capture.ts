import { Schema } from "effect";
import {
  NonEmptyString,
  NonNegativeInt,
  NonNegativeNumber,
  optionalWith,
} from "@guerillaglass/engine/protocol/shared/helpers";
import { captureSessionIdSchema } from "@guerillaglass/engine/protocol/schema-primitives";
import { captureMetadataSchema } from "@guerillaglass/engine/protocol/shared/valueObjects";

const createDefaultCaptureTelemetry = () => ({
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
  previewEncodeMs: 0,
});

/** Capture telemetry payload returned by `capture.status`. */
export const captureTelemetrySchema = Schema.Struct({
  sourceDroppedFrames: optionalWith(NonNegativeInt, { default: () => 0 }),
  writerDroppedFrames: optionalWith(NonNegativeInt, { default: () => 0 }),
  writerBackpressureDrops: optionalWith(NonNegativeInt, { default: () => 0 }),
  achievedFps: optionalWith(NonNegativeNumber, { default: () => 0 }),
  cpuPercent: optionalWith(Schema.NullOr(NonNegativeNumber), { default: () => null }),
  memoryBytes: optionalWith(Schema.NullOr(NonNegativeNumber), { default: () => null }),
  recordingBitrateMbps: optionalWith(Schema.NullOr(NonNegativeNumber), {
    default: () => null,
  }),
  captureCallbackMs: optionalWith(NonNegativeNumber, { default: () => 0 }),
  recordQueueLagMs: optionalWith(NonNegativeNumber, { default: () => 0 }),
  writerAppendMs: optionalWith(NonNegativeNumber, { default: () => 0 }),
  previewEncodeMs: Schema.optionalKey(NonNegativeNumber),
});

/** Lightweight shell preview frame payload returned by `capture.previewFrame`. */
export const capturePreviewFrameSchema = Schema.Struct({
  frameId: NonNegativeInt,
  bytesBase64: NonEmptyString,
});

/** Result payload for capture and recording lifecycle methods. */
export const captureStatusResultSchema = Schema.Struct({
  isRunning: Schema.Boolean,
  isRecording: Schema.Boolean,
  captureSessionId: optionalWith(Schema.NullOr(captureSessionIdSchema), {
    default: () => null,
  }),
  recordingDurationSeconds: NonNegativeNumber,
  recordingURL: Schema.NullOr(Schema.String),
  captureMetadata: optionalWith(captureMetadataSchema, { default: () => null }),
  lastError: Schema.NullOr(Schema.String),
  eventsURL: Schema.NullOr(Schema.String),
  lastRecordingTelemetry: optionalWith(Schema.NullOr(captureTelemetrySchema), {
    default: () => null,
  }),
  telemetry: optionalWith(captureTelemetrySchema, {
    default: createDefaultCaptureTelemetry,
  }),
});

/** Result payload for the latest cached live preview frame. */
export const capturePreviewFrameResultSchema = Schema.NullOr(capturePreviewFrameSchema);

/** Type alias for CaptureTelemetry. */
export type CaptureTelemetry = Schema.Schema.Type<typeof captureTelemetrySchema>;
/** Type alias for CapturePreviewFrame. */
export type CapturePreviewFrame = Schema.Schema.Type<typeof capturePreviewFrameSchema>;
/** Type alias for CaptureStatusResult. */
export type CaptureStatusResult = Schema.Schema.Type<typeof captureStatusResultSchema>;
/** Type alias for CapturePreviewFrameResult. */
export type CapturePreviewFrameResult = Schema.Schema.Type<typeof capturePreviewFrameResultSchema>;
