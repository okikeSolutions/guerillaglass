import { Schema } from "effect";
import { formatValidationIssue, type ValidationIssue } from "./validation";

const validationIssueSchema = Schema.Struct({
  path: Schema.Array(Schema.Union([Schema.String, Schema.Number])),
  message: Schema.String,
});

/** Schema for stable engine client infrastructure error codes. */
export const engineClientErrorCodeSchema = Schema.Literals([
  "ENGINE_CLIENT_STOPPED",
  "ENGINE_PROCESS_UNAVAILABLE",
  "ENGINE_REQUEST_TIMEOUT",
  "ENGINE_STDIO_WRITE_FAILED",
  "ENGINE_PROCESS_EXITED",
  "ENGINE_PROCESS_FAILED",
  "ENGINE_RESTART_CIRCUIT_OPEN",
  "ENGINE_PATH_UNAVAILABLE",
  "ENGINE_TRUST_REJECTED",
  "ENGINE_SPAWN_FAILED",
  "ENGINE_READINESS_TIMEOUT",
  "ENGINE_READINESS_INVALID",
  "ENGINE_EXITED_BEFORE_READINESS",
  "ENGINE_HTTP_REQUEST_FAILED",
]);

/** Stable engine client error codes. */
export type EngineClientErrorCode = Schema.Schema.Type<typeof engineClientErrorCodeSchema>;

/**
 * Error raised by the v2 engine client shell before concrete HTTP transport wiring exists.
 */
export class EngineClientNotImplementedError extends Schema.TaggedErrorClass<EngineClientNotImplementedError>()(
  "EngineClientNotImplementedError",
  {
    /**
     * Name of the client method that was invoked.
     */
    method: Schema.String,
  },
) {}

/**
 * Error raised when the v2 engine client cannot construct or execute an HTTP request.
 */
export class EngineClientTransportError extends Schema.TaggedErrorClass<EngineClientTransportError>()(
  "EngineClientTransportError",
  {
    /**
     * Human-readable transport failure description.
     */
    message: Schema.String,
    /**
     * Unknown underlying failure value, if one exists.
     */
    cause: Schema.optionalKey(Schema.Defect()),
  },
) {}

/**
 * Error raised while resolving, verifying, spawning, or waiting for a native engine process.
 */
export class EngineProcessError extends Schema.TaggedErrorClass<EngineProcessError>()(
  "EngineProcessError",
  {
    /**
     * Stable machine-readable process lifecycle error code.
     */
    code: Schema.Literals([
      "ENGINE_PATH_UNAVAILABLE",
      "ENGINE_TRUST_REJECTED",
      "ENGINE_SPAWN_FAILED",
      "ENGINE_READINESS_TIMEOUT",
      "ENGINE_READINESS_INVALID",
      "ENGINE_EXITED_BEFORE_READINESS",
    ]),
    /**
     * Human-readable process lifecycle failure description.
     */
    message: Schema.String,
    /**
     * Unknown underlying failure value, if one exists.
     */
    cause: Schema.optionalKey(Schema.Defect()),
  },
) {}

/** Engine process/client infrastructure failure. */
export class EngineClientError extends Schema.TaggedErrorClass<EngineClientError>()(
  "EngineClientError",
  {
    code: engineClientErrorCodeSchema,
    description: Schema.String,
    cause: Schema.optionalKey(Schema.Defect()),
  },
) {
  get message(): string {
    return this.description;
  }
}

/** Engine request validation failure. */
export class EngineRequestValidationError extends Schema.TaggedErrorClass<EngineRequestValidationError>()(
  "EngineRequestValidationError",
  {
    method: Schema.String,
    issues: Schema.Array(validationIssueSchema),
    hint: Schema.String,
    cause: Schema.optionalKey(Schema.Defect()),
  },
) {
  get message(): string {
    const details = (this.issues as ReadonlyArray<ValidationIssue>)
      .slice(0, 3)
      .map((issue) => formatValidationIssue(issue))
      .join("; ");
    return `invalid_params: ${this.method} request validation failed (${details}). ${this.hint}`;
  }
}

/** Engine operation failure after normalization at the service boundary. */
export class EngineOperationError extends Schema.TaggedErrorClass<EngineOperationError>()(
  "EngineOperationError",
  {
    operation: Schema.String,
    description: Schema.String,
  },
) {
  get message(): string {
    return this.description;
  }
}

/** Contract decode failure for desktop/client JSON boundaries. */
export class ContractDecodeError extends Schema.TaggedErrorClass<ContractDecodeError>()(
  "ContractDecodeError",
  {
    contract: Schema.String,
    issues: Schema.Array(validationIssueSchema),
    cause: Schema.Defect(),
  },
) {
  get message(): string {
    if (this.issues.length === 0) {
      return `Invalid ${this.contract} payload.`;
    }
    const details = (this.issues as ReadonlyArray<ValidationIssue>)
      .slice(0, 3)
      .map((issue) => formatValidationIssue(issue, this.contract))
      .join("; ");
    return `Invalid ${this.contract} payload (${details}).`;
  }
}

/** Engine-originated operation error response. */
export class EngineResponseError extends Schema.TaggedErrorClass<EngineResponseError>()(
  "EngineResponseError",
  {
    code: Schema.String,
    description: Schema.String,
  },
) {
  get message(): string {
    return `${this.code}: ${this.description}`;
  }
}

/** JSON parsing failure with source context. */
export class JsonParseError extends Schema.TaggedErrorClass<JsonParseError>()("JsonParseError", {
  source: Schema.String,
  cause: Schema.optionalKey(Schema.Defect()),
}) {
  get message(): string {
    return `Invalid ${this.source} JSON.`;
  }
}

/** Converts an unknown thrown value into a stable user-facing message. */
export function messageFromUnknownError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }
  return fallback;
}
