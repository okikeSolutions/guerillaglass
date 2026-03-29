import { BrowserStorageError } from "@shared/errors";

export type DesktopPreferenceDefinition<T> = {
  key: string;
  fallback: T;
  parse: (raw: string) => T;
  serialize: (value: T) => string;
  writeDescription: string;
};

export function createDesktopPreferenceStorageKey(name: string, version: number): string {
  return `gg.${name}.v${version}`;
}

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

export function loadDesktopPreference<T>(definition: DesktopPreferenceDefinition<T>): T {
  const storage = tryGetStorage();
  if (!storage) {
    return definition.fallback;
  }
  const raw = storage.getItem(definition.key);
  if (raw == null) {
    return definition.fallback;
  }
  return definition.parse(raw);
}

function persistDesktopPreference<T>(
  storage: Storage,
  definition: DesktopPreferenceDefinition<T>,
  value: T,
): void {
  try {
    storage.setItem(definition.key, definition.serialize(value));
  } catch (error) {
    throw new BrowserStorageError({
      code: "BROWSER_STORAGE_WRITE_FAILED",
      description: definition.writeDescription,
      cause: error,
    });
  }
}

export function saveDesktopPreference<T>(
  definition: DesktopPreferenceDefinition<T>,
  value: T,
): void {
  const storage = tryGetStorage();
  if (!storage) {
    return;
  }
  try {
    persistDesktopPreference(storage, definition, value);
  } catch (error) {
    if (!(error instanceof BrowserStorageError)) {
      throw error;
    }
  }
}
