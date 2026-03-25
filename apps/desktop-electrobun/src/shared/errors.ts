import { Cause, Data, Effect, Either, Exit, ParseResult, Schema } from "effect";

export type MutableDeep<T> =
  T extends ReadonlyArray<infer U>
    ? MutableDeep<U>[]
    : T extends object
      ? { -readonly [K in keyof T]: MutableDeep<T[K]> }
      : T;

export type ValidationIssue = {
  path: Array<string | number>;
  message: string;
};

export type EngineClientErrorCode =
  | "ENGINE_CLIENT_STOPPED"
  | "ENGINE_PROCESS_UNAVAILABLE"
  | "ENGINE_REQUEST_TIMEOUT"
  | "ENGINE_STDIO_WRITE_FAILED"
  | "ENGINE_PROCESS_EXITED"
  | "ENGINE_PROCESS_FAILED"
  | "ENGINE_RESTART_CIRCUIT_OPEN";

export type FileAccessPolicyErrorCode =
  | "FILE_PATH_REQUIRED"
  | "LOCAL_FILE_PATH_INVALID"
  | "LOCAL_FILE_URL_UNSUPPORTED"
  | "FILE_ACCESS_OUTSIDE_ALLOWED_ROOTS"
  | "TEXT_FILE_TYPE_UNSUPPORTED"
  | "MEDIA_FILE_TYPE_UNSUPPORTED"
  | "TEMP_MEDIA_PREFIX_REQUIRED"
  | "PATH_NOT_FILE"
  | "FILE_TOO_LARGE";

export type MediaServerErrorCode =
  | "MEDIA_SERVER_PORT_RESERVATION_FAILED"
  | "MEDIA_SERVER_BIND_FAILED"
  | "MEDIA_PATH_REQUIRED"
  | "MEDIA_PATH_NOT_ABSOLUTE"
  | "MEDIA_TYPE_UNSUPPORTED"
  | "MEDIA_FILE_MISSING";

export type PathPickerErrorCode =
  | "PATH_PICKER_OPEN_DIALOG_FAILED"
  | "PATH_PICKER_SAVE_DIALOG_FAILED"
  | "PATH_PICKER_REQUEST_FAILED";

export type BrowserStorageErrorCode =
  | "BROWSER_STORAGE_UNAVAILABLE"
  | "BROWSER_STORAGE_WRITE_FAILED";

export type StudioActionReason =
  | "screen_permission_required"
  | "window_selection_required"
  | "export_missing_recording"
  | "export_missing_preset";

/** Tagged error raised when a desktop bridge binding is missing from the renderer window. */
export class BridgeUnavailableError extends Data.TaggedError("BridgeUnavailableError")<{
  bridge: string;
}> {
  get message(): string {
    return `Missing Electrobun bridge: ${this.bridge}`;
  }
}

/** Tagged error raised when a desktop bridge binding rejects while the renderer is invoking it. */
export class BridgeInvocationError extends Data.TaggedError("BridgeInvocationError")<{
  bridge: string;
  cause: unknown;
}> {
  get message(): string {
    if (this.cause instanceof Error && this.cause.message.trim().length > 0) {
      return this.cause.message;
    }
    return `Bridge invocation failed: ${this.bridge}`;
  }
}

/** Tagged error raised when shared schema decoding rejects a bridge or engine payload. */
export class ContractDecodeError extends Data.TaggedError("ContractDecodeError")<{
  contract: string;
  issues: ReadonlyArray<ValidationIssue>;
  cause: ParseResult.ParseError;
}> {
  get message(): string {
    if (this.issues.length === 0) {
      return `Invalid ${this.contract} payload.`;
    }
    const details = this.issues
      .slice(0, 3)
      .map((issue) => formatValidationIssue(issue, this.contract))
      .join("; ");
    return `Invalid ${this.contract} payload (${details}).`;
  }
}

