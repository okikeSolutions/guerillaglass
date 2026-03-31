import { Schema } from "effect";

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

/** Effect Schema primitive for canonical ISO 8601 datetime strings. */
export const isoDateTimeSchema = Schema.String.pipe(
  Schema.pattern(isoDateTimePattern),
  Schema.filter((value) => isValidIsoDateTime(value), {
    message: () => "Expected an ISO 8601 datetime string.",
  }),
);
