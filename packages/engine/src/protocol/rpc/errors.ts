import { Schema } from "effect";
import { NonEmptyString } from "@guerillaglass/engine/protocol/shared/helpers";

/** Error code values returned on failed engine responses. */
export const engineErrorCodeSchema = Schema.Literals([
  "invalid_request",
  "invalid_params",
  "unsupported_method",
  "permission_denied",
  "needs_confirmation",
  "qa_failed",
  "missing_local_model",
  "invalid_cut_plan",
  "runtime_error",
]);

/** Error object shape returned by failed engine responses. */
export const engineErrorSchema = Schema.Struct({
  code: engineErrorCodeSchema,
  message: NonEmptyString,
});

/** Stable engine RPC failure emitted by native engine handlers. */
export class EngineRpcError extends Schema.TaggedErrorClass<EngineRpcError>()("EngineRpcError", {
  code: engineErrorCodeSchema,
  message: NonEmptyString,
}) {}

/** Effect RPC typed failure schema emitted by native engine handlers. */
export const engineRpcErrorSchema = EngineRpcError;

/** Type alias for EngineErrorCode. */
export type EngineErrorCode = Schema.Schema.Type<typeof engineErrorCodeSchema>;
