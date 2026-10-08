import { Schema } from "effect";
import {
  ContractDecodeError,
  EngineClientError,
  EngineOperationError,
  EngineRequestValidationError,
  EngineResponseError,
  JsonParseError,
} from "@guerillaglass/engine-client/errors";

export type FileAccessPolicyErrorCode = FileAccessPolicyError["code"];
export type MediaServerErrorCode = MediaServerError["code"];
export type PathPickerErrorCode = PathPickerError["code"];
export type BrowserStorageErrorCode = BrowserStorageError["code"];
export type BridgeRequestLimitErrorCode = "BRIDGE_REQUEST_RATE_LIMITED" | "BRIDGE_REQUEST_TIMEOUT";
export type CapabilityTokenErrorCode = CapabilityTokenError["code"];
export type ReviewBridgeErrorCode = ReviewBridgeError["code"];
export type StudioActionReason = StudioActionError["reason"];

/**
 * Serialized error payload safe to ship across the Electrobun request boundary.
 *
 * The payload intentionally preserves only the tagged error identity, stable
 * fields needed to reconstruct domain errors, and a recursively summarized
 * cause chain. It does not attempt to preserve opaque runtime objects.
 */
export interface SerializedBridgeError {
  readonly tag: string;
  readonly message?: string;
  readonly data?: Readonly<Record<string, unknown>>;
  readonly cause?: SerializedBridgeError;
}

export const SerializedBridgeError: Schema.Codec<SerializedBridgeError, SerializedBridgeError> =
  Schema.Struct({
    tag: Schema.String,
    message: Schema.optional(Schema.String),
    data: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
    cause: Schema.optional(Schema.suspend(() => SerializedBridgeError)),
  });

export class BridgeUnavailableError extends Schema.TaggedError<BridgeUnavailableError>()(
  "BridgeUnavailableError",
  { bridge: Schema.String },
) {
  get message(): string {
    return `Missing Electrobun bridge: ${this.bridge}`;
  }
}

export class BridgeInvocationError extends Schema.TaggedError<BridgeInvocationError>()(
  "BridgeInvocationError",
  { bridge: Schema.String, cause: Schema.Defect() },
) {
  get message(): string {
    if (this.cause instanceof Error && this.cause.message.trim().length > 0) {
      return this.cause.message;
    }
    return `Bridge invocation failed: ${this.bridge}`;
  }
}

export class StudioActionError extends Schema.TaggedError<StudioActionError>()(
  "StudioActionError",
  {
    reason: Schema.Literals([
      "screen_permission_required",
      "window_selection_required",
      "window_selection_failed",
      "capture_permission_required",
      "export_missing_recording",
      "export_missing_preset",
    ]),
  },
) {
  get message(): string {
    return this.reason;
  }
}

export class FileAccessPolicyError extends Schema.TaggedError<FileAccessPolicyError>()(
  "FileAccessPolicyError",
  {
    code: Schema.Literals([
      "FILE_PATH_REQUIRED",
      "LOCAL_FILE_PATH_INVALID",
      "LOCAL_FILE_URL_UNSUPPORTED",
      "FILE_ACCESS_OUTSIDE_ALLOWED_ROOTS",
      "TEXT_FILE_TYPE_UNSUPPORTED",
      "MEDIA_FILE_TYPE_UNSUPPORTED",
      "TEMP_MEDIA_PREFIX_REQUIRED",
      "PATH_NOT_FILE",
      "FILE_TOO_LARGE",
    ]),
    description: Schema.String,
    cause: Schema.optionalKey(Schema.Defect()),
  },
) {
  get message(): string {
    return this.description;
  }
}

