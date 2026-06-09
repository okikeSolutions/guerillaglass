import { Schema } from "effect";

/**
 * A string that must contain at least one character.
 */
export const NonEmptyString = Schema.NonEmptyString;

/**
 * ISO-8601 date-time string used for wire-safe timestamps.
 */
export const IsoDateTime = Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}T/));

/**
 * Integer constrained to values greater than or equal to zero.
 */
export const NonNegativeInt = Schema.Int.pipe(greaterThanOrEqualTo(0));

/**
 * Integer constrained to values greater than or equal to one.
 */
export const PositiveInt = Schema.Int.pipe(greaterThanOrEqualTo(1));

/**
 * Finite number constrained to values greater than or equal to zero.
 */
export const NonNegativeNumber = Schema.Finite.pipe(greaterThanOrEqualTo(0));

/**
 * Finite number constrained to values greater than zero.
 */
export const PositiveNumber = Schema.Finite.pipe(greaterThan(0));

/**
 * Maximum number of recent projects a client can request.
 */
export const ProjectRecentsLimitSchema = PositiveInt.pipe(lessThanOrEqualTo(100));

/**
 * Agent runtime budget in minutes, capped to supported local-engine limits.
 */
export const RuntimeBudgetMinutesSchema = PositiveInt.pipe(lessThanOrEqualTo(60));

/**
 * Builds a reusable numeric schema check for inclusive lower bounds.
 *
 * @param minimum - Smallest accepted value.
 * @returns A schema transformer that preserves the input schema type while adding the check.
 */
export function greaterThanOrEqualTo(minimum: number) {
  return <S extends Schema.Top & { readonly Type: number }>(schema: S): S["Rebuild"] =>
    schema.check(Schema.isGreaterThanOrEqualTo(minimum));
}

/**
 * Builds a reusable numeric schema check for exclusive lower bounds.
 *
 * @param minimum - Value that accepted numbers must exceed.
 * @returns A schema transformer that preserves the input schema type while adding the check.
 */
export function greaterThan(minimum: number) {
  return <S extends Schema.Top & { readonly Type: number }>(schema: S): S["Rebuild"] =>
    schema.check(Schema.isGreaterThan(minimum));
}

/**
 * Builds a reusable numeric schema check for inclusive upper bounds.
 *
 * @param maximum - Largest accepted value.
 * @returns A schema transformer that preserves the input schema type while adding the check.
 */
export function lessThanOrEqualTo(maximum: number) {
  return <S extends Schema.Top & { readonly Type: number }>(schema: S): S["Rebuild"] =>
    schema.check(Schema.isLessThanOrEqualTo(maximum));
}

/**
 * Builds a reusable numeric schema check for an inclusive range.
 *
 * @param minimum - Smallest accepted value.
 * @param maximum - Largest accepted value.
 * @returns A schema transformer that preserves the input schema type while adding the check.
 */
export function between(minimum: number, maximum: number) {
  return <S extends Schema.Top & { readonly Type: number }>(schema: S): S["Rebuild"] =>
    schema.check(Schema.isBetween({ minimum, maximum }));
}
