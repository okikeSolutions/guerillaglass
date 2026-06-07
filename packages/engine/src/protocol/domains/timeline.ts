import {
  timelineClipItemSchema,
  timelineDocumentSchema,
  timelineGapItemSchema,
  timelineItemSchema,
  timelineSegmentSchema,
  type TimelineClipItem,
  type TimelineDocument,
  type TimelineGapItem,
  type TimelineItem,
  type TimelineSegment,
} from "@guerillaglass/engine/protocol/shared/valueObjects";

/** Timeline clip item schema for editor and engine project documents. */
export const timelineClipSchema = timelineClipItemSchema;
/** Timeline gap item schema for editor and engine project documents. */
export const timelineGapSchema = timelineGapItemSchema;
/** Timeline item schema for editor and engine project documents. */
export const timelineItemDocumentSchema = timelineItemSchema;
/** Legacy timeline segment schema alias. */
export const legacyTimelineSegmentSchema = timelineSegmentSchema;
/** Timeline document schema for editor and engine project documents. */
export const timelineProjectDocumentSchema = timelineDocumentSchema;

export type { TimelineClipItem, TimelineDocument, TimelineGapItem, TimelineItem, TimelineSegment };
