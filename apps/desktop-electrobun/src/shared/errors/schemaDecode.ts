import { Effect, Schema, SchemaIssue } from "effect";
import {
  ContractDecodeError,
  JsonParseError,
  type MutableDeep,
  type ValidationIssue,
} from "./domain";
import { runEffectSync } from "./effectRuntime";

const decodeAllIssuesOptions = {
  errors: "all",
} as const;

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

export function parseJsonString(
  raw: string,
  source: string,
): Effect.Effect<unknown, JsonParseError> {
  return Effect.try({
    try: () => JSON.parse(raw) as unknown,
    catch: (cause) => new JsonParseError({ source, cause }),
  });
}

export function parseJsonStringSync(raw: string, source: string): unknown {
  return runEffectSync(parseJsonString(raw, source));
}

export function decodeUnknownWithSchema<S extends Schema.Top>(
  schema: S,
  raw: unknown,
  contract: string,
): Effect.Effect<MutableDeep<Schema.Schema.Type<S>>, ContractDecodeError> {
  return Effect.mapError(
    Schema.decodeUnknownEffect(schema as never, decodeAllIssuesOptions)(raw),
    (error) =>
      new ContractDecodeError({
        contract,
        issues: extractValidationIssues(error),
        cause: error,
      }),
  ) as Effect.Effect<MutableDeep<Schema.Schema.Type<S>>, ContractDecodeError>;
}

export function decodeUnknownWithSchemaSync<S extends Schema.Top>(
  schema: S,
  raw: unknown,
  contract: string,
): MutableDeep<Schema.Schema.Type<S>> {
  return runEffectSync(decodeUnknownWithSchema(schema, raw, contract));
}

/** Encodes a decoded schema value into its canonical JSON/wire representation. */
export function encodeUnknownWithSchema<S extends Schema.Top>(
  schema: S,
  raw: unknown,
  contract: string,
): Effect.Effect<MutableDeep<Schema.Codec.Encoded<S>>, ContractDecodeError> {
  return Effect.mapError(
    Schema.encodeUnknownEffect(Schema.toCodecJson(schema), decodeAllIssuesOptions)(raw),
    (error) =>
      new ContractDecodeError({
        contract,
        issues: extractValidationIssues(error),
        cause: error,
      }),
  ) as Effect.Effect<MutableDeep<Schema.Codec.Encoded<S>>, ContractDecodeError>;
}

/** Validates an unknown JSON/wire value and returns it in canonical encoded form. */
export function validateEncodedUnknownWithSchema<S extends Schema.Top>(
  schema: S,
  raw: unknown,
  contract: string,
): Effect.Effect<MutableDeep<Schema.Codec.Encoded<S>>, ContractDecodeError> {
  return Effect.flatMap(decodeUnknownWithSchema(schema, raw, contract), (decoded) =>
    encodeUnknownWithSchema(schema, decoded, contract),
  );
}

export function validateEncodedUnknownWithSchemaSync<S extends Schema.Top>(
  schema: S,
  raw: unknown,
  contract: string,
): MutableDeep<Schema.Codec.Encoded<S>> {
  return runEffectSync(validateEncodedUnknownWithSchema(schema, raw, contract));
}

export function decodeJsonStringWithSchemaSync<S extends Schema.Top>(
  schema: S,
  raw: string,
  contract: string,
): MutableDeep<Schema.Schema.Type<S>> {
  return runEffectSync(
    Effect.flatMap(parseJsonString(raw, contract), (parsed) =>
      decodeUnknownWithSchema(schema, parsed, contract),
    ),
  );
}
