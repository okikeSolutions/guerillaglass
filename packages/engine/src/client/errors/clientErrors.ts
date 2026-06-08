import { Schema } from "effect";
import { formatValidationIssue, type ValidationIssue } from "./validation.js";

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
]);

/** Stable engine client error codes. */
export type EngineClientErrorCode = Schema.Schema.Type<typeof engineClientErrorCodeSchema>;

/** Contract decode failure for protocol boundary payloads. */
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

/** Engine request validation failure mapped to JSON-RPC invalid_params. */
export class EngineRequestValidationError extends Schema.TaggedErrorClass<EngineRequestValidationError>()(
  "EngineRequestValidationError",
  {
    method: Schema.String,
    issues: Schema.Array(validationIssueSchema),
    hint: Schema.String,
    cause: Schema.optional(Schema.Defect()),
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

/** Engine-originated JSON-RPC error response. */
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

/** Engine process/client infrastructure failure. */
export class EngineClientError extends Schema.TaggedErrorClass<EngineClientError>()(
  "EngineClientError",
  {
    code: engineClientErrorCodeSchema,
    description: Schema.String,
    cause: Schema.optional(Schema.Defect()),
  },
) {
  get message(): string {
    return this.description;
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

/** JSON parsing failure with source context. */
export class JsonParseError extends Schema.TaggedErrorClass<JsonParseError>()("JsonParseError", {
  source: Schema.String,
  cause: Schema.optional(Schema.Defect()),
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
