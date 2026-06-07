import { Schema } from "effect";
import {
  NonEmptyString,
  NonNegativeInt,
  PositiveInt,
  PositiveNumber,
} from "@guerillaglass/engine/protocol/shared/helpers";

/** Supported capture frame rates for all engines. */
export const captureFrameRates = [24, 30, 60, 120] as const;
/** Default capture frame rate used when request params omit `captureFps`. */
export const defaultCaptureFrameRate: (typeof captureFrameRates)[number] = 30;
/** Effect schema for engine-supported capture FPS values. */
export const captureFrameRateSchema = Schema.Literals(captureFrameRates);

/** Display capture source descriptor. */
export const displaySourceSchema = Schema.Struct({
  id: NonNegativeInt,
  displayName: NonEmptyString,
  isPrimary: Schema.Boolean,
  width: PositiveInt,
  height: PositiveInt,
  pixelScale: Schema.optionalKey(PositiveNumber),
  refreshHz: Schema.NullOr(PositiveNumber),
  supportedCaptureFrameRates: Schema.Array(captureFrameRateSchema),
});

/** Window capture source descriptor. */
export const windowSourceSchema = Schema.Struct({
  id: NonNegativeInt,
  title: Schema.String,
  appName: Schema.String,
  width: PositiveNumber,
  height: PositiveNumber,
  isOnScreen: Schema.Boolean,
  pixelScale: Schema.optionalKey(PositiveNumber),
  refreshHz: Schema.NullOr(PositiveNumber),
  supportedCaptureFrameRates: Schema.Array(captureFrameRateSchema),
});

/** Result payload for `sources.list`. */
export const sourcesResultSchema = Schema.Struct({
  displays: Schema.Array(displaySourceSchema),
  windows: Schema.Array(windowSourceSchema),
});

/** Type alias for CaptureFrameRate. */
export type CaptureFrameRate = Schema.Schema.Type<typeof captureFrameRateSchema>;
/** Type alias for SourcesResult. */
export type SourcesResult = Schema.Schema.Type<typeof sourcesResultSchema>;
