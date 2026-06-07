import { Schema } from "effect";
import {
  IsoDateTime,
  NonEmptyString,
  optionalWith,
} from "@guerillaglass/engine/protocol/shared/helpers";
import { projectPathSchema } from "@guerillaglass/engine/protocol/schema-primitives";
import { agentJobIdSchema } from "@guerillaglass/engine/protocol/schema-primitives";
import {
  autoZoomSettingsSchema,
  captureMetadataSchema,
  timelineDocumentSchema,
} from "@guerillaglass/engine/protocol/shared/valueObjects";
import { captureTelemetrySchema } from "@guerillaglass/engine/protocol/domains/capture";
import { agentJobStatusSchema } from "@guerillaglass/engine/protocol/domains/agent";

/** Project-level summary for the latest agent run metadata. */
export const projectAgentAnalysisSummarySchema = Schema.Struct({
  latestJobId: Schema.NullOr(agentJobIdSchema),
  latestStatus: Schema.NullOr(agentJobStatusSchema),
  qaPassed: Schema.NullOr(Schema.Boolean),
  updatedAt: Schema.NullOr(IsoDateTime),
});

/** Engine protocol schema for projectStateSchema. */
export const projectStateSchema = Schema.Struct({
  projectPath: Schema.NullOr(projectPathSchema),
  recordingURL: Schema.NullOr(Schema.String),
  eventsURL: Schema.NullOr(Schema.String),
  lastRecordingTelemetry: optionalWith(Schema.NullOr(captureTelemetrySchema), {
    default: () => null,
  }),
  autoZoom: autoZoomSettingsSchema,
  timeline: optionalWith(timelineDocumentSchema, {
    default: () => ({
      version: 2 as const,
      items: [],
    }),
  }),
  captureMetadata: captureMetadataSchema,
  agentAnalysis: optionalWith(projectAgentAnalysisSummarySchema, {
    default: () => ({
      latestJobId: null,
      latestStatus: null,
      qaPassed: null,
      updatedAt: null,
    }),
  }),
});

/** Engine protocol schema for projectRecentItemSchema. */
export const projectRecentItemSchema = Schema.Struct({
  projectPath: projectPathSchema,
  displayName: NonEmptyString,
  lastOpenedAt: IsoDateTime,
});

/** Engine protocol schema for projectRecentsResultSchema. */
export const projectRecentsResultSchema = Schema.Struct({
  items: Schema.Array(projectRecentItemSchema),
});

/** Type alias for ProjectAgentAnalysisSummary. */
export type ProjectAgentAnalysisSummary = Schema.Schema.Type<
  typeof projectAgentAnalysisSummarySchema
>;
/** Type alias for ProjectState. */
export type ProjectState = Schema.Schema.Type<typeof projectStateSchema>;
/** Type alias for ProjectRecentItem. */
export type ProjectRecentItem = Schema.Schema.Type<typeof projectRecentItemSchema>;
/** Type alias for ProjectRecentsResult. */
export type ProjectRecentsResult = Schema.Schema.Type<typeof projectRecentsResultSchema>;
