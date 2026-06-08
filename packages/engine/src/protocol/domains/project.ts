import { Option, Schema } from "effect";
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
import {
  captureTelemetrySchema,
  type CaptureTelemetry,
} from "@guerillaglass/engine/protocol/domains/capture";
import { agentJobStatusSchema } from "@guerillaglass/engine/protocol/domains/agent";

/** Project-level summary for the latest agent run metadata. */
export const projectAgentAnalysisSummarySchema = Schema.Struct({
  latestJobId: Schema.OptionFromNullOr(agentJobIdSchema),
  latestStatus: Schema.OptionFromNullOr(agentJobStatusSchema),
  qaPassed: Schema.OptionFromNullOr(Schema.Boolean),
  updatedAt: Schema.OptionFromNullOr(IsoDateTime),
});

/** Engine protocol schema for projectStateSchema. */
export const projectStateSchema = Schema.Struct({
  projectPath: Schema.OptionFromNullOr(projectPathSchema),
  recordingURL: Schema.OptionFromNullOr(Schema.String),
  eventsURL: Schema.OptionFromNullOr(Schema.String),
  lastRecordingTelemetry: Schema.OptionFromOptionalNullOr(captureTelemetrySchema, {
    onNoneEncoding: null,
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
      latestJobId: Option.none(),
      latestStatus: Option.none(),
      qaPassed: Option.none(),
      updatedAt: Option.none(),
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
type ProjectStateEncoded = Schema.Codec.Encoded<typeof projectStateSchema>;
/** Type alias for ProjectState values emitted by engine clients after defaults are applied. */
export type ProjectState = Omit<ProjectStateEncoded, "lastRecordingTelemetry"> & {
  readonly lastRecordingTelemetry?: CaptureTelemetry | null;
};
/** Type alias for ProjectRecentItem. */
export type ProjectRecentItem = Schema.Codec.Encoded<typeof projectRecentItemSchema>;
/** Type alias for ProjectRecentsResult. */
export type ProjectRecentsResult = Schema.Codec.Encoded<typeof projectRecentsResultSchema>;
