import { Data, type Types } from "effect";
import {
  ContractDecodeError,
  EngineClientError,
  EngineOperationError,
  EngineRequestValidationError,
  EngineResponseError,
  JsonParseError,
  messageFromUnknownError,
  type EngineClientErrorCode,
} from "@guerillaglass/engine/client/errors/clientErrors";

export type MutableDeep<T> = Types.DeepMutable<T>;

export type ValidationIssue = {
  readonly path: ReadonlyArray<string | number>;
  readonly message: string;
};

export function formatValidationIssue(issue: ValidationIssue, fallbackPath = "payload"): string {
  const path = issue.path.length > 0 ? issue.path.join(".") : fallbackPath;
  return `${path}: ${issue.message}`;
}

export {
  ContractDecodeError,
  EngineClientError,
  EngineOperationError,
  EngineRequestValidationError,
  EngineResponseError,
  JsonParseError,
  messageFromUnknownError,
  type EngineClientErrorCode,
};

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
