import { Schema } from "effect";

/** Shared ISO 8601 datetime validation for typed protocol surfaces. */
export const isoDateTimePattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

/** Effect Schema primitive for canonical ISO 8601 datetime strings. */
export const isoDateTimeSchema = Schema.String.pipe(
  Schema.pattern(isoDateTimePattern),
  Schema.filter((value) => !Number.isNaN(Date.parse(value)), {
    message: () => "Expected an ISO 8601 datetime string.",
  }),
);
