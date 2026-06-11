import { Schema } from "effect";
import {
  IsoDateTime,
  NonEmptyString,
  NonNegativeNumber,
  PositiveInt,
  between,
} from "../shared/helpers";
import { agentJobIdSchema } from "../schema-primitives";

/**
 * Lifecycle states for asynchronous Agent Mode jobs.
 */
export const agentJobStatusSchema = Schema.Literals([
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
  "blocked",
]);

/**
 * Transcript source selected for Agent Mode analysis.
 */
export const transcriptionProviderSchema = Schema.Literals(["none", "imported_transcript"]);

/**
 * Reasons that prevent an Agent Mode run from being started.
 */
export const agentPreflightBlockingReasonSchema = Schema.Literals([
  "missing_project",
  "missing_recording",
  "invalid_runtime_budget",
  "source_too_long",
  "source_duration_invalid",
  "missing_local_model",
  "missing_imported_transcript",
  "invalid_imported_transcript",
  "no_audio_track",
  "silent_audio",
]);

/**
 * Reasons that can block or fail an Agent Mode job after it has started.
 */
export const agentRunBlockingReasonSchema = Schema.Literals([
  "missing_project",
  "missing_recording",
  "invalid_runtime_budget",
  "source_too_long",
  "source_duration_invalid",
  "missing_local_model",
  "missing_imported_transcript",
  "invalid_imported_transcript",
  "no_audio_track",
  "silent_audio",
  "empty_transcript",
  "weak_narrative_structure",
]);

/**
 * Quality report produced by Agent Mode after analyzing transcript structure.
 */
export const agentQAReportSchema = Schema.Struct({
  passed: Schema.Boolean,
  score: Schema.Number.pipe(between(0, 1)),
  coverage: Schema.Struct({
    hook: Schema.Boolean,
    action: Schema.Boolean,
    payoff: Schema.Boolean,
    takeaway: Schema.Boolean,
  }),
  missingBeats: Schema.optionalKey(
    Schema.Array(Schema.Literals(["hook", "action", "payoff", "takeaway"])),
  ),
}).annotate({ identifier: "AgentQAReport" });

/**
 * Detailed status summary for a queued, running, or completed Agent Mode job.
 */
export const agentRunSummarySchema = Schema.Struct({
  jobId: agentJobIdSchema,
  status: agentJobStatusSchema,
  runtimeBudgetMinutes: PositiveInt,
  qaReport: Schema.optionalKey(agentQAReportSchema),
  blockingReason: Schema.optionalKey(agentRunBlockingReasonSchema),
  updatedAt: IsoDateTime,
}).annotate({ identifier: "AgentRunSummary" });

/**
 * Result of validating whether the current project can run Agent Mode.
 */
export const agentPreflightResultSchema = Schema.Struct({
  ready: Schema.Boolean,
  blockingReasons: Schema.Array(agentPreflightBlockingReasonSchema),
  canApplyDestructive: Schema.Boolean,
  transcriptionProvider: transcriptionProviderSchema,
  preflightToken: Schema.optionalKey(NonEmptyString),
}).annotate({ identifier: "AgentPreflightResult" });

/**
 * Initial response returned after enqueuing an Agent Mode run.
 */
export const agentRunResultSchema = Schema.Struct({
  jobId: agentJobIdSchema,
  status: agentJobStatusSchema,
}).annotate({ identifier: "AgentRunResult" });

/**
 * Polling response for Agent Mode job status.
 */
export const agentStatusResultSchema = agentRunSummarySchema;

/**
 * Imported transcript segment with text and time bounds in seconds.
 */
export const importedTranscriptSegmentSchema = Schema.Struct({
  text: NonEmptyString,
  startSeconds: NonNegativeNumber,
  endSeconds: NonNegativeNumber,
}).annotate({ identifier: "ImportedTranscriptSegment" });

/**
 * Word-level imported transcript item with time bounds in seconds.
 */
export const importedTranscriptWordSchema = Schema.Struct({
  word: NonEmptyString,
  startSeconds: NonNegativeNumber,
  endSeconds: NonNegativeNumber,
}).annotate({ identifier: "ImportedTranscriptWord" });

/**
 * Imported transcript payload accepted by Agent Mode tooling.
 */
export const importedTranscriptSchema = Schema.Struct({
  segments: Schema.optionalKey(Schema.Array(importedTranscriptSegmentSchema)),
  words: Schema.optionalKey(Schema.Array(importedTranscriptWordSchema)),
}).annotate({ identifier: "ImportedTranscript" });

/**
 * Runtime TypeScript union of Agent Mode job states.
 */
export type AgentJobStatus = Schema.Schema.Type<typeof agentJobStatusSchema>;

/**
 * Runtime TypeScript union of supported transcript providers.
 */
export type TranscriptionProvider = Schema.Schema.Type<typeof transcriptionProviderSchema>;

/**
 * Runtime TypeScript type for Agent Mode preflight responses.
 */
export type AgentPreflightResult = Schema.Schema.Type<typeof agentPreflightResultSchema>;

/**
 * Runtime TypeScript type for Agent Mode run enqueue responses.
 */
export type AgentRunResult = Schema.Schema.Type<typeof agentRunResultSchema>;

/**
 * Runtime TypeScript type for Agent Mode status polling responses.
 */
export type AgentStatusResult = Schema.Schema.Type<typeof agentStatusResultSchema>;
