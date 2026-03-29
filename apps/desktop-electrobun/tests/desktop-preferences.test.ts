import { afterEach, describe, expect, test } from "bun:test";
import {
  createDesktopPreferenceStorageKey,
  loadDesktopPreference,
  saveDesktopPreference,
  type DesktopPreferenceDefinition,
} from "@studio/services/desktopPreferences";

const originalWindow = (globalThis as { window?: unknown }).window;

afterEach(() => {
  if (originalWindow === undefined) {
    delete (globalThis as { window?: unknown }).window;
    return;
  }
  (globalThis as { window?: unknown }).window = originalWindow;
});

describe("desktop preferences", () => {
  test("builds versioned preference keys", () => {
    expect(createDesktopPreferenceStorageKey("studio.layout", 1)).toBe("gg.studio.layout.v1");
  });

  test("loads fallback when localStorage is unavailable", () => {
    const definition: DesktopPreferenceDefinition<number> = {
      key: "gg.test.pref.v1",
      fallback: 42,
      parse: Number,
      serialize: String,
      writeDescription: "Failed to persist test preference.",
    };

    (globalThis as { window?: unknown }).window = {
      get localStorage(): never {
        throw new Error("storage unavailable");
      },
    };

    expect(loadDesktopPreference(definition)).toBe(42);
    expect(() => saveDesktopPreference(definition, 7)).not.toThrow();
  });

  test("reads and writes values through the shared storage service", () => {
    const storage = new Map<string, string>();
    const definition: DesktopPreferenceDefinition<number> = {
      key: "gg.test.pref.v1",
      fallback: 0,
      parse: Number,
      serialize: String,
      writeDescription: "Failed to persist test preference.",
    };

    (globalThis as { window?: unknown }).window = {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
      },
    };

    saveDesktopPreference(definition, 9);

    expect(storage.get(definition.key)).toBe("9");
    expect(loadDesktopPreference(definition)).toBe(9);
  });
});
