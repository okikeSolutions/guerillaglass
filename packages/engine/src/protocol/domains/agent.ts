import { Schema } from "effect";
import {
  IsoDateTime,
  NonEmptyString,
  NonNegativeNumber,
  PositiveInt,
  between,
  optionalWith,
} from "@guerillaglass/engine/protocol/shared/helpers";
import {
  agentJobIdSchema,
  agentPreflightTokenSchema,
  artifactPathSchema,
} from "@guerillaglass/engine/protocol/schema-primitives";

/** Agent job lifecycle statuses. */
export const agentJobStatusSchema = Schema.Literals([
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
  "blocked",
]);

/** Artifact kinds emitted by `agent.run`. */
export const agentArtifactKindSchema = Schema.Literals([
  "transcript.full.v1",
  "transcript.words.v1",
  "beat-map.v1",
  "qa-report.v1",
  "cut-plan.v1",
  "run-summary.v1",
]);

/** Single persisted agent artifact descriptor. */
export const agentArtifactSchema = Schema.Struct({
  kind: agentArtifactKindSchema,
  path: artifactPathSchema,
});

/** Supported transcription providers for Agent Mode v1. */
export const transcriptionProviderSchema = Schema.Literals(["none", "imported_transcript"]);

/** Single imported transcript segment entry with absolute timing in seconds. */
export const importedTranscriptSegmentSchema = Schema.Struct({
  text: NonEmptyString,
  startSeconds: NonNegativeNumber,
  endSeconds: NonNegativeNumber,
}).check(
  Schema.makeFilter((segment) =>
    segment.endSeconds > segment.startSeconds
      ? undefined
      : {
          path: ["endSeconds"],
          issue: "Imported transcript segment endSeconds must be greater than startSeconds.",
        },
  ),
);

/** Single imported transcript word entry with absolute timing in seconds. */
export const importedTranscriptWordSchema = Schema.Struct({
  word: NonEmptyString,
  startSeconds: NonNegativeNumber,
  endSeconds: NonNegativeNumber,
}).check(
  Schema.makeFilter((word) =>
    word.endSeconds > word.startSeconds
      ? undefined
      : {
          path: ["endSeconds"],
          issue: "Imported transcript word endSeconds must be greater than startSeconds.",
        },
  ),
);

/** Canonical imported transcript payload accepted by Agent Mode v1. */
export const importedTranscriptSchema = Schema.Struct({
  segments: optionalWith(Schema.Array(importedTranscriptSegmentSchema), {
    default: () => [],
  }),
  words: optionalWith(Schema.Array(importedTranscriptWordSchema), {
    default: () => [],
  }),
}).check(
  Schema.makeFilter((transcript) =>
    transcript.segments.length > 0 || transcript.words.length > 0
      ? undefined
      : [
          {
            path: ["segments"],
            issue: "Imported transcript must contain at least one segment or one word entry.",
          },
          {
            path: ["words"],
            issue: "Imported transcript must contain at least one segment or one word entry.",
          },
        ],
  ),
);

/** Machine-readable reasons emitted by Agent Mode preflight. */
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

/** Machine-readable reasons emitted by Agent Mode run/status payloads. */
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

const agentBeatSchema = Schema.Literals(["hook", "action", "payoff", "takeaway"]);

/** Narrative QA gate report produced by `agent.run`. */
export const agentQAReportSchema = Schema.Struct({
  passed: Schema.Boolean,
  score: Schema.Finite.pipe(between(0, 1)),
  coverage: Schema.Struct({
    hook: Schema.Boolean,
    action: Schema.Boolean,
    payoff: Schema.Boolean,
    takeaway: Schema.Boolean,
  }),
  missingBeats: optionalWith(Schema.Array(agentBeatSchema), { default: () => [] }),
});

/** Summary payload for agent pipeline execution. */
export const agentRunSummarySchema = Schema.Struct({
  jobId: agentJobIdSchema,
  status: agentJobStatusSchema,
  runtimeBudgetMinutes: PositiveInt,
  qaReport: Schema.OptionFromNullOr(agentQAReportSchema),
  blockingReason: Schema.OptionFromNullOr(agentRunBlockingReasonSchema),
  updatedAt: IsoDateTime,
});

/** Result payload for `agent.preflight`. */
export const agentPreflightResultSchema = Schema.Struct({
  ready: Schema.Boolean,
  blockingReasons: Schema.Array(agentPreflightBlockingReasonSchema),
  canApplyDestructive: Schema.Boolean,
  transcriptionProvider: transcriptionProviderSchema,
  preflightToken: Schema.OptionFromNullOr(agentPreflightTokenSchema),
});

/** Result payload for `agent.run`. */
export const agentRunResultSchema = Schema.Struct({
  jobId: agentJobIdSchema,
  status: agentJobStatusSchema,
});

/** Result payload for `agent.status`. */
export const agentStatusResultSchema = agentRunSummarySchema;

/** Type alias for AgentJobStatus. */
export type AgentJobStatus = Schema.Codec.Encoded<typeof agentJobStatusSchema>;
/** Type alias for AgentArtifactKind. */
export type AgentArtifactKind = Schema.Codec.Encoded<typeof agentArtifactKindSchema>;
/** Type alias for AgentArtifact. */
export type AgentArtifact = Schema.Codec.Encoded<typeof agentArtifactSchema>;
/** Type alias for TranscriptionProvider. */
export type TranscriptionProvider = Schema.Codec.Encoded<typeof transcriptionProviderSchema>;
/** Type alias for ImportedTranscriptSegment. */
export type ImportedTranscriptSegment = Schema.Codec.Encoded<typeof importedTranscriptSegmentSchema>;
/** Type alias for ImportedTranscriptWord. */
export type ImportedTranscriptWord = Schema.Codec.Encoded<typeof importedTranscriptWordSchema>;
/** Type alias for ImportedTranscript. */
export type ImportedTranscript = Schema.Codec.Encoded<typeof importedTranscriptSchema>;
/** Type alias for AgentPreflightBlockingReason. */
export type AgentPreflightBlockingReason = Schema.Schema.Type<
  typeof agentPreflightBlockingReasonSchema
>;
/** Type alias for AgentRunBlockingReason. */
export type AgentRunBlockingReason = Schema.Codec.Encoded<typeof agentRunBlockingReasonSchema>;
/** Type alias for AgentQAReport. */
export type AgentQAReport = Schema.Codec.Encoded<typeof agentQAReportSchema>;
/** Type alias for AgentRunSummary. */
export type AgentRunSummary = Schema.Codec.Encoded<typeof agentRunSummarySchema>;
/** Type alias for AgentPreflightResult. */
export type AgentPreflightResult = Schema.Codec.Encoded<typeof agentPreflightResultSchema>;
/** Type alias for AgentRunResult. */
export type AgentRunResult = Schema.Codec.Encoded<typeof agentRunResultSchema>;
/** Type alias for AgentStatusResult. */
export type AgentStatusResult = Schema.Codec.Encoded<typeof agentStatusResultSchema>;
