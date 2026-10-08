import { Schema } from "effect";
import { IsoDateTime, NonEmptyString } from "../shared/helpers";
import {
  agentJobIdSchema,
  eventsUrlSchema,
  projectPathSchema,
  recordingUrlSchema,
} from "../schema-primitives";
import {
  autoZoomSettingsSchema,
  backgroundFramingSettingsSchema,
  captureMetadataSchema,
  timelineDocumentSchema,
} from "../shared/valueObjects";
import { captureTelemetrySchema } from "./capture";
import { agentJobStatusSchema } from "./agent";

/**
 * Compact Agent Mode analysis metadata stored in project state.
 */
export const projectAgentAnalysisSummarySchema = Schema.Struct({
  latestJobId: Schema.optionalKey(agentJobIdSchema),
  latestStatus: Schema.optionalKey(agentJobStatusSchema),
  qaPassed: Schema.optionalKey(Schema.Boolean),
  updatedAt: Schema.optionalKey(IsoDateTime),
}).annotate({ identifier: "ProjectAgentAnalysisSummary" });

/**
 * Complete project state returned by current/open/save project endpoints.
 */
export const projectStateSchema = Schema.Struct({
  projectPath: Schema.optionalKey(projectPathSchema),
  recordingURL: Schema.optionalKey(recordingUrlSchema),
  eventsURL: Schema.optionalKey(eventsUrlSchema),
  lastRecordingTelemetry: Schema.optionalKey(captureTelemetrySchema),
  autoZoom: autoZoomSettingsSchema,
  backgroundFraming: backgroundFramingSettingsSchema,
  timeline: timelineDocumentSchema,
  captureMetadata: Schema.optionalKey(captureMetadataSchema),
  agentAnalysis: Schema.optionalKey(projectAgentAnalysisSummarySchema),
}).annotate({ identifier: "ProjectState" });

/**
 * Single recently opened project entry.
 */
export const projectRecentItemSchema = Schema.Struct({
  projectPath: projectPathSchema,
  displayName: NonEmptyString,
  lastOpenedAt: IsoDateTime,
}).annotate({ identifier: "ProjectRecentItem" });

/**
 * Response envelope for recent project entries.
 */
export const projectRecentsResultSchema = Schema.Struct({
  items: Schema.Array(projectRecentItemSchema),
}).annotate({ identifier: "ProjectRecentsResult" });

/**
 * Runtime TypeScript type for stored Agent Mode analysis metadata.
 */
export const ProjectAgentAnalysisSummary = projectAgentAnalysisSummarySchema;
/** Validated ProjectAgentAnalysisSummary record. */
export interface ProjectAgentAnalysisSummary extends Schema.Schema.Type<
  typeof ProjectAgentAnalysisSummary
> {}

/**
 * Runtime TypeScript type for project state responses.
 */
export const ProjectState = projectStateSchema;
/** Validated ProjectState record. */
export interface ProjectState extends Schema.Schema.Type<typeof ProjectState> {}

/**
 * Runtime TypeScript type for a recent project entry.
 */
export const ProjectRecentItem = projectRecentItemSchema;
/** Validated ProjectRecentItem record. */
export interface ProjectRecentItem extends Schema.Schema.Type<typeof ProjectRecentItem> {}

/**
 * Runtime TypeScript type for project-recents responses.
 */
export const ProjectRecentsResult = projectRecentsResultSchema;
/** Validated ProjectRecentsResult record. */
export interface ProjectRecentsResult extends Schema.Schema.Type<typeof ProjectRecentsResult> {}
