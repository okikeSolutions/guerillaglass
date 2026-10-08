import { Schema } from "effect";
import { NonEmptyString, NonNegativeInt, PositiveInt } from "../shared/helpers";
import { exportJobIdSchema, exportPresetIdSchema, outputUrlSchema } from "../schema-primitives";

/**
 * Engine-supported render preset advertised to clients.
 */
export const exportPresetSchema = Schema.Struct({
  id: exportPresetIdSchema,
  name: NonEmptyString,
  width: PositiveInt,
  height: PositiveInt,
  fps: PositiveInt,
  fileType: Schema.Literals(["mp4", "mov"]),
}).annotate({ identifier: "ExportPreset" });

/**
 * Export capability response containing available presets.
 */
export const exportInfoResultSchema = Schema.Struct({
  presets: Schema.Array(exportPresetSchema),
}).annotate({ identifier: "ExportInfoResult" });

/**
 * Initial or polled status for a standard export job.
 */
export const exportRunResultSchema = Schema.Struct({
  jobId: exportJobIdSchema,
  status: Schema.Literals(["queued", "running", "succeeded", "failed"]),
  outputURL: Schema.optionalKey(outputUrlSchema),
}).annotate({ identifier: "ExportRunResult" });

/**
 * Initial status for an export generated from an Agent Mode cut plan.
 */
export const exportRunCutPlanResultSchema = Schema.Struct({
  jobId: exportJobIdSchema,
  status: Schema.Literals(["queued", "running", "succeeded", "failed"]),
  outputURL: Schema.optionalKey(outputUrlSchema),
  appliedSegments: Schema.optionalKey(NonNegativeInt),
}).annotate({ identifier: "ExportRunCutPlanResult" });

/**
 * Runtime TypeScript type for an export preset.
 */
export const ExportPreset = exportPresetSchema;
/** Validated ExportPreset record. */
export interface ExportPreset extends Schema.Schema.Type<typeof ExportPreset> {}

/**
 * Runtime TypeScript type for export-info responses.
 */
export const ExportInfoResult = exportInfoResultSchema;
/** Validated ExportInfoResult record. */
export interface ExportInfoResult extends Schema.Schema.Type<typeof ExportInfoResult> {}

/**
 * Runtime TypeScript type for standard export job responses.
 */
export const ExportRunResult = exportRunResultSchema;
/** Validated ExportRunResult record. */
export interface ExportRunResult extends Schema.Schema.Type<typeof ExportRunResult> {}

/**
 * Runtime TypeScript type for cut-plan export job responses.
 */
export const ExportRunCutPlanResult = exportRunCutPlanResultSchema;
/** Validated ExportRunCutPlanResult record. */
export interface ExportRunCutPlanResult extends Schema.Schema.Type<typeof ExportRunCutPlanResult> {}
