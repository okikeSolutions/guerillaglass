import { Effect, Ref } from "effect";
import { PathPickerError } from "../../shared/errors/desktopErrors";

/** Only a completed, path-policy-validated export can become an actionable result. */
export const makeExportResultActions = Effect.fn("ExportResultActions.make")(
  function* (dependencies: {
    open: (path: string) => Effect.Effect<boolean, PathPickerError>;
    reveal: (path: string) => Effect.Effect<void, PathPickerError>;
  }) {
    const completedOutput = yield* Ref.make<string | null>(null);
    return {
      remember: (path: string) => Ref.set(completedOutput, path),
      act: Effect.fn("ExportResultActions.act")(function* (action: "open" | "reveal") {
        const output = yield* Ref.get(completedOutput);
        if (!output) {
          return yield* new PathPickerError({
            code: "PATH_PICKER_REQUEST_FAILED",
            description: "No completed export is available.",
          });
        }
        if (action === "reveal") {
          yield* dependencies.reveal(output);
        } else {
          const opened = yield* dependencies.open(output);
          if (!opened) {
            return yield* new PathPickerError({
              code: "PATH_PICKER_REQUEST_FAILED",
              description: "The exported file could not be opened.",
            });
          }
        }
        return true;
      }),
    };
  },
);
