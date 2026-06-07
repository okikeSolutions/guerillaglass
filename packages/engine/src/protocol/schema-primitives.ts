import { Schema } from "effect";

function pattern(pattern: RegExp) {
  return Schema.check<Schema.Schema<string>>(Schema.isPattern(pattern));
}

function refineString(predicate: (value: string) => boolean, message: string) {
  return Schema.refine(
    (value: unknown): value is string => typeof value === "string" && predicate(value),
    {
      message,
    },
  );
}

/** Shared ISO 8601 datetime validation for typed protocol surfaces. */
export const isoDateTimePattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  switch (month) {
    case 2:
      return isLeapYear(year) ? 29 : 28;
    case 4:
    case 6:
    case 9:
    case 11:
      return 30;
    default:
      return 31;
  }
}

function isValidIsoDateTime(value: string): boolean {
  if (!isoDateTimePattern.test(value)) {
    return false;
  }

  const match =
    /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})T(?<hour>\d{2}):(?<minute>\d{2}):(?<second>\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.exec(
      value,
    );
  if (!match?.groups) {
    return false;
  }

  const year = match.groups.year ?? "";
  const month = match.groups.month ?? "";
  const day = match.groups.day ?? "";
  const hour = match.groups.hour ?? "";
  const minute = match.groups.minute ?? "";
  const second = match.groups.second ?? "";
  const parsedYear = Number.parseInt(year, 10);
  const parsedMonth = Number.parseInt(month, 10);
  const parsedDay = Number.parseInt(day, 10);
  const parsedHour = Number.parseInt(hour, 10);
  const parsedMinute = Number.parseInt(minute, 10);
  const parsedSecond = Number.parseInt(second, 10);

  if (parsedMonth < 1 || parsedMonth > 12) {
    return false;
  }
  if (parsedDay < 1 || parsedDay > daysInMonth(parsedYear, parsedMonth)) {
    return false;
  }
  if (parsedHour < 0 || parsedHour > 23) {
    return false;
  }
  if (parsedMinute < 0 || parsedMinute > 59) {
    return false;
  }
  if (parsedSecond < 0 || parsedSecond > 59) {
    return false;
  }
  return !Number.isNaN(Date.parse(value));
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
