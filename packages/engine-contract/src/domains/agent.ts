import { Schema } from "effect";
import {
  IsoDateTime,
  NonEmptyString,
  NonNegativeInt,
  NonNegativeNumber,
  PositiveInt,
  between,
} from "../shared/helpers";
import { agentJobIdSchema, agentPreflightTokenSchema } from "../schema-primitives";

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
 * Versioned Agent Mode artifacts persisted inside the active project package.
 */
export const agentArtifactKindSchema = Schema.Literals([
  "transcript.full.v1",
  "transcript.words.v1",
  "beat-map.v1",
  "qa-report.v1",
  "cut-plan.v1",
  "run-summary.v1",
]);

/**
 * Canonical narrative beats used by deterministic Agent Mode planning.
 */
export const agentNarrativeBeatSchema = Schema.Literals(["hook", "action", "payoff", "takeaway"]);

/**
 * Project-relative artifact reference with each kind bound to its canonical path.
 */
export const agentArtifactReferenceSchema = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("transcript.full.v1"),
    path: Schema.Literal("analysis/transcript.full.v1.json"),
    sha256: Schema.optionalKey(Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/))),
  }),
  Schema.Struct({
    kind: Schema.Literal("transcript.words.v1"),
    path: Schema.Literal("analysis/transcript.words.v1.json"),
    sha256: Schema.optionalKey(Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/))),
  }),
  Schema.Struct({
    kind: Schema.Literal("beat-map.v1"),
    path: Schema.Literal("analysis/beat-map.v1.json"),
    sha256: Schema.optionalKey(Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/))),
  }),
  Schema.Struct({
    kind: Schema.Literal("qa-report.v1"),
    path: Schema.Literal("analysis/qa-report.v1.json"),
    sha256: Schema.optionalKey(Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/))),
  }),
  Schema.Struct({
    kind: Schema.Literal("cut-plan.v1"),
    path: Schema.Literal("analysis/cut-plan.v1.json"),
    sha256: Schema.optionalKey(Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/))),
  }),
  Schema.Struct({
    kind: Schema.Literal("run-summary.v1"),
    path: Schema.Literal("analysis/run-summary.v1.json"),
  }),
]).annotate({ identifier: "AgentArtifactReference" });

/**
 * Rational source frame rate retained without rounding rates such as 30000/1001.
 */
export const agentFrameRateSchema = Schema.Struct({
  numerator: PositiveInt,
  denominator: PositiveInt,
}).annotate({ identifier: "AgentFrameRate" });

/**
 * End-exclusive frame range selected by a deterministic Agent Mode cut plan.
 */
const agentCutPlanSegmentWireSchema = Schema.Struct({
  id: NonEmptyString,
  beat: agentNarrativeBeatSchema,
  startFrame: NonNegativeInt,
  endFrame: PositiveInt,
});
export const agentCutPlanSegmentSchema = agentCutPlanSegmentWireSchema
  .pipe(
    Schema.decodeTo(
      agentCutPlanSegmentWireSchema.check(
        Schema.makeFilter((segment) =>
          segment.endFrame > segment.startFrame
            ? undefined
            : "endFrame must be greater than startFrame",
        ),
      ),
    ),
  )
  .annotate({ identifier: "AgentCutPlanSegment" });

/**
 * Compact, reviewable representation of the cut plan produced by a run.
 */
const agentCutPlanSummaryWireSchema = Schema.Struct({
  version: Schema.Literal(1),
  sourceFps: agentFrameRateSchema,
  sourceFrameCount: PositiveInt,
  segments: Schema.Array(agentCutPlanSegmentSchema),
});
const canonicalBeatOrder = ["hook", "action", "payoff", "takeaway"] as const;
export const agentCutPlanSummarySchema = agentCutPlanSummaryWireSchema
  .pipe(
    Schema.decodeTo(
      agentCutPlanSummaryWireSchema.check(
        Schema.makeFilter((plan) => {
          if (
            plan.segments.length !== canonicalBeatOrder.length ||
            plan.segments.some((segment, index) => segment.beat !== canonicalBeatOrder[index]) ||
            new Set(plan.segments.map((segment) => segment.id)).size !== plan.segments.length
          ) {
            return "segments must have unique IDs and canonical hook/action/payoff/takeaway order";
          }
          let previousEndFrame = 0;
          for (const segment of plan.segments) {
            if (segment.startFrame < previousEndFrame || segment.endFrame > plan.sourceFrameCount) {
              return "segments must be ordered, non-overlapping, and within sourceFrameCount";
            }
            previousEndFrame = segment.endFrame;
          }
          return undefined;
        }),
      ),
    ),
  )
  .annotate({ identifier: "AgentCutPlanSummary" });

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
  score: Schema.Finite.pipe(between(0, 1)),
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
  artifacts: Schema.optionalKey(Schema.Array(agentArtifactReferenceSchema)),
  cutPlan: Schema.optionalKey(agentCutPlanSummarySchema),
  updatedAt: IsoDateTime,
}).annotate({ identifier: "AgentRunSummary" });

/**
 * Result of validating whether the current project can run Agent Mode.
 */
const agentPreflightReadyResultSchema = Schema.Struct({
  ready: Schema.Literal(true),
  blockingReasons: Schema.Array(agentPreflightBlockingReasonSchema).check(
    Schema.isLengthBetween(0, 0),
  ),
  canApplyDestructive: Schema.Boolean,
  transcriptionProvider: transcriptionProviderSchema,
  preflightToken: agentPreflightTokenSchema,
  preflightTokenExpiresAt: IsoDateTime,
}).annotate({ identifier: "AgentPreflightReadyResult" });

const agentPreflightBlockedResultSchema = Schema.Struct({
  ready: Schema.Literal(false),
  blockingReasons: Schema.NonEmptyArray(agentPreflightBlockingReasonSchema),
  canApplyDestructive: Schema.Boolean,
  transcriptionProvider: transcriptionProviderSchema,
}).annotate({ identifier: "AgentPreflightBlockedResult" });

export const agentPreflightResultSchema = Schema.Union([
  agentPreflightReadyResultSchema,
  agentPreflightBlockedResultSchema,
]).annotate({ identifier: "AgentPreflightResult" });

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
 * Verifiable result of applying one Agent Mode cut plan to the working timeline.
 */
export const agentApplyResultSchema = Schema.Struct({
  success: Schema.Literal(true),
  message: Schema.optionalKey(NonEmptyString),
  jobId: agentJobIdSchema,
  status: Schema.Literal("applied"),
  appliedSegments: PositiveInt,
  projectHasUnsavedChanges: Schema.Boolean,
}).annotate({ identifier: "AgentApplyResult" });

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
 * Runtime TypeScript type for successful Agent Mode apply responses.
 */
export type AgentApplyResult = Schema.Schema.Type<typeof agentApplyResultSchema>;

/**
 * Runtime TypeScript type for Agent Mode run enqueue responses.
 */
export type AgentRunResult = Schema.Schema.Type<typeof agentRunResultSchema>;

/**
 * Runtime TypeScript type for Agent Mode status polling responses.
 */
export type AgentStatusResult = Schema.Schema.Type<typeof agentStatusResultSchema>;
