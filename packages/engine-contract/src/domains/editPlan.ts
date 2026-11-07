import { Schema } from "effect";
import { timelineDocumentSchema } from "../shared/valueObjects";
import { projectStateSchema } from "./project";
import { agentFrameRateSchema } from "./agent";
import { outputUrlSchema, exportPresetIdSchema } from "../schema-primitives";
import { NonNegativeNumber } from "../shared/helpers";

/** Identity of an externally authored storyboard edit. */
export const editPlanIdSchema = Schema.NonEmptyString.pipe(Schema.brand("EditPlanId"));
/** Opaque optimistic-concurrency revision issued by the native engine. */
export const editRevisionSchema = Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/u)).pipe(
  Schema.brand("EditRevision"),
);
/** Versioned external edit plan. Timeline clip IDs identify storyboard scenes. */
export const EditPlan = Schema.Struct({
  version: Schema.Literal(1),
  id: editPlanIdSchema,
  baseRevision: editRevisionSchema,
  sourceRevision: editRevisionSchema,
  timeline: timelineDocumentSchema,
}).annotate({ identifier: "EditPlan" });
export interface EditPlan extends Schema.Schema.Type<typeof EditPlan> {}

/** Saved-project snapshot supplied to an external storyboard or editing agent. */
export const EditReview = Schema.Struct({
  revision: editRevisionSchema,
  sourceRevision: editRevisionSchema,
  sourceDurationSeconds: NonNegativeNumber,
  sourceFps: agentFrameRateSchema,
  project: projectStateSchema,
}).annotate({ identifier: "EditReview" });
export interface EditReview extends Schema.Schema.Type<typeof EditReview> {}

/** Export of one explicitly identified saved project revision. */
export const EditExportRequest = Schema.Struct({
  expectedRevision: editRevisionSchema,
  outputURL: outputUrlSchema.check(Schema.isPattern(/^\//u)),
  presetId: exportPresetIdSchema,
}).annotate({ identifier: "EditExportRequest" });
export interface EditExportRequest extends Schema.Schema.Type<typeof EditExportRequest> {}
