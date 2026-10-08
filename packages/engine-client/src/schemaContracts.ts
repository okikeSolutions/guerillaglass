import { Effect, Result, Schema, SchemaIssue, type Types } from "effect";
import { ContractDecodeError, JsonParseError } from "./errors";
import type { ValidationIssue } from "./validation";

export type { ValidationIssue };
export type MutableDeep<T> = Types.DeepMutable<T>;

const decodeAllIssuesOptions = {
  errors: "all",
} as const;

export function isValidationIssue(value: unknown): value is ValidationIssue {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value;
  return (
    "path" in candidate &&
    "message" in candidate &&
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

export const parseJsonString = Effect.fn("schemaContracts.parseJsonString")(function (
  raw: string,
  source: string,
): Effect.Effect<unknown, JsonParseError> {
  return Effect.try({
    try: () => JSON.parse(raw) as unknown,
    catch: (cause) => new JsonParseError({ source, cause }),
  });
});

export function parseJsonStringSync(raw: string, source: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    throw new JsonParseError({ source, cause: error });
  }
}

export const decodeUnknownWithSchema = Effect.fn("schemaContracts.decodeUnknownWithSchema")(
  function <S extends Schema.ConstraintCodec<unknown, unknown>>(
    schema: S,
    raw: unknown,
    contract: string,
  ): Effect.Effect<S["Type"], ContractDecodeError> {
    return Effect.mapError(
      Schema.decodeUnknownEffect(schema, decodeAllIssuesOptions)(raw),
      (error) =>
        new ContractDecodeError({
          contract,
          issues: extractValidationIssues(error),
          cause: error,
        }),
    );
  },
);

export function decodeUnknownWithSchemaSync<S extends Schema.ConstraintCodec<unknown, unknown>>(
  schema: S,
  raw: unknown,
  contract: string,
): S["Type"] {
  return Result.match(Schema.decodeUnknownResult(schema, decodeAllIssuesOptions)(raw), {
    onSuccess: (value) => value,
    onFailure: (error) => {
      throw new ContractDecodeError({
        contract,
        issues: extractValidationIssues(error),
        cause: error,
      });
    },
  });
}

export const encodeUnknownWithSchema = Effect.fn("schemaContracts.encodeUnknownWithSchema")(
  function <S extends Schema.ConstraintCodec<unknown, unknown>>(
    schema: S,
    raw: unknown,
    contract: string,
  ): Effect.Effect<S["Encoded"], ContractDecodeError> {
    return Effect.mapError(
      Schema.encodeUnknownEffect(schema, decodeAllIssuesOptions)(raw),
      (error) =>
        new ContractDecodeError({
          contract,
          issues: extractValidationIssues(error),
          cause: error,
        }),
    );
  },
);

export function encodeUnknownWithSchemaSync<S extends Schema.ConstraintCodec<unknown, unknown>>(
  schema: S,
  raw: unknown,
  contract: string,
): S["Encoded"] {
  return Result.match(Schema.encodeUnknownResult(schema, decodeAllIssuesOptions)(raw), {
    onSuccess: (value) => value,
    onFailure: (error) => {
      throw new ContractDecodeError({
        contract,
        issues: extractValidationIssues(error),
        cause: error,
      });
    },
  });
}

export const validateEncodedUnknownWithSchema = Effect.fn(
  "schemaContracts.validateEncodedUnknownWithSchema",
)(function <S extends Schema.ConstraintCodec<unknown, unknown>>(
  schema: S,
  raw: unknown,
  contract: string,
): Effect.Effect<S["Encoded"], ContractDecodeError> {
  return Effect.flatMap(decodeUnknownWithSchema(schema, raw, contract), (decoded) =>
    encodeUnknownWithSchema(schema, decoded, contract),
  );
});

export function validateEncodedUnknownWithSchemaSync<
  S extends Schema.ConstraintCodec<unknown, unknown>,
>(schema: S, raw: unknown, contract: string): S["Encoded"] {
  const decoded = decodeUnknownWithSchemaSync(schema, raw, contract);
  return encodeUnknownWithSchemaSync(schema, decoded, contract);
}

export function decodeJsonStringWithSchemaSync<S extends Schema.ConstraintCodec<unknown, unknown>>(
  schema: S,
  raw: string,
  contract: string,
): S["Type"] {
  return decodeUnknownWithSchemaSync(schema, parseJsonStringSync(raw, contract), contract);
}
