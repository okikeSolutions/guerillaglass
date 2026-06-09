import { Schema } from "effect";
import { NonEmptyString, NonNegativeInt, NonNegativeNumber } from "../shared/helpers";
import { captureSessionIdSchema } from "../schema-primitives";
import { captureMetadataSchema } from "../shared/valueObjects";
import { EngineBadRequestError } from "../errors";

/**
 * Performance counters and timing metrics emitted by capture/recording pipelines.
 */
export const captureTelemetrySchema = Schema.Struct({
  sourceDroppedFrames: Schema.optionalKey(NonNegativeInt),
  writerDroppedFrames: Schema.optionalKey(NonNegativeInt),
  writerBackpressureDrops: Schema.optionalKey(NonNegativeInt),
  achievedFps: Schema.optionalKey(NonNegativeNumber),
  cpuPercent: Schema.optionalKey(NonNegativeNumber),
  memoryBytes: Schema.optionalKey(NonNegativeNumber),
  recordingBitrateMbps: Schema.optionalKey(NonNegativeNumber),
  captureCallbackMs: Schema.optionalKey(NonNegativeNumber),
  recordQueueLagMs: Schema.optionalKey(NonNegativeNumber),
  writerAppendMs: Schema.optionalKey(NonNegativeNumber),
  previewEncodeMs: Schema.optionalKey(NonNegativeNumber),
}).annotate({ identifier: "CaptureTelemetry" });

/**
 * Single preview frame encoded as base64 for polling clients.
 */
export const capturePreviewFrameSchema = Schema.Struct({
  frameId: NonNegativeInt,
  bytesBase64: NonEmptyString,
}).annotate({ identifier: "CapturePreviewFrame" });

/**
 * Current capture and recording lifecycle state returned by polling/status commands.
 */
export const captureStatusResultSchema = Schema.Struct({
  isRunning: Schema.Boolean,
  isRecording: Schema.Boolean,
  captureSessionId: Schema.optionalKey(captureSessionIdSchema),
  recordingDurationSeconds: NonNegativeNumber,
  recordingURL: Schema.optionalKey(Schema.String),
  captureMetadata: Schema.optionalKey(captureMetadataSchema),
  lastError: Schema.optionalKey(EngineBadRequestError),
  eventsURL: Schema.optionalKey(Schema.String),
  lastRecordingTelemetry: Schema.optionalKey(captureTelemetrySchema),
  telemetry: captureTelemetrySchema,
}).annotate({ identifier: "CaptureStatusResult" });

/**
 * Polling response for the latest preview frame, omitted when no frame is available.
 */
export const capturePreviewFrameResultSchema = Schema.Struct({
  frame: Schema.optionalKey(capturePreviewFrameSchema),
}).annotate({ identifier: "CapturePreviewFrameResult" });

/**
 * Runtime TypeScript type for capture telemetry.
 */
export type CaptureTelemetry = Schema.Schema.Type<typeof captureTelemetrySchema>;

/**
 * Runtime TypeScript type for a base64 preview frame.
 */
export type CapturePreviewFrame = Schema.Schema.Type<typeof capturePreviewFrameSchema>;

/**
 * Runtime TypeScript type for capture and recording status responses.
 */
export type CaptureStatusResult = Schema.Schema.Type<typeof captureStatusResultSchema>;

/**
 * Runtime TypeScript type for a base64 preview frame.
 */
export type CapturePreviewFrameResult = Schema.Schema.Type<typeof capturePreviewFrameResultSchema>;
