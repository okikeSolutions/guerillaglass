import { Schema, SchemaTransformation } from "effect";
import { between, IsoDateTime, NonNegativeNumber, PositiveNumber } from "./helpers";
import { timelineSegmentIdSchema, windowIdSchema } from "../schema-primitives";

const captureWindowSchema = Schema.Struct({
  id: windowIdSchema,
  title: Schema.String,
  appName: Schema.String,
});

const captureContentRectSchema = Schema.Struct({
  x: Schema.Finite,
  y: Schema.Finite,
  width: PositiveNumber,
  height: PositiveNumber,
});

/**
 * Metadata describing the source and encoded dimensions of a capture.
 */
export const captureMetadataSchema = Schema.Struct({
  window: Schema.optionalKey(captureWindowSchema),
  source: Schema.Literals(["display", "window"]),
  contentRect: captureContentRectSchema,
  pixelScale: PositiveNumber,
  fps: Schema.optionalKey(PositiveNumber),
});

/**
 * Platform input-monitoring permission state reported by the native engine.
 */
export const inputMonitoringStatusSchema = Schema.Literals(["unknown", "granted", "denied"]);

const backgroundColorSchema = Schema.String.check(Schema.isPattern(/^#[0-9a-fA-F]{6}$/u)).pipe(
  Schema.decodeTo(Schema.String, SchemaTransformation.toUpperCase()),
);

/**
 * Default background framing settings. Disabled preserves the legacy full-frame render.
 */
export const defaultBackgroundFramingSettings = {
  version: 1,
  enabled: false,
  backgroundColor: "#18181B",
  paddingFraction: 0.06,
  cornerRadiusFraction: 0.025,
  shadowStrength: 0.35,
} as const;

/**
 * Versioned project-global background stage and source-card framing settings.
 */
export const backgroundFramingSettingsSchema = Schema.Struct({
  version: Schema.Literal(1),
  enabled: Schema.Boolean,
  backgroundColor: backgroundColorSchema,
  paddingFraction: Schema.Finite.pipe(between(0, 0.25)),
  cornerRadiusFraction: Schema.Finite.pipe(between(0, 0.1)),
  shadowStrength: Schema.Finite.pipe(between(0, 1)),
}).annotate({
  identifier: "BackgroundFramingSettings",
  description: "Versioned project-global background stage and source-card framing settings.",
});

/**
 * User-configurable automatic zoom settings stored with a project.
 */
export const autoZoomSettingsSchema = Schema.Struct({
  isEnabled: Schema.Boolean,
  intensity: NonNegativeNumber,
  minimumKeyframeInterval: NonNegativeNumber,
}).annotate({
  identifier: "AutoZoomSettings",
  description:
    "User-configurable automatic zoom settings stored with a project or export override.",
});

/**
 * Input event payload captured during recording.
 */
export const inputEventSchema = Schema.Struct({
  type: Schema.Literals(["cursorMoved", "mouseDown", "mouseUp"]),
  timestamp: NonNegativeNumber,
  position: Schema.Struct({
    x: Schema.Finite,
    y: Schema.Finite,
  }),
  button: Schema.optionalKey(Schema.Literals(["left", "right", "other"])),
});

/**
 * Input event log written by engines that support input tracking.
 */
export const inputEventLogSchema = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  events: Schema.Array(inputEventSchema),
});

/**
 * Time-bounded timeline segment used by cut plans and project timelines.
 */
export const timelineClipItemSchema = Schema.Struct({
  kind: Schema.Literal("clip"),
  id: timelineSegmentIdSchema,
  sourceAssetId: Schema.Literal("recording"),
  sourceStartSeconds: NonNegativeNumber,
  sourceEndSeconds: NonNegativeNumber,
});

/**
 * Explicit timeline gap item used for non-ripple editing operations.
 */
export const timelineGapItemSchema = Schema.Struct({
  kind: Schema.Literal("gap"),
  id: timelineSegmentIdSchema,
  durationSeconds: NonNegativeNumber,
});

/**
 * Timeline item persisted by the editor and engine.
 */
export const timelineItemSchema = Schema.Union([timelineClipItemSchema, timelineGapItemSchema]);

export const timelineSegmentSchema = timelineClipItemSchema;

/**
 * Versioned timeline document persisted in project state and sent to exports.
 */
export const timelineDocumentSchema = Schema.Struct({
  version: Schema.Literal(2),
  items: Schema.Array(timelineItemSchema),
  updatedAt: Schema.optionalKey(IsoDateTime),
});

/**
 * Static or last-known metadata about a captured source.
 */
export const CaptureMetadata = captureMetadataSchema;
/** Validated CaptureMetadata record. */
export interface CaptureMetadata extends Schema.Schema.Type<typeof CaptureMetadata> {}

/**
 * Runtime TypeScript type for input-monitoring permission state.
 */
export type InputMonitoringStatus = Schema.Schema.Type<typeof inputMonitoringStatusSchema>;

/**
 * Runtime TypeScript type for background framing settings.
 */
export const BackgroundFramingSettings = backgroundFramingSettingsSchema;
/** Validated BackgroundFramingSettings record. */
export interface BackgroundFramingSettings extends Schema.Schema.Type<
  typeof BackgroundFramingSettings
> {}

/**
 * Runtime TypeScript type for auto-zoom project settings.
 */
export const AutoZoomSettings = autoZoomSettingsSchema;
/** Validated AutoZoomSettings record. */
export interface AutoZoomSettings extends Schema.Schema.Type<typeof AutoZoomSettings> {}

/**
 * Runtime TypeScript type for an input event.
 */
export const InputEvent = inputEventSchema;
/** Validated InputEvent record. */
export interface InputEvent extends Schema.Schema.Type<typeof InputEvent> {}

/**
 * Runtime TypeScript type for an input event log.
 */
export const InputEventLog = inputEventLogSchema;
/** Validated InputEventLog record. */
export interface InputEventLog extends Schema.Schema.Type<typeof InputEventLog> {}

/**
 * Runtime TypeScript type for a timeline clip item.
 */
export const TimelineClipItem = timelineClipItemSchema;
/** Validated TimelineClipItem record. */
export interface TimelineClipItem extends Schema.Schema.Type<typeof TimelineClipItem> {}

/**
 * Runtime TypeScript type for a timeline gap item.
 */
export const TimelineGapItem = timelineGapItemSchema;
/** Validated TimelineGapItem record. */
export interface TimelineGapItem extends Schema.Schema.Type<typeof TimelineGapItem> {}

/**
 * Runtime TypeScript type for a timeline item.
 */
export type TimelineItem = Schema.Schema.Type<typeof timelineItemSchema>;

/**
 * Runtime TypeScript type for a timeline segment.
 */
export type TimelineSegment = Schema.Schema.Type<typeof timelineSegmentSchema>;

/**
 * Runtime TypeScript type for a versioned timeline document.
 */
export const TimelineDocument = timelineDocumentSchema;
/** Validated TimelineDocument record. */
export interface TimelineDocument extends Schema.Schema.Type<typeof TimelineDocument> {}
