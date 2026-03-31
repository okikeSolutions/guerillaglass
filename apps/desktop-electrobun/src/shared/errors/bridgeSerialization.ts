import { ParseResult } from "effect";
import {
  BridgeInvocationError,
  BridgeUnavailableError,
  BrowserStorageError,
  CaptureWindowPickerUnsupportedError,
  ContractDecodeError,
  EngineClientError,
  EngineOperationError,
  EngineRequestValidationError,
  EngineResponseError,
  FileAccessPolicyError,
  JsonParseError,
  MediaServerError,
  PathPickerError,
  ReviewBridgeError,
  StudioActionError,
  StudioContextUnavailableError,
  messageFromUnknownError,
  type BrowserStorageErrorCode,
  type EngineClientErrorCode,
  type FileAccessPolicyErrorCode,
  type MediaServerErrorCode,
  type PathPickerErrorCode,
  type ReviewBridgeErrorCode,
  type SerializedBridgeError,
  type StudioActionReason,
  type ValidationIssue,
} from "./domain";
import { isValidationIssue } from "./schemaDecode";

function serializeBridgeErrorInternal(error: unknown, depth: number): SerializedBridgeError {
  if (depth >= 3) {
    return {
      tag: "UnknownError",
      message: messageFromUnknownError(error, "Bridge error serialization depth exceeded."),
    };
  }

  if (error instanceof BridgeUnavailableError) {
    return {
      tag: "BridgeUnavailableError",
      data: { bridge: error.bridge },
    };
  }
  if (error instanceof BridgeInvocationError) {
    return {
      tag: "BridgeInvocationError",
      data: { bridge: error.bridge },
      cause:
        error.cause === undefined
          ? undefined
          : serializeBridgeErrorInternal(error.cause, depth + 1),
    };
  }
  if (error instanceof ContractDecodeError) {
    return {
      tag: "ContractDecodeError",
      data: {
        contract: error.contract,
        issues: [...error.issues],
      },
      cause:
        error.cause === undefined
          ? undefined
          : serializeBridgeErrorInternal(error.cause, depth + 1),
    };
  }
  if (error instanceof EngineRequestValidationError) {
    return {
      tag: "EngineRequestValidationError",
      data: {
        method: error.method,
        issues: [...error.issues],
        hint: error.hint,
      },
      cause:
        error.cause === undefined
          ? undefined
          : serializeBridgeErrorInternal(error.cause, depth + 1),
    };
  }
  if (error instanceof EngineResponseError) {
    return {
      tag: "EngineResponseError",
      data: {
        code: error.code,
        description: error.description,
      },
    };
  }
  if (error instanceof EngineClientError) {
    return {
      tag: "EngineClientError",
      data: {
        code: error.code,
        description: error.description,
      },
      cause:
        error.cause === undefined
          ? undefined
          : serializeBridgeErrorInternal(error.cause, depth + 1),
    };
  }
  if (error instanceof EngineOperationError) {
    return {
      tag: "EngineOperationError",
      data: {
        operation: error.operation,
        description: error.description,
      },
    };
  }
  if (error instanceof StudioActionError) {
    return {
      tag: "StudioActionError",
      data: { reason: error.reason },
    };
  }
  if (error instanceof FileAccessPolicyError) {
    return {
      tag: "FileAccessPolicyError",
      data: {
        code: error.code,
        description: error.description,
      },
      cause:
        error.cause === undefined
          ? undefined
          : serializeBridgeErrorInternal(error.cause, depth + 1),
    };
  }
  if (error instanceof MediaServerError) {
    return {
      tag: "MediaServerError",
      data: {
        code: error.code,
        description: error.description,
      },
      cause:
        error.cause === undefined
          ? undefined
          : serializeBridgeErrorInternal(error.cause, depth + 1),
    };
  }
  if (error instanceof PathPickerError) {
    return {
      tag: "PathPickerError",
      data: {
        code: error.code,
        description: error.description,
      },
      cause:
        error.cause === undefined
          ? undefined
          : serializeBridgeErrorInternal(error.cause, depth + 1),
    };
  }
  if (error instanceof BrowserStorageError) {
    return {
      tag: "BrowserStorageError",
      data: {
        code: error.code,
        description: error.description,
      },
      cause:
        error.cause === undefined
          ? undefined
          : serializeBridgeErrorInternal(error.cause, depth + 1),
    };
  }
  if (error instanceof ReviewBridgeError) {
    return {
      tag: "ReviewBridgeError",
      data: {
        code: error.code,
        description: error.description,
      },
      cause:
        error.cause === undefined
          ? undefined
          : serializeBridgeErrorInternal(error.cause, depth + 1),
    };
  }
  if (error instanceof JsonParseError) {
    return {
      tag: "JsonParseError",
      data: { source: error.source },
      cause:
        error.cause === undefined
          ? undefined
          : serializeBridgeErrorInternal(error.cause, depth + 1),
    };
  }
  if (error instanceof StudioContextUnavailableError) {
    return {
      tag: "StudioContextUnavailableError",
    };
  }
  if (error instanceof CaptureWindowPickerUnsupportedError) {
    return {
      tag: "CaptureWindowPickerUnsupportedError",
      cause:
        error.cause === undefined
          ? undefined
          : serializeBridgeErrorInternal(error.cause, depth + 1),
    };
  }
  if (error instanceof Error) {
    const { cause, name, stack } = error as Error & { cause?: unknown };
    return {
      tag: "UnknownError",
      message: messageFromUnknownError(error, "Unknown bridge error."),
      data: {
        name,
        stack,
      },
      cause: cause === undefined ? undefined : serializeBridgeErrorInternal(cause, depth + 1),
    };
  }
  return {
    tag: "UnknownError",
    message: messageFromUnknownError(error, "Unknown bridge error."),
  };
}

