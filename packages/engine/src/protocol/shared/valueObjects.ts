import { Schema } from "effect";
import {
  NonNegativeInt,
  NonNegativeNumber,
  PositiveNumber,
  between,
  optionalWith,
} from "@guerillaglass/engine/protocol/shared/helpers";
import { timelineSegmentIdSchema } from "@guerillaglass/engine/protocol/schema-primitives";

/** Input Monitoring permission states returned by the native engine. */
export const inputMonitoringStatusSchema = Schema.Literals([
  "notDetermined",
  "denied",
  "authorized",
]);

/** Auto-zoom project settings shared between renderer and native engine. */
export const autoZoomSettingsSchema = Schema.Struct({
  isEnabled: Schema.Boolean,
  intensity: Schema.Number.pipe(between(0, 1)),
  minimumKeyframeInterval: PositiveNumber,
});

const captureWindowSchema = Schema.Struct({
  id: NonNegativeInt,
  title: Schema.String,
  appName: Schema.String,
});

const captureContentRectSchema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  width: PositiveNumber,
  height: PositiveNumber,
});

/** Optional capture metadata embedded in capture status and project state. */
export const captureMetadataSchema = Schema.NullOr(
  Schema.Struct({
    window: optionalWith(Schema.NullOr(captureWindowSchema), { default: () => null }),
    source: Schema.Literals(["display", "window"]),
    contentRect: captureContentRectSchema,
    pixelScale: PositiveNumber,
    fps: Schema.optionalKey(Schema.NullOr(PositiveNumber)),
  }),
);

/** Input event payload captured during recording. */
export const inputEventSchema = Schema.Struct({
  type: Schema.Literals(["cursorMoved", "mouseDown", "mouseUp"]),
  timestamp: NonNegativeNumber,
  position: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
  }),
  button: Schema.optionalKey(Schema.Literals(["left", "right", "other"])),
});

/** Input event log written by engines that support input tracking. */
export const inputEventLogSchema = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  events: Schema.Array(inputEventSchema),
});

const timelineItemIdSchema = timelineSegmentIdSchema;

/** Linked A/V clip item persisted in project timeline state. */
export const timelineClipItemSchema = Schema.Struct({
  kind: Schema.Literal("clip"),
  id: timelineItemIdSchema,
  sourceAssetId: Schema.Literal("recording"),
  sourceStartSeconds: NonNegativeNumber,
  sourceEndSeconds: NonNegativeNumber,
});

/** Explicit timeline gap item used for non-ripple editing operations. */
export const timelineGapItemSchema = Schema.Struct({
  kind: Schema.Literal("gap"),
  id: timelineItemIdSchema,
  durationSeconds: NonNegativeNumber,
});

/** Timeline item persisted by the editor and engine. */
export const timelineItemSchema = Schema.Union([timelineClipItemSchema, timelineGapItemSchema]);

/** Legacy alias retained while the editor moves from segments to timeline items. */
export const timelineSegmentSchema = timelineClipItemSchema;

/** Project timeline document persisted by the editor and engine. */
export const timelineDocumentSchema = Schema.Struct({
  version: Schema.Literal(2),
  items: Schema.Array(timelineItemSchema),
});

/** Type alias for AutoZoomSettings. */
export type AutoZoomSettings = Schema.Schema.Type<typeof autoZoomSettingsSchema>;
/** Type alias for InputEvent. */
export type InputEvent = Schema.Schema.Type<typeof inputEventSchema>;
/** Type alias for InputEventLog. */
export type InputEventLog = Schema.Schema.Type<typeof inputEventLogSchema>;
/** Type alias for TimelineClipItem. */
export type TimelineClipItem = Schema.Schema.Type<typeof timelineClipItemSchema>;
/** Type alias for TimelineGapItem. */
export type TimelineGapItem = Schema.Schema.Type<typeof timelineGapItemSchema>;
/** Type alias for TimelineItem. */
export type TimelineItem = Schema.Schema.Type<typeof timelineItemSchema>;
/** Type alias for TimelineSegment. */
export type TimelineSegment = Schema.Schema.Type<typeof timelineSegmentSchema>;
/** Type alias for TimelineDocument. */
export type TimelineDocument = Schema.Schema.Type<typeof timelineDocumentSchema>;
