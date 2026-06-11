import { Schema } from "effect";
import { IsoDateTime, NonNegativeInt, NonNegativeNumber, PositiveNumber } from "./helpers";
import { timelineSegmentIdSchema } from "../schema-primitives";

const captureWindowSchema = Schema.Struct({
  id: NonNegativeInt,
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

/**
 * User-configurable automatic zoom settings stored with a project.
 */
export const autoZoomSettingsSchema = Schema.Struct({
  isEnabled: Schema.Boolean,
  intensity: NonNegativeNumber,
  minimumKeyframeInterval: NonNegativeNumber,
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
export type CaptureMetadata = Schema.Schema.Type<typeof captureMetadataSchema>;

/**
 * Runtime TypeScript type for input-monitoring permission state.
 */
export type InputMonitoringStatus = Schema.Schema.Type<typeof inputMonitoringStatusSchema>;

/**
 * Runtime TypeScript type for auto-zoom project settings.
 */
export type AutoZoomSettings = Schema.Schema.Type<typeof autoZoomSettingsSchema>;

/**
 * Runtime TypeScript type for an input event.
 */
export type InputEvent = Schema.Schema.Type<typeof inputEventSchema>;

/**
 * Runtime TypeScript type for an input event log.
 */
export type InputEventLog = Schema.Schema.Type<typeof inputEventLogSchema>;

/**
 * Runtime TypeScript type for a timeline clip item.
 */
export type TimelineClipItem = Schema.Schema.Type<typeof timelineClipItemSchema>;

/**
 * Runtime TypeScript type for a timeline gap item.
 */
export type TimelineGapItem = Schema.Schema.Type<typeof timelineGapItemSchema>;

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
export type TimelineDocument = Schema.Schema.Type<typeof timelineDocumentSchema>;