/** Serializes a tagged domain error into a plain payload for bridge transport. */
export function serializeBridgeError(error: unknown): SerializedBridgeError {
  return serializeBridgeErrorInternal(error, 0);
}

function readSerializedBridgeField(
  serialized: SerializedBridgeError,
  key: string,
): unknown | undefined {
  return serialized.data?.[key];
}

function readSerializedBridgeString(
  serialized: SerializedBridgeError,
  key: string,
  fallback: string,
): string {
  const value = readSerializedBridgeField(serialized, key);
  return typeof value === "string" ? value : fallback;
}

function readSerializedBridgeIssues(serialized: SerializedBridgeError): ValidationIssue[] {
  const issues = readSerializedBridgeField(serialized, "issues");
  if (!Array.isArray(issues)) {
    return [];
  }
  return issues.filter((issue) => isValidationIssue(issue));
}

/**
 * Reconstructs a local tagged error from a serialized bridge payload.
 *
 * Unknown or partially malformed payloads fall back to generic `Error` instances so
 * transport failures still surface a useful message even when the exact tag cannot be restored.
 */
export function deserializeBridgeError(serialized: SerializedBridgeError): Error {
  const cause = serialized.cause ? deserializeBridgeError(serialized.cause) : undefined;

  switch (serialized.tag) {
    case "BridgeUnavailableError":
      return new BridgeUnavailableError({
        bridge: readSerializedBridgeString(serialized, "bridge", "unknown bridge"),
      });
    case "BridgeInvocationError":
      return new BridgeInvocationError({
        bridge: readSerializedBridgeString(serialized, "bridge", "unknown bridge"),
        cause,
      });
    case "ContractDecodeError":
      return new ContractDecodeError({
        contract: readSerializedBridgeString(serialized, "contract", "bridge contract"),
        issues: readSerializedBridgeIssues(serialized),
        cause: (cause ??
          new Error(serialized.message ?? "Invalid bridge payload.")) as ParseResult.ParseError,
      });
    case "EngineRequestValidationError":
      return new EngineRequestValidationError({
        method: readSerializedBridgeString(serialized, "method", "unknown method"),
        issues: readSerializedBridgeIssues(serialized),
        hint: readSerializedBridgeString(serialized, "hint", "Invalid request payload."),
        cause,
      });
    case "EngineResponseError":
      return new EngineResponseError({
        code: readSerializedBridgeString(serialized, "code", "unknown_error"),
        description: readSerializedBridgeString(serialized, "description", "Unknown engine error."),
      });
    case "EngineClientError":
      return new EngineClientError({
        code: readSerializedBridgeString(
          serialized,
          "code",
          "ENGINE_PROCESS_FAILED",
        ) as EngineClientErrorCode,
        description: readSerializedBridgeString(
          serialized,
          "description",
          "Unknown engine client error.",
        ),
        cause,
      });
    case "EngineOperationError":
      return new EngineOperationError({
        operation: readSerializedBridgeString(serialized, "operation", "unknown_operation"),
        description: readSerializedBridgeString(
          serialized,
          "description",
          "Unknown engine operation error.",
        ),
      });
    case "StudioActionError":
      return new StudioActionError({
        reason: readSerializedBridgeString(
          serialized,
          "reason",
          "screen_permission_required",
        ) as StudioActionReason,
      });
    case "FileAccessPolicyError":
      return new FileAccessPolicyError({
        code: readSerializedBridgeString(
          serialized,
          "code",
          "FILE_PATH_REQUIRED",
        ) as FileAccessPolicyErrorCode,
        description: readSerializedBridgeString(
          serialized,
          "description",
          "Unknown file access policy error.",
        ),
        cause,
      });
    case "MediaServerError":
      return new MediaServerError({
        code: readSerializedBridgeString(
          serialized,
          "code",
          "MEDIA_PATH_REQUIRED",
        ) as MediaServerErrorCode,
        description: readSerializedBridgeString(
          serialized,
          "description",
          "Unknown media server error.",
        ),
        cause,
      });
    case "PathPickerError":
      return new PathPickerError({
        code: readSerializedBridgeString(
          serialized,
          "code",
          "PATH_PICKER_REQUEST_FAILED",
        ) as PathPickerErrorCode,
        description: readSerializedBridgeString(
          serialized,
          "description",
          "Unknown path picker error.",
        ),
        cause,
      });
    case "BrowserStorageError":
      return new BrowserStorageError({
        code: readSerializedBridgeString(
          serialized,
          "code",
          "BROWSER_STORAGE_UNAVAILABLE",
        ) as BrowserStorageErrorCode,
        description: readSerializedBridgeString(
          serialized,
          "description",
          "Unknown browser storage error.",
        ),
        cause,
      });
    case "ReviewBridgeError":
      return new ReviewBridgeError({
        code: readSerializedBridgeString(
          serialized,
          "code",
          "REVIEW_REQUEST_FAILED",
        ) as ReviewBridgeErrorCode,
        description: readSerializedBridgeString(
          serialized,
          "description",
          "Unknown review bridge error.",
        ),
        cause,
      });
    case "JsonParseError":
      return new JsonParseError({
        source: readSerializedBridgeString(serialized, "source", "json"),
        cause,
      });
    case "StudioContextUnavailableError":
      return new StudioContextUnavailableError({});
    case "CaptureWindowPickerUnsupportedError":
      return new CaptureWindowPickerUnsupportedError({ cause });
    default: {
      const error = new Error(serialized.message ?? "Unknown bridge error.");
      const name = readSerializedBridgeField(serialized, "name");
      const stack = readSerializedBridgeField(serialized, "stack");
      if (typeof name === "string" && name.length > 0) {
        error.name = name;
      }
      if (typeof stack === "string" && stack.length > 0) {
        error.stack = stack;
      }
      if (cause !== undefined) {
        (error as Error & { cause?: unknown }).cause = cause;
      }
      return error;
    }
  }
}
