import { Schema } from "effect";
import { displayIdSchema, windowIdSchema } from "../schema-primitives";
import { NonEmptyString, PositiveInt, PositiveNumber } from "../shared/helpers";

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
  id: displayIdSchema,
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
  id: windowIdSchema,
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
export const DisplaySource = displaySourceSchema;
/** Validated DisplaySource record. */
export interface DisplaySource extends Schema.Schema.Type<typeof DisplaySource> {}

/**
 * Runtime TypeScript type for a window capture source.
 */
export const WindowSource = windowSourceSchema;
/** Validated WindowSource record. */
export interface WindowSource extends Schema.Schema.Type<typeof WindowSource> {}

/**
 * Runtime TypeScript type for source-list responses.
 */
export const SourcesResult = sourcesResultSchema;
/** Validated SourcesResult record. */
export interface SourcesResult extends Schema.Schema.Type<typeof SourcesResult> {}
