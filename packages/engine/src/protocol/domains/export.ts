import { Schema } from "effect";
import {
  NonEmptyString,
  NonNegativeInt,
  PositiveInt,
} from "@guerillaglass/engine/protocol/shared/helpers";
import {
  exportPresetIdSchema,
  outputUrlSchema,
} from "@guerillaglass/engine/protocol/schema-primitives";

/** Export preset descriptor returned by `export.info`. */
export const exportPresetSchema = Schema.Struct({
  id: exportPresetIdSchema,
  name: NonEmptyString,
  width: PositiveInt,
  height: PositiveInt,
  fps: PositiveInt,
  fileType: Schema.Literals(["mp4", "mov"]),
});

/** Result payload for `export.info`. */
export const exportInfoResultSchema = Schema.Struct({
  presets: Schema.Array(exportPresetSchema),
});

/** Result payload for `export.run`. */
export const exportRunResultSchema = Schema.Struct({
  outputURL: outputUrlSchema,
});

/** Result payload for `export.runCutPlan`. */
export const exportRunCutPlanResultSchema = Schema.Struct({
  outputURL: outputUrlSchema,
  appliedSegments: NonNegativeInt,
});

/** Type alias for ExportPreset. */
export type ExportPreset = Schema.Schema.Type<typeof exportPresetSchema>;
/** Type alias for ExportInfoResult. */
export type ExportInfoResult = Schema.Schema.Type<typeof exportInfoResultSchema>;
/** Type alias for ExportRunResult. */
export type ExportRunResult = Schema.Schema.Type<typeof exportRunResultSchema>;
/** Type alias for ExportRunCutPlanResult. */
export type ExportRunCutPlanResult = Schema.Schema.Type<typeof exportRunCutPlanResultSchema>;
