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

/** Normalizes raw locale input into a supported studio locale. */
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

/** Returns studio messages for a supported or normalized locale. */
export function getStudioMessages(locale: string | null | undefined): StudioMessages {
  return studioMessagesByLocale[normalizeStudioLocale(locale)];
}

export { deDE, enUS };
export type { StudioMessages };
