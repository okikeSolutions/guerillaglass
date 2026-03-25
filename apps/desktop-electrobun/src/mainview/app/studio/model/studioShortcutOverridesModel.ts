import {
  sanitizeStudioShortcutOverrides,
  studioShortcutOverridesSchema,
  type ShortcutDisplayPlatform,
  type StudioShortcutOverrides,
} from "../../../../shared/shortcuts";
import {
  BrowserStorageError,
  ContractDecodeError,
  JsonParseError,
  decodeJsonStringWithSchemaSync,
} from "../../../../shared/errors";

export const studioShortcutOverridesStorageKey = "gg.studio.shortcuts.v1";

function getStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage;
  } catch (error) {
    throw new BrowserStorageError({
      code: "BROWSER_STORAGE_UNAVAILABLE",
      description: "Browser localStorage is unavailable.",
      cause: error,
    });
  }
}

function tryGetStorage(): Storage | null {
  try {
    return getStorage();
  } catch {
    return null;
  }
}

export function parseStudioShortcutOverrides(
  raw: string | null | undefined,
  platform: ShortcutDisplayPlatform,
): StudioShortcutOverrides {
  if (!raw) {
    return {};
  }

  try {
    const parsedCandidate = decodeJsonStringWithSchemaSync(
      studioShortcutOverridesSchema,
      raw,
      "studio shortcut overrides",
    );
    return sanitizeStudioShortcutOverrides(parsedCandidate, platform);
  } catch (error) {
    if (error instanceof JsonParseError || error instanceof ContractDecodeError) {
      return {};
    }
    throw error;
  }
}

function persistStudioShortcutOverrides(
  storage: Storage,
  overrides: StudioShortcutOverrides,
  platform: ShortcutDisplayPlatform,
): void {
  try {
    storage.setItem(
      studioShortcutOverridesStorageKey,
      JSON.stringify(sanitizeStudioShortcutOverrides(overrides, platform)),
    );
  } catch (error) {
    throw new BrowserStorageError({
      code: "BROWSER_STORAGE_WRITE_FAILED",
      description: "Failed to persist studio shortcut overrides.",
      cause: error,
    });
  }
}

export function loadStudioShortcutOverrides(
  platform: ShortcutDisplayPlatform,
): StudioShortcutOverrides {
  const storage = tryGetStorage();
  if (!storage) {
    return {};
  }
  return parseStudioShortcutOverrides(storage.getItem(studioShortcutOverridesStorageKey), platform);
}

export function saveStudioShortcutOverrides(
  overrides: StudioShortcutOverrides,
  platform: ShortcutDisplayPlatform,
): void {
  const storage = tryGetStorage();
  if (!storage) {
    return;
  }
  try {
    persistStudioShortcutOverrides(storage, overrides, platform);
  } catch (error) {
    if (!(error instanceof BrowserStorageError)) {
      throw error;
    }
  }
}
