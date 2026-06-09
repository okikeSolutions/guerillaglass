import { Schema } from "effect";
import { NonEmptyString, NonNegativeInt, PositiveInt, PositiveNumber } from "../shared/helpers";

/**
 * Supported capture frame rates for all engines.
 */
export const captureFrameRates = [24, 30, 60, 120] as const;

/**
 * Default capture frame rate used when request params omit `captureFps`.
 */
export const defaultCaptureFrameRate: (typeof captureFrameRates)[number] = 30;

/**
 * Requested capture frame rate in frames per second.
 */
export const captureFrameRateSchema = Schema.Literals(captureFrameRates);

/**
 * Display capture source descriptor.
 */
export const displaySourceSchema = Schema.Struct({
  id: NonNegativeInt,
  displayName: NonEmptyString,
  isPrimary: Schema.Boolean,
  width: PositiveInt,
  height: PositiveInt,
  pixelScale: Schema.optionalKey(PositiveNumber),
  refreshHz: Schema.optionalKey(PositiveNumber),
  supportedCaptureFrameRates: Schema.Array(captureFrameRateSchema),
}).annotate({ identifier: "DisplaySource" });

/**
 * Window capture source descriptor.
 */
export const windowSourceSchema = Schema.Struct({
  id: NonNegativeInt,
  title: Schema.String,
  appName: Schema.String,
  width: PositiveNumber,
  height: PositiveNumber,
  isOnScreen: Schema.Boolean,
  pixelScale: Schema.optionalKey(PositiveNumber),
  refreshHz: Schema.optionalKey(PositiveNumber),
  supportedCaptureFrameRates: Schema.Array(captureFrameRateSchema),
}).annotate({ identifier: "WindowSource" });

/**
 * Response envelope for available capture sources.
 */
export const sourcesResultSchema = Schema.Struct({
  displays: Schema.Array(displaySourceSchema),
  windows: Schema.Array(windowSourceSchema),
}).annotate({ identifier: "SourcesResult" });

/**
 * Runtime TypeScript type for an engine-supported capture FPS value.
 */
export type CaptureFrameRate = Schema.Schema.Type<typeof captureFrameRateSchema>;

/**
 * Runtime TypeScript type for a display capture source.
 */
export type DisplaySource = Schema.Schema.Type<typeof displaySourceSchema>;

/**
 * Runtime TypeScript type for a window capture source.
 */
export type WindowSource = Schema.Schema.Type<typeof windowSourceSchema>;

/**
 * Runtime TypeScript type for source-list responses.
 */
export type SourcesResult = Schema.Schema.Type<typeof sourcesResultSchema>;
