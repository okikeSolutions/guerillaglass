import { Data, type Types } from "effect";

export type MutableDeep<T> = Types.DeepMutable<T>;

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

export type ReviewBridgeErrorCode =
  | "REVIEW_BRIDGE_URL_MISSING"
  | "REVIEW_AUTH_TOKEN_MISSING"
  | "REVIEW_REQUEST_FAILED";

export type StudioActionReason =
  | "screen_permission_required"
  | "window_selection_required"
  | "export_missing_recording"
  | "export_missing_preset";

/**
 * Serialized error payload safe to ship across the Electrobun request boundary.
 *
 * The payload intentionally preserves only the tagged error identity, stable
 * fields needed to reconstruct domain errors, and a recursively summarized
 * cause chain. It does not attempt to preserve opaque runtime objects.
 */
export type SerializedBridgeError = {
  tag: string;
  message?: string;
  data?: Record<string, unknown>;
  cause?: SerializedBridgeError;
};

export class BridgeUnavailableError extends Data.TaggedError("BridgeUnavailableError")<{
  bridge: string;
}> {
  get message(): string {
    return `Missing Electrobun bridge: ${this.bridge}`;
  }
}

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

export class ContractDecodeError extends Data.TaggedError("ContractDecodeError")<{
  contract: string;
  issues: ReadonlyArray<ValidationIssue>;
  cause: unknown;
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

export class EngineResponseError extends Data.TaggedError("EngineResponseError")<{
  code: string;
  description: string;
}> {
  get message(): string {
    return `${this.code}: ${this.description}`;
  }
}

export class EngineClientError extends Data.TaggedError("EngineClientError")<{
  code: EngineClientErrorCode;
  description: string;
  cause?: unknown;
}> {
  get message(): string {
    return this.description;
  }
}

export class EngineOperationError extends Data.TaggedError("EngineOperationError")<{
  operation: string;
  description: string;
}> {
  get message(): string {
    return this.description;
  }
}

export class StudioActionError extends Data.TaggedError("StudioActionError")<{
  reason: StudioActionReason;
}> {
  get message(): string {
    return this.reason;
  }
}

export class FileAccessPolicyError extends Data.TaggedError("FileAccessPolicyError")<{
  code: FileAccessPolicyErrorCode;
  description: string;
  cause?: unknown;
}> {
  get message(): string {
    return this.description;
  }
}

export class MediaServerError extends Data.TaggedError("MediaServerError")<{
  code: MediaServerErrorCode;
  description: string;
  cause?: unknown;
}> {
  get message(): string {
    return this.description;
  }
}

export class PathPickerError extends Data.TaggedError("PathPickerError")<{
  code: PathPickerErrorCode;
  description: string;
  cause?: unknown;
}> {
  get message(): string {
    return this.description;
  }
}

export class BrowserStorageError extends Data.TaggedError("BrowserStorageError")<{
  code: BrowserStorageErrorCode;
  description: string;
  cause?: unknown;
}> {
  get message(): string {
    return this.description;
  }
}

export class ReviewBridgeError extends Data.TaggedError("ReviewBridgeError")<{
  code: ReviewBridgeErrorCode;
  description: string;
  cause?: unknown;
}> {
  get message(): string {
    return this.description;
  }
}

export class JsonParseError extends Data.TaggedError("JsonParseError")<{
  source: string;
  cause?: unknown;
}> {
  get message(): string {
    return `Invalid ${this.source} JSON.`;
  }
}

export class StudioContextUnavailableError extends Data.TaggedError(
  "StudioContextUnavailableError",
)<{ readonly _unused?: never }> {
  get message(): string {
    return "Studio context is not available";
  }
}

export class CaptureWindowPickerUnsupportedError extends Data.TaggedError(
  "CaptureWindowPickerUnsupportedError",
)<{
  cause?: unknown;
}> {
  get message(): string {
    return "Window picker capture is unsupported on this platform.";
  }
}

export type KnownTaggedError =
  | BridgeUnavailableError
  | BridgeInvocationError
  | ContractDecodeError
  | EngineRequestValidationError
  | EngineResponseError
  | EngineClientError
  | EngineOperationError
  | StudioActionError
  | FileAccessPolicyError
  | MediaServerError
  | PathPickerError
  | BrowserStorageError
  | ReviewBridgeError
  | JsonParseError
  | StudioContextUnavailableError
  | CaptureWindowPickerUnsupportedError;

export function isKnownTaggedError(error: unknown): error is KnownTaggedError {
  return (
    error instanceof BridgeUnavailableError ||
    error instanceof BridgeInvocationError ||
    error instanceof ContractDecodeError ||
    error instanceof EngineRequestValidationError ||
    error instanceof EngineResponseError ||
    error instanceof EngineClientError ||
    error instanceof EngineOperationError ||
    error instanceof StudioActionError ||
    error instanceof FileAccessPolicyError ||
    error instanceof MediaServerError ||
    error instanceof PathPickerError ||
    error instanceof BrowserStorageError ||
    error instanceof ReviewBridgeError ||
    error instanceof JsonParseError ||
    error instanceof StudioContextUnavailableError ||
    error instanceof CaptureWindowPickerUnsupportedError
  );
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
