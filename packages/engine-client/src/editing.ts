import { Data, Effect, FileSystem, Path, Schema } from "effect";
import type { EditPlan, EditExportRequest } from "@guerillaglass/engine-contract/domains/editPlan";
import type { ProjectPath } from "@guerillaglass/engine-contract/schema-primitives";
import { EngineClient } from "./service";

/** Commands executed by an external agent within one scoped saved-project session. */
export type EditCommand = Data.TaggedEnum<{
  Review: {};
  Validate: { readonly plan: EditPlan };
  Apply: { readonly plan: EditPlan };
  Export: { readonly request: EditExportRequest };
}>;
/** Constructors for the adapter's internal command decisions. */
export const EditCommand = Data.taggedEnum<EditCommand>();

/** An adapter prerequisite failed before any project mutation. */
export class EditAdapterError extends Schema.TaggedError<EditAdapterError>()("EditAdapterError", {
  message: Schema.String,
}) {}

/** Opens an existing project and executes one validated command without UI automation. */
export const runSavedProjectCommand = Effect.fn("Editing.runSavedProjectCommand")(function* (
  projectPath: ProjectPath,
  command: EditCommand,
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  if (!(yield* fs.exists(path.join(projectPath, "project.json")))) {
    return yield* new EditAdapterError({ message: "An existing saved project is required." });
  }
  const client = yield* EngineClient;
  yield* client.projectOpen({ projectPath });
  switch (command._tag) {
    case "Review": return yield* client.editReview;
    case "Validate": return yield* client.editValidate(command.plan);
    case "Apply": return yield* client.editApply(command.plan);
    case "Export": return yield* client.editExport(command.request);
  }
});
