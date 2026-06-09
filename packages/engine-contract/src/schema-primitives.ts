import { Schema } from "effect";
import { IsoDateTime, NonEmptyString } from "./shared/helpers";

/**
 * Opaque identifier for an active capture session.
 */
export const captureSessionIdSchema = NonEmptyString;

/**
 * Filesystem path to a GuerillaGlass project document.
 */
export const projectPathSchema = NonEmptyString;

/**
 * Filesystem path to a local file that has been granted to the desktop host.
 */
export const filePathSchema = NonEmptyString;

/**
 * File URL or path identifying where an exported render should be written.
 */
export const outputUrlSchema = NonEmptyString;

/**
 * Stable identifier for an engine-supported export preset.
 */
export const exportPresetIdSchema = NonEmptyString;

/**
 * Stable identifier for a timeline segment.
 */
export const timelineSegmentIdSchema = NonEmptyString;

/**
 * Opaque identifier for an asynchronous Agent Mode job.
 */
export const agentJobIdSchema = NonEmptyString;

/**
 * Opaque token returned by Agent Mode preflight.
 */
export const agentPreflightTokenSchema = NonEmptyString;

/**
 * Opaque identifier for an asynchronous export job.
 */
export const exportJobIdSchema = NonEmptyString;

/**
 * Opaque review identifier used by the desktop review bridge.
 */
export const reviewIdSchema = NonEmptyString;

/**
 * Opaque review comment identifier used by the desktop review bridge.
 */
export const reviewCommentIdSchema = NonEmptyString;

/**
 * Opaque review user identifier used by the desktop review bridge.
 */
export const reviewUserIdSchema = NonEmptyString;

/**
 * Review authentication token accepted by host-side review bridge requests.
 */
export const reviewAuthTokenSchema = NonEmptyString;

/**
 * Filesystem path to an engine-produced artifact.
 */
export const artifactPathSchema = NonEmptyString;

/**
 * ISO-8601 date-time string used by bridge contracts.
 */
export const isoDateTimeSchema = IsoDateTime;

/**
 * Legacy JSON-RPC request identifier retained only for migration tooling.
 */
export const jsonRpcIdSchema = Schema.Union([Schema.String, Schema.Number]);
