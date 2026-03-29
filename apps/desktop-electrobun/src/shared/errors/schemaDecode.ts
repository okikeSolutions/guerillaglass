import { Cause, Effect, Either, Exit, ParseResult, Schema } from "effect";
import {
  ContractDecodeError,
  JsonParseError,
  type MutableDeep,
  type ValidationIssue,
} from "./domain";

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
  if (!ParseResult.isParseError(error)) {
    return [];
  }
  return ParseResult.ArrayFormatter.formatErrorSync(error)
    .map((issue) => ({
      path: issue.path.flatMap((segment) => {
        if (typeof segment === "string" || typeof segment === "number") {
          return [segment];
        }
        return [];
      }),
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

function runEffectSync<A, E>(effect: Effect.Effect<A, E>): A {
  const exit = Effect.runSyncExit(effect);
  if (Exit.isSuccess(exit)) {
    return exit.value;
  }
  const failure = Cause.failureOrCause(exit.cause);
  if (Either.isLeft(failure)) {
    throw failure.left;
  }
  throw Cause.squash(exit.cause);
}

async function runEffectPromise<A, E>(effect: Effect.Effect<A, E>): Promise<A> {
  const exit = await Effect.runPromiseExit(effect);
  if (Exit.isSuccess(exit)) {
    return exit.value;
  }
  const failure = Cause.failureOrCause(exit.cause);
  if (Either.isLeft(failure)) {
    throw failure.left;
  }
  throw Cause.squash(exit.cause);
}

export function parseJsonStringSync(raw: string, source: string): unknown {
  return runEffectSync(parseJsonString(raw, source));
}

export function decodeUnknownWithSchema<S extends Schema.Schema.AnyNoContext>(
  schema: S,
  raw: unknown,
  contract: string,
): Effect.Effect<MutableDeep<Schema.Schema.Type<S>>, ContractDecodeError> {
  return Effect.mapError(
    Schema.decodeUnknown(schema as never)(raw),
    (error) =>
      new ContractDecodeError({
        contract,
        issues: extractValidationIssues(error),
        cause: error,
      }),
  ) as Effect.Effect<MutableDeep<Schema.Schema.Type<S>>, ContractDecodeError>;
}

export function decodeUnknownWithSchemaPromise<S extends Schema.Schema.AnyNoContext>(
  schema: S,
  raw: unknown,
  contract: string,
): Promise<MutableDeep<Schema.Schema.Type<S>>> {
  return runEffectPromise(decodeUnknownWithSchema(schema, raw, contract));
}

export function decodeUnknownWithSchemaSync<S extends Schema.Schema.AnyNoContext>(
  schema: S,
  raw: unknown,
  contract: string,
): MutableDeep<Schema.Schema.Type<S>> {
  return runEffectSync(decodeUnknownWithSchema(schema, raw, contract));
}

export function decodeJsonStringWithSchemaSync<S extends Schema.Schema.AnyNoContext>(
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
