import { type Types } from "effect";

/** Deep mutable helper used at JSON/schema boundaries. */
export type MutableDeep<T> = Types.DeepMutable<T>;

/** Stable validation issue shape for schema decode errors. */
export type ValidationIssue = {
  readonly path: ReadonlyArray<string | number>;
  readonly message: string;
};

/** Formats a validation issue for human-readable diagnostics. */
export function formatValidationIssue(issue: ValidationIssue, fallbackPath = "payload"): string {
  const path = issue.path.length > 0 ? issue.path.join(".") : fallbackPath;
  return `${path}: ${issue.message}`;
}
