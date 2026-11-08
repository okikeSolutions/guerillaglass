import { Schema } from "effect";
import { EditPlan, editPlanIdSchema, editRevisionSchema } from "./editPlan";
import {
  timelineItemSchema,
  timelineDocumentSchema,
  type TimelineDocument,
} from "../shared/valueObjects";
import { timelineSegmentIdSchema } from "../schema-primitives";

const shortText = Schema.NonEmptyString.check(Schema.isMaxLength(2000));
/** A storyboard scene carries editorial intent alongside its exact source edit. */
export const StoryboardScene = Schema.Struct({
  title: shortText,
  purpose: shortText,
  item: timelineItemSchema,
});
export interface StoryboardScene extends Schema.Schema.Type<typeof StoryboardScene> {}

/** Portable handoff from a storyboard agent to an editing agent and desktop review. */
export const EditStoryboard = Schema.Struct({
  version: Schema.Literal(1),
  id: editPlanIdSchema,
  baseRevision: editRevisionSchema,
  sourceRevision: editRevisionSchema,
  brief: Schema.NonEmptyString.check(Schema.isMaxLength(20_000)),
  scenes: Schema.Array(StoryboardScene).check(Schema.isMinLength(1), Schema.isMaxLength(1000)),
}).check(
  Schema.makeFilter(
    (value) =>
      new Set(value.scenes.map((scene) => scene.item.id)).size === value.scenes.length ||
      "Scene IDs must be unique",
  ),
);
export interface EditStoryboard extends Schema.Schema.Type<typeof EditStoryboard> {}

/** Compiles authored intent without inventing ranges, IDs, or camera movements. */
export function compileStoryboard(storyboard: EditStoryboard): EditPlan {
  return {
    version: 1,
    id: storyboard.id,
    baseRevision: storyboard.baseRevision,
    sourceRevision: storyboard.sourceRevision,
    timeline: { version: 2, items: storyboard.scenes.map((scene) => scene.item) },
  };
}

/** Stable scene differences suitable for review without exposing local media paths. */
export function describeSceneChanges(before: TimelineDocument, after: TimelineDocument) {
  const previous = new Map(before.items.map((item, index) => [item.id, { item, index }]));
  const nextIds = new Set(after.items.map((item) => item.id));
  return [
    ...after.items.map((item, index) => {
      const old = previous.get(item.id);
      return {
        id: item.id,
        added: !old,
        removed: false,
        modified: Boolean(old && JSON.stringify(old.item) !== JSON.stringify(item)),
        moved: Boolean(old && old.index !== index),
      };
    }),
    ...before.items
      .filter((item) => !nextIds.has(item.id))
      .map((item) => ({
        id: item.id,
        added: false,
        removed: true,
        modified: false,
        moved: false,
      })),
  ];
}

/** Agent or human feedback tied to one exact rendered revision. */
export const EditRenderReview = Schema.Struct({
  version: Schema.Literal(1),
  revision: editRevisionSchema,
  verdict: Schema.Literals(["approved", "changes_requested"]),
  summary: shortText,
  findings: Schema.Array(
    Schema.Struct({
      sceneId: timelineSegmentIdSchema,
      note: shortText,
    }),
  ).check(Schema.isMaxLength(1000)),
}).check(
  Schema.makeFilter(
    (value) =>
      (value.verdict === "approved" ? value.findings.length === 0 : value.findings.length > 0) ||
      "Approval requires no findings; requested changes require at least one scene finding",
  ),
);
export interface EditRenderReview extends Schema.Schema.Type<typeof EditRenderReview> {}

/** Native-validated proposal baseline, with no local media paths. */
export const EditProposalBaseline = Schema.Struct({
  revision: editRevisionSchema,
  timeline: timelineDocumentSchema,
});
export interface EditProposalBaseline extends Schema.Schema.Type<typeof EditProposalBaseline> {}
