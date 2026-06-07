import { Option, Schema } from "effect";
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
  cpuPercent: Option.none(),
  memoryBytes: Option.none(),
  recordingBitrateMbps: Option.none(),
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
  cpuPercent: Schema.OptionFromOptionalNullOr(NonNegativeNumber, { onNoneEncoding: null }),
  memoryBytes: Schema.OptionFromOptionalNullOr(NonNegativeNumber, { onNoneEncoding: null }),
  recordingBitrateMbps: Schema.OptionFromOptionalNullOr(NonNegativeNumber, {
    onNoneEncoding: null,
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
  captureSessionId: Schema.OptionFromOptionalNullOr(captureSessionIdSchema, {
    onNoneEncoding: null,
  }),
  recordingDurationSeconds: NonNegativeNumber,
  recordingURL: Schema.OptionFromNullOr(Schema.String),
  captureMetadata: optionalWith(captureMetadataSchema, { default: () => Option.none() }),
  lastError: Schema.OptionFromNullOr(Schema.String),
  eventsURL: Schema.OptionFromNullOr(Schema.String),
  lastRecordingTelemetry: Schema.OptionFromOptionalNullOr(captureTelemetrySchema, {
    onNoneEncoding: null,
  }),
  telemetry: optionalWith(captureTelemetrySchema, {
    default: createDefaultCaptureTelemetry,
  }),
});

/** Result payload for the latest cached live preview frame. */
export const capturePreviewFrameResultSchema = Schema.OptionFromNullOr(capturePreviewFrameSchema);

type CaptureTelemetryEncoded = Schema.Codec.Encoded<typeof captureTelemetrySchema>;
type CaptureStatusResultEncoded = Schema.Codec.Encoded<typeof captureStatusResultSchema>;

/** Type alias for CaptureTelemetry values emitted by engine clients after defaults are applied. */
export type CaptureTelemetry = Omit<
  CaptureTelemetryEncoded,
  | "sourceDroppedFrames"
  | "writerDroppedFrames"
  | "writerBackpressureDrops"
  | "achievedFps"
  | "captureCallbackMs"
  | "recordQueueLagMs"
  | "writerAppendMs"
> & {
  readonly sourceDroppedFrames: number;
  readonly writerDroppedFrames: number;
  readonly writerBackpressureDrops: number;
  readonly achievedFps: number;
  readonly captureCallbackMs: number;
  readonly recordQueueLagMs: number;
  readonly writerAppendMs: number;
};
/** Type alias for CapturePreviewFrame. */
export type CapturePreviewFrame = Schema.Codec.Encoded<typeof capturePreviewFrameSchema>;
/** Type alias for CaptureStatusResult values emitted by engine clients after defaults are applied. */
export type CaptureStatusResult = Omit<
  CaptureStatusResultEncoded,
  "telemetry" | "lastRecordingTelemetry"
> & {
  readonly telemetry: CaptureTelemetry;
  readonly lastRecordingTelemetry?: CaptureTelemetry | null;
};
/** Type alias for CapturePreviewFrameResult. */
export type CapturePreviewFrameResult = Schema.Codec.Encoded<typeof capturePreviewFrameResultSchema>;
