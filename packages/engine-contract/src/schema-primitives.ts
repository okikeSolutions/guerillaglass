import { Schema } from "effect";
import { IsoDateTime, NonEmptyString, NonNegativeInt } from "./shared/helpers";

/**
 * Opaque identifier for an active capture session.
 */
export const captureSessionIdSchema = NonEmptyString.pipe(Schema.brand("CaptureSessionId"));

/**
 * Filesystem path to a GuerillaGlass project document.
 */
export const projectPathSchema = NonEmptyString.pipe(Schema.brand("ProjectPath"));

/**
 * Filesystem path to a local file that has been granted to the desktop host.
 */
export const filePathSchema = NonEmptyString.pipe(Schema.brand("FilePath"));

/**
 * File URL or path identifying where an exported render should be written.
 */
export const outputUrlSchema = NonEmptyString.pipe(Schema.brand("OutputUrl"));

/**
 * File URL or path identifying a captured recording.
 */
export const recordingUrlSchema = NonEmptyString.pipe(Schema.brand("RecordingUrl"));

/**
 * File URL or path identifying an engine-produced input event log.
 */
export const eventsUrlSchema = NonEmptyString.pipe(Schema.brand("EventsUrl"));

/**
 * Stable identifier for an engine-supported export preset.
 */
export const exportPresetIdSchema = NonEmptyString.pipe(Schema.brand("ExportPresetId"));

/**
 * Stable identifier for a timeline segment.
 */
export const timelineSegmentIdSchema = NonEmptyString.pipe(Schema.brand("TimelineSegmentId"));

/**
 * Opaque identifier for an asynchronous Agent Mode job.
 */
export const agentJobIdSchema = NonEmptyString.pipe(Schema.brand("AgentJobId"));

/**
 * Opaque token returned by Agent Mode preflight.
 */
export const agentPreflightTokenSchema = NonEmptyString.pipe(Schema.brand("AgentPreflightToken"));

/**
 * Opaque identifier for an asynchronous export job.
 */
export const exportJobIdSchema = NonEmptyString.pipe(Schema.brand("ExportJobId"));

/**
 * Opaque review identifier used by the desktop review bridge.
 */
export const reviewIdSchema = NonEmptyString.pipe(Schema.brand("ReviewId"));

/**
 * Opaque review comment identifier used by the desktop review bridge.
 */
export const reviewCommentIdSchema = NonEmptyString.pipe(Schema.brand("ReviewCommentId"));

/**
 * Opaque review user identifier used by the desktop review bridge.
 */
export const reviewUserIdSchema = NonEmptyString.pipe(Schema.brand("ReviewUserId"));

/**
 * Review authentication token accepted by host-side review bridge requests.
 */
export const reviewAuthTokenSchema = NonEmptyString.pipe(Schema.brand("ReviewAuthToken"));

/**
 * Filesystem path to an engine-produced artifact.
 */
export const artifactPathSchema = NonEmptyString.pipe(Schema.brand("ArtifactPath"));

/**
 * Native display identifier from the capture subsystem.
 */
export const displayIdSchema = NonNegativeInt.pipe(Schema.brand("DisplayId"));

/**
 * Native window identifier from the capture subsystem.
 */
export const windowIdSchema = NonNegativeInt.pipe(Schema.brand("WindowId"));

/**
 * ISO-8601 date-time string used by bridge contracts.
 */
export const isoDateTimeSchema = IsoDateTime;

/**
 * Legacy JSON-RPC request identifier retained only for migration tooling.
 */
export const jsonRpcIdSchema = Schema.Union([Schema.String, Schema.Number]);

/** Branded capture session identifier. */
export type CaptureSessionId = typeof captureSessionIdSchema.Type;
/** Branded project path. */
export type ProjectPath = typeof projectPathSchema.Type;
/** Branded local file path. */
export type FilePath = typeof filePathSchema.Type;
/** Branded export output URL or path. */
export type OutputUrl = typeof outputUrlSchema.Type;
/** Branded recording URL or path. */
export type RecordingUrl = typeof recordingUrlSchema.Type;
/** Branded input-event log URL or path. */
export type EventsUrl = typeof eventsUrlSchema.Type;
/** Branded export preset identifier. */
export type ExportPresetId = typeof exportPresetIdSchema.Type;
/** Branded timeline segment identifier. */
export type TimelineSegmentId = typeof timelineSegmentIdSchema.Type;
/** Branded Agent Mode job identifier. */
export type AgentJobId = typeof agentJobIdSchema.Type;
/** Branded Agent Mode preflight token. */
export type AgentPreflightToken = typeof agentPreflightTokenSchema.Type;
/** Branded export job identifier. */
export type ExportJobId = typeof exportJobIdSchema.Type;
/** Branded hosted review identifier. */
export type ReviewId = typeof reviewIdSchema.Type;
/** Branded hosted review comment identifier. */
export type ReviewCommentId = typeof reviewCommentIdSchema.Type;
/** Branded hosted review user identifier. */
export type ReviewUserId = typeof reviewUserIdSchema.Type;
/** Branded hosted review authentication token. */
export type ReviewAuthToken = typeof reviewAuthTokenSchema.Type;
/** Branded engine artifact path. */
export type ArtifactPath = typeof artifactPathSchema.Type;
/** Branded native display identifier. */
export type DisplayId = typeof displayIdSchema.Type;
/** Branded native window identifier. */
export type WindowId = typeof windowIdSchema.Type;
/** Branded ISO-8601 timestamp. */
export type IsoDateTime = typeof isoDateTimeSchema.Type;
