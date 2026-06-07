import { Schema, SchemaIssue, type Types } from "effect";

/** Deep mutable helper for decoded protocol payloads consumed by Bun APIs. */
export type MutableDeep<T> = Types.DeepMutable<T>;

/** Schema validation issue normalized for protocol and bridge errors. */
export type ValidationIssue = {
  path: Array<string | number>;
  message: string;
};

/** Formats a normalized validation issue for error messages. */
export function formatValidationIssue(issue: ValidationIssue, fallbackPath = "payload"): string {
  const path = issue.path.length > 0 ? issue.path.join(".") : fallbackPath;
  return `${path}: ${issue.message}`;
}

/** Returns true when a value is a normalized validation issue. */
export function isValidationIssue(value: unknown): value is ValidationIssue {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as { path?: unknown; message?: unknown };
  return (
    Array.isArray(candidate.path) &&
    candidate.path.every((segment) => typeof segment === "string" || typeof segment === "number") &&
    typeof candidate.message === "string"
  );
}

/** Extracts normalized validation issues from Effect Schema errors. */
export function extractValidationIssues(error: unknown): ValidationIssue[] {
  if (Array.isArray(error) && error.every((issue) => isValidationIssue(issue))) {
    return error;
  }
  if (!Schema.isSchemaError(error)) {
    return [];
  }
  const formatted = SchemaIssue.makeFormatterStandardSchemaV1()(error.issue).issues;
  return formatted
    .map((issue) => ({
      path:
        issue.path?.flatMap((segment) => {
          if (typeof segment === "string" || typeof segment === "number") {
            return [segment];
          }
          return [];
        }) ?? [],
      message: issue.message,
    }))
    .filter((issue) => isValidationIssue(issue));
}
