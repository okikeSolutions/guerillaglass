import { Schema } from "effect";
import { HttpApiMiddleware, HttpApiSchema, HttpApiSecurity, OpenApi } from "effect/unstable/httpapi";
import { NonEmptyString } from "./shared/helpers";

/**
 * Stable machine-readable error codes returned by native engine endpoints.
 */
export const engineErrorCodeSchema = Schema.Literals([
  "invalid_request",
  "invalid_params",
  "unsupported_method",
  "permission_denied",
  "needs_confirmation",
  "qa_failed",
  "missing_local_model",
  "invalid_cut_plan",
  "not_found",
  "runtime_error",
]);

const makeEngineError = <const Name extends string>(name: Name, status: number, codes: readonly [string, ...string[]]) =>
  Schema.Struct({
    code: Schema.Literals(codes),
    message: NonEmptyString,
  })
    .pipe(HttpApiSchema.status(status))
    .annotate({ identifier: name, description: `${name} response body.` });

/**
 * HTTP 400 error body for malformed or unsupported client requests.
 */
export const EngineBadRequestError = makeEngineError("EngineBadRequestError", 400, [
  "invalid_request",
  "invalid_params",
  "unsupported_method",
]);

/**
 * HTTP 401 error body for missing or invalid bearer tokens.
 */
export const EngineUnauthorizedError = makeEngineError("EngineUnauthorizedError", 401, [
  "permission_denied",
]);

/**
 * HTTP 403 error body for authenticated but disallowed operations.
 */
export const EngineForbiddenError = makeEngineError("EngineForbiddenError", 403, [
  "permission_denied",
]);

/**
 * HTTP 404 error body for missing resources such as jobs or projects.
 */
export const EngineNotFoundError = makeEngineError("EngineNotFoundError", 404, ["not_found"]);

/**
 * HTTP 409 error body for operations that require confirmation or conflict with current state.
 */
export const EngineConflictError = makeEngineError("EngineConflictError", 409, [
  "needs_confirmation",
]);

/**
 * HTTP 422 error body for semantically invalid requests, such as failed QA or cut plans.
 */
export const EngineUnprocessableError = makeEngineError("EngineUnprocessableError", 422, [
  "qa_failed",
  "missing_local_model",
  "invalid_cut_plan",
]);

/**
 * HTTP 500 error body for unexpected native engine failures.
 */
export const EngineRuntimeError = makeEngineError("EngineRuntimeError", 500, ["runtime_error"]);

/**
 * Error set shared by read-only and polling endpoints.
 */
export const EngineCommonErrors = [
  EngineBadRequestError,
  EngineUnauthorizedError,
  EngineForbiddenError,
  EngineRuntimeError,
] as const;

/**
 * Error set shared by command-style endpoints that mutate engine state.
 */
export const EngineMutationErrors = [
  EngineBadRequestError,
  EngineUnauthorizedError,
  EngineForbiddenError,
  EngineConflictError,
  EngineUnprocessableError,
  EngineRuntimeError,
] as const;

/**
 * Bearer-token security scheme used by all local engine endpoints.
 */
export const EngineBearerSecurity = HttpApiSecurity.bearer.pipe(
  HttpApiSecurity.annotate(OpenApi.Description, "Per-process bearer token for the local native engine."),
);

/**
 * HttpApi middleware requiring the per-process local engine bearer token.
 */
export class EngineAuthMiddleware extends HttpApiMiddleware.Service<EngineAuthMiddleware>()(
  "@guerillaglass/engine-contract/EngineAuthMiddleware",
  {
    security: {
      EngineBearer: EngineBearerSecurity,
    },
    error: EngineUnauthorizedError,
  },
) {}

/**
 * Runtime TypeScript union of stable engine error codes.
 */
export type EngineErrorCode = Schema.Schema.Type<typeof engineErrorCodeSchema>;
