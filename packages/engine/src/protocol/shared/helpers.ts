import { Effect, Schema } from "effect";
import { isoDateTimeSchema } from "@guerillaglass/engine/protocol/schema-primitives";

/** Shared non-empty string schema used by protocol payloads. */
export const NonEmptyString = Schema.NonEmptyString;
/** Shared ISO date-time schema used by protocol payloads. */
export const IsoDateTime = isoDateTimeSchema;
/** Shared non-negative integer schema used by protocol payloads. */
export const NonNegativeInt = Schema.Int.pipe(greaterThanOrEqualTo(0));
/** Shared positive integer schema used by protocol payloads. */
export const PositiveInt = Schema.Int.pipe(greaterThanOrEqualTo(1));
/** Shared non-negative number schema used by protocol payloads. */
export const NonNegativeNumber = Schema.Finite.pipe(greaterThanOrEqualTo(0));
/** Shared positive number schema used by protocol payloads. */
export const PositiveNumber = Schema.Finite.pipe(greaterThan(0));
/** Runtime budget schema constrained to supported Agent Mode limits. */
export const RuntimeBudgetMinutesSchema = PositiveInt.pipe(lessThanOrEqualTo(60));
/** Recent project request limit schema constrained to the supported maximum. */
export const ProjectRecentsLimitSchema = PositiveInt.pipe(lessThanOrEqualTo(100));

const decodeAllIssuesOptions = {
  errors: "all",
} as const;

/** Builds an Effect Schema numeric check for values greater than or equal to a minimum. */
export function greaterThanOrEqualTo(minimum: number) {
  return Schema.check<Schema.Schema<number>>(Schema.isGreaterThanOrEqualTo(minimum));
}

/** Builds an Effect Schema numeric check for values greater than a minimum. */
export function greaterThan(minimum: number) {
  return Schema.check<Schema.Schema<number>>(Schema.isGreaterThan(minimum));
}

/** Builds an Effect Schema numeric check for values less than or equal to a maximum. */
export function lessThanOrEqualTo(maximum: number) {
  return Schema.check<Schema.Schema<number>>(Schema.isLessThanOrEqualTo(maximum));
}

/** Builds an Effect Schema numeric check for values inside an inclusive range. */
export function between(minimum: number, maximum: number) {
  return Schema.check<Schema.Schema<number>>(Schema.isBetween({ minimum, maximum }));
}

/** Adds a decoding default to an optional protocol field. */
export function optionalWith<S extends Schema.Top>(
  schema: S,
  options: { default: () => Schema.Schema.Type<S> },
) {
  return schema.pipe(Schema.withDecodingDefaultTypeKey(Effect.sync(options.default)));
}

/** Builds a typed refinement schema with a stable protocol validation message. */
export function refineSchema<T>(predicate: (value: T) => boolean, message: string) {
  return Schema.check<Schema.Schema<T>>(
    Schema.makeFilter((value: T) => (predicate(value) ? undefined : message)),
  );
}

/** Effectfully decodes an unknown value with all schema issues collected. */
export function decodeSchema<S extends Schema.Top>(schema: S, raw: unknown) {
  return Schema.decodeUnknownEffect(schema, decodeAllIssuesOptions)(raw);
}