/** Tagged error raised when renderer or Bun code constructs an invalid engine request. */
export class EngineRequestValidationError extends Data.TaggedError("EngineRequestValidationError")<{
  method: string;
  issues: ReadonlyArray<ValidationIssue>;
  hint: string;
  cause?: unknown;
}> {
  get message(): string {
    const details = this.issues
      .slice(0, 3)
      .map((issue) => formatValidationIssue(issue))
      .join("; ");
    return `invalid_params: ${this.method} request validation failed (${details}). ${this.hint}`;
  }
}

/** Tagged error raised when the native engine returns an error response envelope. */
export class EngineResponseError extends Data.TaggedError("EngineResponseError")<{
  code: string;
  description: string;
}> {
  get message(): string {
    return `${this.code}: ${this.description}`;
  }
}

/** Tagged error raised for transport/process failures in the Bun engine client. */
export class EngineClientError extends Data.TaggedError("EngineClientError")<{
  code: EngineClientErrorCode;
  description: string;
  cause?: unknown;
}> {
  get message(): string {
    return this.description;
  }
}

/** Tagged error raised for engine operations that fail outside the RPC response envelope flow. */
export class EngineOperationError extends Data.TaggedError("EngineOperationError")<{
  operation: string;
  description: string;
}> {
  get message(): string {
    return this.description;
  }
}

/** Tagged error raised for UI preconditions before invoking engine work. */
export class StudioActionError extends Data.TaggedError("StudioActionError")<{
  reason: StudioActionReason;
}> {
  get message(): string {
    return this.reason;
  }
}

/** Tagged error raised for local file-path policy violations enforced by the Bun bridge. */
export class FileAccessPolicyError extends Data.TaggedError("FileAccessPolicyError")<{
  code: FileAccessPolicyErrorCode;
  description: string;
  cause?: unknown;
}> {
  get message(): string {
    return this.description;
  }
}

/** Tagged error raised for loopback media server startup and media-source resolution failures. */
export class MediaServerError extends Data.TaggedError("MediaServerError")<{
  code: MediaServerErrorCode;
  description: string;
  cause?: unknown;
}> {
  get message(): string {
    return this.description;
  }
}

/** Tagged error raised for host path picker failures before they are surfaced in the renderer. */
export class PathPickerError extends Data.TaggedError("PathPickerError")<{
  code: PathPickerErrorCode;
  description: string;
  cause?: unknown;
}> {
  get message(): string {
    return this.description;
  }
}

/** Tagged error raised when browser storage is unavailable or write operations fail. */
export class BrowserStorageError extends Data.TaggedError("BrowserStorageError")<{
  code: BrowserStorageErrorCode;
  description: string;
  cause?: unknown;
}> {
  get message(): string {
    return this.description;
  }
}

/** Tagged error raised when JSON text cannot be parsed before schema validation. */
export class JsonParseError extends Data.TaggedError("JsonParseError")<{
  source: string;
  cause?: unknown;
}> {
  get message(): string {
    return `Invalid ${this.source} JSON.`;
  }
}

/** Tagged error raised when the Studio provider hook is used outside its context boundary. */
export class StudioContextUnavailableError extends Data.TaggedError(
  "StudioContextUnavailableError",
)<{ readonly _unused?: never }> {
  get message(): string {
    return "Studio context is not available";
  }
}

/** Tagged error raised when the native engine cannot open the system window picker flow. */
export class CaptureWindowPickerUnsupportedError extends Data.TaggedError(
  "CaptureWindowPickerUnsupportedError",
)<{
  cause?: unknown;
}> {
  get message(): string {
    return "Window picker capture is unsupported on this platform.";
  }
}

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

export function formatValidationIssue(issue: ValidationIssue, root = "params"): string {
  const path = issue.path.length > 0 ? issue.path.join(".") : root;
  return `${path}: ${issue.message}`;
}

export function messageFromUnknownError(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallbackMessage;
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
  return Effect.runPromise(decodeUnknownWithSchema(schema, raw, contract));
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
