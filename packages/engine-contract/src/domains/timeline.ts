import {
  timelineDocumentSchema,
  type TimelineDocument,
  type TimelineSegment,
} from "../shared/valueObjects";

/**
 * Project-facing alias for the versioned timeline document schema.
 */
export const timelineProjectDocumentSchema = timelineDocumentSchema;

/**
 * Runtime TypeScript types for timeline documents and segments.
 */
export type { TimelineDocument, TimelineSegment };
