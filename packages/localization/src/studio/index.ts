import { deDE } from "./de";
import { enUS, type StudioMessages } from "./en";

export const studioLocales = ["en-US", "de-DE"] as const;
export type StudioLocale = (typeof studioLocales)[number];

export const defaultStudioLocale: StudioLocale = "en-US";

const studioMessagesByLocale: Record<StudioLocale, StudioMessages> = {
  "en-US": enUS,
  "de-DE": deDE,
};

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

export function getStudioMessages(locale: string | null | undefined): StudioMessages {
  return studioMessagesByLocale[normalizeStudioLocale(locale)];
}

export { deDE, enUS };
export type { StudioMessages };
