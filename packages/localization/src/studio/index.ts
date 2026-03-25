/**
 * Creator Studio locale registry and lookup helpers.
 *
 * This module owns the set of supported locale tags, the default fallback locale,
 * and dictionary lookup behavior used by the desktop renderer and native menu shell.
 */
import { deDE } from "./de";
import { enUS, type StudioMessages } from "./en";

/** Supported studio locale tags. */
export const studioLocales = ["en-US", "de-DE"] as const;
/** Union of supported studio locale tags. */
export type StudioLocale = (typeof studioLocales)[number];

/** Default locale used when input locale cannot be matched. */
export const defaultStudioLocale: StudioLocale = "en-US";

const studioMessagesByLocale: Record<StudioLocale, StudioMessages> = {
  "en-US": enUS,
  "de-DE": deDE,
};

/**
 * Normalizes raw locale input into a supported studio locale tag.
 *
 * Prefer this helper whenever locale values can come from the OS, browser APIs, or persisted
 * user settings because those sources frequently use partial or differently-cased tags.
 */
export function normalizeStudioLocale(locale: string | null | undefined): StudioLocale {
  const normalized = locale?.trim().toLowerCase();

  if (normalized === "de" || normalized === "de-de") {
    return "de-DE";
  }

  if (normalized === "en" || normalized === "en-us") {
    return "en-US";
  }

  return defaultStudioLocale;
}

/**
 * Returns the fully typed Creator Studio message bundle for the requested locale.
 *
 * The returned object is always complete because unsupported locale strings fall back to the
 * workspace default before dictionary lookup.
 */
export function getStudioMessages(locale: string | null | undefined): StudioMessages {
  return studioMessagesByLocale[normalizeStudioLocale(locale)];
}

export { deDE, enUS };
export type { StudioMessages };
