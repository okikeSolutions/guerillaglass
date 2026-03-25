/** Shared localization entrypoint for desktop menu labels and Creator Studio dictionaries. */
/** Desktop menu and tray localization helpers. */
export { getDesktopMenuMessages, type DesktopMenuMessages } from "./menu";
/** Creator Studio locale dictionaries plus locale normalization helpers. */
export {
  defaultStudioLocale,
  deDE,
  enUS,
  getStudioMessages,
  normalizeStudioLocale,
  studioLocales,
  type StudioLocale,
  type StudioMessages,
} from "./studio";
