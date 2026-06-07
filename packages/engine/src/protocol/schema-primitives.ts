import { DateTime, Option, Schema } from "effect";

function pattern(pattern: RegExp) {
  return <S extends Schema.Top & { readonly Type: string }>(schema: S): S["Rebuild"] =>
    schema.check(Schema.isPattern(pattern));
}

function refineString(predicate: (value: string) => boolean, message: string) {
  return <S extends Schema.Top & { readonly Type: string }>(schema: S): S["Rebuild"] =>
    schema.check(Schema.makeFilter((value: string) => (predicate(value) ? undefined : message)));
}

/** Shared ISO 8601 datetime validation for typed protocol surfaces. */
export const isoDateTimePattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function isValidIsoDateTime(value: string): boolean {
  return isoDateTimePattern.test(value) && Option.isSome(DateTime.make(value));
}

function brandedNonEmptyString<const B extends string>(brand: B) {
  return Schema.NonEmptyString.pipe(Schema.brand(brand));
}

/** Shared helper for nominally distinct non-empty string protocol values. */
export const nonEmptyStringBrand = brandedNonEmptyString;
/** Review identifier crossing the review bridge boundary. */
export const reviewIdSchema = brandedNonEmptyString("ReviewId");
/** Review comment identifier used in nested thread payloads. */
export const reviewCommentIdSchema = brandedNonEmptyString("ReviewCommentId");
/** Review user identifier carried in presence and comment payloads. */
export const reviewUserIdSchema = brandedNonEmptyString("ReviewUserId");
/** Review auth token required by Bun review bridge requests. */
export const reviewAuthTokenSchema = Schema.String.pipe(
  refineString((value) => value.trim().length > 0, "Expected a non-empty review auth token."),
  Schema.brand("ReviewAuthToken"),
);
/** JSON-RPC request id used by native engine envelopes. */
export const engineRpcIdSchema = brandedNonEmptyString("EngineRpcId");
/** Agent job identifier returned by Agent Mode responses. */
export const agentJobIdSchema = brandedNonEmptyString("AgentJobId");
/** Agent preflight token returned by successful preflight checks. */
export const agentPreflightTokenSchema = brandedNonEmptyString("AgentPreflightToken");
/** Timeline segment identifier persisted in project documents. */
export const timelineSegmentIdSchema = brandedNonEmptyString("TimelineSegmentId");
/** Capture session identifier returned while preview/capture is active. */
export const captureSessionIdSchema = brandedNonEmptyString("CaptureSessionId");
/** Export preset identifier accepted by export requests. */
export const exportPresetIdSchema = brandedNonEmptyString("ExportPresetId");
/** Absolute project path used by project open/save surfaces. */
export const projectPathSchema = brandedNonEmptyString("ProjectPath");
/** Generic absolute file path used by desktop bridge file APIs. */
export const filePathSchema = brandedNonEmptyString("FilePath");
/** Output URL/path returned or accepted by export/media bridge surfaces. */
export const outputUrlSchema = brandedNonEmptyString("OutputUrl");
/** Persisted artifact path emitted by Agent Mode artifacts. */
export const artifactPathSchema = brandedNonEmptyString("ArtifactPath");

/** Effect Schema primitive for canonical ISO 8601 datetime strings. */
export const isoDateTimeSchema = Schema.String.pipe(
  pattern(isoDateTimePattern),
  refineString(isValidIsoDateTime, "Expected an ISO 8601 datetime string."),
  Schema.brand("IsoDateTime"),
);
