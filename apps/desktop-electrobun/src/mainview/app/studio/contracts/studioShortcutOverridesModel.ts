import {
  sanitizeStudioShortcutOverrides,
  studioShortcutOverridesSchema,
  type ShortcutDisplayPlatform,
  type StudioShortcutOverrides,
} from "@shared/shortcuts";
import {
  ContractDecodeError,
  JsonParseError,
  decodeJsonStringWithSchemaSync,
} from "@shared/errors";
import {
  createDesktopPreferenceStorageKey,
  loadDesktopPreference,
  saveDesktopPreference,
  type DesktopPreferenceDefinition,
} from "../services/desktopPreferences";

export const studioShortcutOverridesStorageKey = createDesktopPreferenceStorageKey(
  "studio.shortcuts",
  1,
);

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

function studioShortcutOverridesPreference(
  platform: ShortcutDisplayPlatform,
): DesktopPreferenceDefinition<StudioShortcutOverrides> {
  return {
    key: studioShortcutOverridesStorageKey,
    fallback: {},
    parse: (raw) => parseStudioShortcutOverrides(raw, platform),
    serialize: (overrides) => JSON.stringify(sanitizeStudioShortcutOverrides(overrides, platform)),
    writeDescription: "Failed to persist studio shortcut overrides.",
  };
}

export function loadStudioShortcutOverrides(
  platform: ShortcutDisplayPlatform,
): StudioShortcutOverrides {
  return loadDesktopPreference(studioShortcutOverridesPreference(platform));
}

export function saveStudioShortcutOverrides(
  overrides: StudioShortcutOverrides,
  platform: ShortcutDisplayPlatform,
): void {
  saveDesktopPreference(studioShortcutOverridesPreference(platform), overrides);
}
