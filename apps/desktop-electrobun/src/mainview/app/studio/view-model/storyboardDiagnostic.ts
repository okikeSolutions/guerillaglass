import { Result, Schema, SchemaIssue } from "effect";
import { EditStoryboard } from "@guerillaglass/engine-contract/domains/editWorkflow";

const parseJson = Schema.decodeUnknownResult(Schema.fromJsonString(Schema.Unknown));
const decodeStoryboard = Schema.decodeUnknownResult(EditStoryboard);
const describeIssue = SchemaIssue.makeFormatterStandardSchemaV1({
  leafHook: (issue) => issue._tag,
  checkHook: () => "InvalidValue",
});

export type StoryboardDiagnostic =
  | { kind: "json" }
  | { kind: "version" }
  | { kind: "duplicate"; scene: number; previous: number }
  | { kind: "missing" | "value"; field: string };

/** Local diagnostics retain schema paths without exposing raw parser messages/input. */
export function decodeStoryboardForReview(
  text: string,
): Result.Result<EditStoryboard, StoryboardDiagnostic> {
  const parsed = parseJson(text);
  if (Result.isFailure(parsed)) {
    return Result.fail({ kind: "json" });
  }
  const decoded = decodeStoryboard(parsed.success);
  if (Result.isSuccess(decoded)) {
    return Result.succeed(decoded.success);
  }
  const value = parsed.success;
  if (typeof value === "object" && value !== null) {
    if ("version" in value && value.version !== 1) {
      return Result.fail({ kind: "version" });
    }
    if ("scenes" in value && Array.isArray(value.scenes)) {
      const ids = new Map<string, number>();
      for (const [index, scene] of value.scenes.entries()) {
        if (typeof scene !== "object" || scene === null || !("item" in scene)) {
          continue;
        }
        const item = scene.item;
        if (
          typeof item !== "object" ||
          item === null ||
          !("id" in item) ||
          typeof item.id !== "string"
        ) {
          continue;
        }
        const previous = ids.get(item.id);
        if (previous !== undefined) {
          return Result.fail({ kind: "duplicate", scene: index + 1, previous: previous + 1 });
        }
        ids.set(item.id, index);
      }
    }
  }
  const issue = describeIssue(decoded.failure.issue).issues[0];
  const field =
    issue?.path
      ?.map((part) => (typeof part === "object" ? String(part.key) : String(part)))
      .join(".") || "$";
  return Result.fail({ kind: issue?.message === "MissingKey" ? "missing" : "value", field });
}