export class MediaServerError extends Schema.TaggedError<MediaServerError>()("MediaServerError", {
  code: Schema.Literals([
    "MEDIA_SERVER_PORT_RESERVATION_FAILED",
    "MEDIA_SERVER_BIND_FAILED",
    "MEDIA_PATH_REQUIRED",
    "MEDIA_PATH_NOT_ABSOLUTE",
    "MEDIA_TYPE_UNSUPPORTED",
    "MEDIA_FILE_MISSING",
    "MEDIA_TOKEN_GENERATION_FAILED",
  ]),
  description: Schema.String,
  cause: Schema.optionalKey(Schema.Defect()),
}) {
  get message(): string {
    return this.description;
  }
}

export class PathPickerError extends Schema.TaggedError<PathPickerError>()("PathPickerError", {
  code: Schema.Literals([
    "PATH_PICKER_OPEN_DIALOG_FAILED",
    "PATH_PICKER_SAVE_DIALOG_FAILED",
    "PATH_PICKER_REQUEST_FAILED",
  ]),
  description: Schema.String,
  cause: Schema.optionalKey(Schema.Defect()),
}) {
  get message(): string {
    return this.description;
  }
}

export class BrowserStorageError extends Schema.TaggedError<BrowserStorageError>()(
  "BrowserStorageError",
  {
    code: Schema.Literals(["BROWSER_STORAGE_UNAVAILABLE", "BROWSER_STORAGE_WRITE_FAILED"]),
    description: Schema.String,
    cause: Schema.optionalKey(Schema.Defect()),
  },
) {
  get message(): string {
    return this.description;
  }
}

export class BridgeRequestLimitError extends Schema.TaggedError<BridgeRequestLimitError>()(
  "BridgeRequestLimitError",
  { requestName: Schema.String, retryAfterMs: Schema.Finite },
) {
  get message(): string {
    return `Too many ${this.requestName} requests. Try again in ${Math.ceil(this.retryAfterMs / 1000)} seconds.`;
  }
}

export class BridgeRequestTimeoutError extends Schema.TaggedError<BridgeRequestTimeoutError>()(
  "BridgeRequestTimeoutError",
  { requestName: Schema.String, timeout: Schema.String },
) {
  get message(): string {
    return `${this.requestName} timed out after ${this.timeout}.`;
  }
}

export class CapabilityTokenError extends Schema.TaggedError<CapabilityTokenError>()(
  "CapabilityTokenError",
  {
    code: Schema.Literal("CAPABILITY_TOKEN_INVALID"),
    description: Schema.String,
    cause: Schema.optionalKey(Schema.Defect()),
  },
) {
  get message(): string {
    return this.description;
  }
}

export class ReviewBridgeError extends Schema.TaggedError<ReviewBridgeError>()(
  "ReviewBridgeError",
  {
    code: Schema.Literals([
      "REVIEW_BRIDGE_URL_MISSING",
      "REVIEW_AUTH_TOKEN_MISSING",
      "REVIEW_REQUEST_FAILED",
    ]),
    description: Schema.String,
    cause: Schema.optionalKey(Schema.Defect()),
  },
) {
  get message(): string {
    return this.description;
  }
}

export class StudioContextUnavailableError extends Schema.TaggedError<StudioContextUnavailableError>()(
  "StudioContextUnavailableError",
  {},
) {
  get message(): string {
    return "Studio context is not available";
  }
}

export class CaptureWindowPickerUnsupportedError extends Schema.TaggedError<CaptureWindowPickerUnsupportedError>()(
  "CaptureWindowPickerUnsupportedError",
  { cause: Schema.optionalKey(Schema.Defect()) },
) {
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
  | BridgeRequestLimitError
  | BridgeRequestTimeoutError
  | CapabilityTokenError
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
    error instanceof BridgeRequestLimitError ||
    error instanceof BridgeRequestTimeoutError ||
    error instanceof CapabilityTokenError ||
    error instanceof ReviewBridgeError ||
    error instanceof JsonParseError ||
    error instanceof StudioContextUnavailableError ||
    error instanceof CaptureWindowPickerUnsupportedError
  );
}
