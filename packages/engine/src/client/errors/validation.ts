import { type Types } from "effect";

export type MutableDeep<T> = Types.DeepMutable<T>;

export type ValidationIssue = {
  readonly path: ReadonlyArray<string | number>;
  readonly message: string;
};

export function formatValidationIssue(issue: ValidationIssue, fallbackPath = "payload"): string {
  const path = issue.path.length > 0 ? issue.path.join(".") : fallbackPath;
  return `${path}: ${issue.message}`;
}
