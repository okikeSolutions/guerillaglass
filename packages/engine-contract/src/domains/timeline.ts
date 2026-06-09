import {
  timelineDocumentSchema,
  timelineSegmentSchema,
  type TimelineDocument,
  type TimelineSegment,
} from "../shared/valueObjects";

/**
 * Compatibility name for timeline segments while migrating timeline terminology.
 */
export const legacyTimelineSegmentSchema = timelineSegmentSchema;

/**
 * Project-facing alias for the versioned timeline document schema.
 */
export const timelineProjectDocumentSchema = timelineDocumentSchema;

/**
 * Runtime TypeScript types for timeline documents and segments.
 */
export type { TimelineDocument, TimelineSegment };
