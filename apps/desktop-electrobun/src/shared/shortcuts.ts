import { Schema } from "effect";
import { normalizeHotkey, parseHotkey, validateHotkey } from "@tanstack/react-hotkeys";

type ShortcutModifier = "Control" | "Alt" | "Shift" | "Meta";

type ParsedShortcutToken = {
  key: string;
  modifiers: ShortcutModifier[];
};

type StudioShortcutDefinition = {
  hotkeys: Record<ShortcutDisplayPlatform, StudioHotkey>;
};

type StudioShortcutValidationResult =
  | {
      ok: true;
      hotkey: StudioHotkey;
    }
  | {
      ok: false;
      reason: "invalid" | "conflict";
      message: string;
      conflictingShortcutId?: StudioShortcutId;
    };

export const studioShortcutIds = [
  "playPause",
  "record",
  "trimIn",
  "trimOut",
  "save",
  "saveAs",
  "export",
  "timelineBlade",
] as const;

/** Canonical shortcut identifier contract shared across the desktop shell. */
export const studioShortcutIdSchema = Schema.Literal(...studioShortcutIds);
export type StudioShortcutId = (typeof studioShortcutIds)[number];

/** Supported keyboard layout platform used to render and resolve shortcut labels. */
export const shortcutDisplayPlatformSchema = Schema.Literal("mac", "windows", "linux");
export type ShortcutDisplayPlatform = "mac" | "windows" | "linux";

/** Canonical hotkey contract used for shortcut storage, display, and conflict checks. */
export const studioHotkeySchema = Schema.String;
export type StudioHotkey = string;

/**
 * Persisted shortcut override contract keyed by the known studio shortcut identifiers.
 *
 * The storage model is intentionally narrow so the renderer only accepts overrides for
 * shortcuts the shell knows how to resolve.
 */
export const studioShortcutOverridesSchema = Schema.Struct({
  playPause: Schema.optional(studioHotkeySchema),
  record: Schema.optional(studioHotkeySchema),
  trimIn: Schema.optional(studioHotkeySchema),
  trimOut: Schema.optional(studioHotkeySchema),
  save: Schema.optional(studioHotkeySchema),
  saveAs: Schema.optional(studioHotkeySchema),
  export: Schema.optional(studioHotkeySchema),
  timelineBlade: Schema.optional(studioHotkeySchema),
});
export type StudioShortcutOverrides = Partial<Record<StudioShortcutId, StudioHotkey>>;

const studioShortcutDefinitions: Record<StudioShortcutId, StudioShortcutDefinition> = {
  playPause: {
    hotkeys: {
      mac: "Space",
      windows: "Space",
      linux: "Space",
    },
  },
  record: {
    hotkeys: {
      mac: "R",
      windows: "R",
      linux: "R",
    },
  },
  trimIn: {
    hotkeys: {
      mac: "I",
      windows: "I",
      linux: "I",
    },
  },
  trimOut: {
    hotkeys: {
      mac: "O",
      windows: "O",
      linux: "O",
    },
  },
  save: {
    hotkeys: {
      mac: "Meta+S",
      windows: "Control+S",
      linux: "Control+S",
    },
  },
  saveAs: {
    hotkeys: {
      mac: "Meta+Shift+S",
      windows: "Control+Shift+S",
      linux: "Control+Shift+S",
    },
  },
  export: {
    hotkeys: {
      mac: "Meta+E",
      windows: "Control+E",
      linux: "Control+E",
    },
  },
  timelineBlade: {
    hotkeys: {
      mac: "B",
      windows: "B",
      linux: "B",
    },
  },
};

const supportedNamedShortcutKeys = new Set([
  "Space",
  "Enter",
  "Escape",
  "Tab",
  "Backspace",
  "Delete",
  "Home",
  "End",
  "PageUp",
  "PageDown",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);

function canonicalizeStudioHotkey(hotkey: string): StudioHotkey {
  return normalizeHotkey(hotkey.trim());
}

function parseStudioHotkey(hotkey: string): ParsedShortcutToken {
  const parsed = parseHotkey(canonicalizeStudioHotkey(hotkey));
  const modifiers: ShortcutModifier[] = [];
  if (parsed.meta) {
    modifiers.push("Meta");
  }
  if (parsed.ctrl) {
    modifiers.push("Control");
  }
  if (parsed.alt) {
    modifiers.push("Alt");
  }
  if (parsed.shift) {
    modifiers.push("Shift");
  }
  return {
    key: parsed.key,
    modifiers,
  };
}

function displayTokenForModifier(
  modifier: ShortcutModifier,
  platform: ShortcutDisplayPlatform,
): string {
  if (platform === "mac") {
    switch (modifier) {
      case "Control":
        return "\u2303";
      case "Alt":
        return "\u2325";
      case "Shift":
        return "\u21E7";
      case "Meta":
        return "\u2318";
    }
  }

  switch (modifier) {
    case "Control":
      return "Ctrl";
    case "Alt":
      return "Alt";
    case "Shift":
      return "Shift";
    case "Meta":
      return platform === "windows" ? "Win" : "Super";
  }
}

function displayTokenForKey(key: string, spaceKeyLabel?: string): string {
  if (key === "Space") {
    return spaceKeyLabel ?? "Space";
  }
  if (key.startsWith("Arrow")) {
    return key.replace("Arrow", "");
  }
  if (key === "Escape") {
    return "Esc";
  }
  if (key.length === 1) {
    return key.toUpperCase();
  }
  return key;
}

function defaultShortcutHotkey(
  shortcutId: StudioShortcutId,
  platform: ShortcutDisplayPlatform,
): StudioHotkey {
  return studioShortcutDefinitions[shortcutId].hotkeys[platform];
}

function isSupportedShortcutKey(key: string): boolean {
  if (key.length === 1) {
    return /^[A-Z0-9]$/u.test(key);
  }
  if (/^F(?:[1-9]|1[0-2])$/u.test(key)) {
    return true;
  }
  return supportedNamedShortcutKeys.has(key);
}

function normalizeShortcutOverrideEntry(hotkey: string | undefined): StudioHotkey | null {
  if (!hotkey) {
    return null;
  }

  try {
    const normalizedHotkey = canonicalizeStudioHotkey(hotkey);
    const validation = validateHotkey(normalizedHotkey);
    if (!validation.valid) {
      return null;
    }
    const parsed = parseStudioHotkey(normalizedHotkey);
    if (
      !parsed.key ||
      (parsed.key.includes(" ") && parsed.key !== "Space") ||
      !isSupportedShortcutKey(parsed.key)
    ) {
      return null;
    }
    return normalizedHotkey;
  } catch {
    return null;
  }
}

function sanitizeShortcutOverrideEntry(
  shortcutId: StudioShortcutId,
  hotkey: string | undefined,
  platform: ShortcutDisplayPlatform,
): StudioHotkey | null {
  const normalizedHotkey = normalizeShortcutOverrideEntry(hotkey);
  if (!normalizedHotkey || normalizedHotkey === defaultShortcutHotkey(shortcutId, platform)) {
    return null;
  }
  return normalizedHotkey;
}

export function normalizeShortcutDisplayPlatform(
  platform: string | undefined,
): ShortcutDisplayPlatform {
  const normalized = platform?.toLowerCase() ?? "";
  if (normalized.includes("darwin") || normalized.includes("mac")) {
    return "mac";
  }
  if (normalized.includes("win")) {
    return "windows";
  }
  return "linux";
}

export function detectStudioShortcutPlatform(): ShortcutDisplayPlatform {
  if (typeof navigator !== "undefined") {
    return normalizeShortcutDisplayPlatform(
      (navigator as { userAgentData?: { platform?: string } }).userAgentData?.platform ??
        navigator.platform ??
        navigator.userAgent,
    );
  }
  if (typeof process !== "undefined") {
    return normalizeShortcutDisplayPlatform(process.platform);
  }
  return "linux";
}

export function resolveStudioShortcutHotkey(
  shortcutId: StudioShortcutId,
  options?: {
    platform?: ShortcutDisplayPlatform;
    overrides?: StudioShortcutOverrides;
  },
): StudioHotkey {
  const platform = options?.platform ?? "linux";
  const override = sanitizeShortcutOverrideEntry(
    shortcutId,
    options?.overrides?.[shortcutId],
    platform,
  );
  return override ?? defaultShortcutHotkey(shortcutId, platform);
}

export function isStudioShortcutSingleKey(
  shortcutId: StudioShortcutId,
  options?: {
    platform?: ShortcutDisplayPlatform;
    overrides?: StudioShortcutOverrides;
  },
): boolean {
  return isStudioHotkeySingleKey(resolveStudioShortcutHotkey(shortcutId, options));
}

export function isStudioHotkeySingleKey(hotkey: string): boolean {
  return parseStudioHotkey(hotkey).modifiers.length === 0;
}

export function studioHotkeyDisplayTokens(
  hotkey: string,
  options?: {
    platform?: ShortcutDisplayPlatform;
    spaceKeyLabel?: string;
  },
): string[] {
  const platform = options?.platform ?? "linux";
  const parsed = parseStudioHotkey(hotkey);
  return [
    ...parsed.modifiers.map((modifier) => displayTokenForModifier(modifier, platform)),
    displayTokenForKey(parsed.key, options?.spaceKeyLabel),
  ];
}

export function studioShortcutDisplayTokens(
  shortcutId: StudioShortcutId,
  options?: {
    platform?: ShortcutDisplayPlatform;
    overrides?: StudioShortcutOverrides;
    spaceKeyLabel?: string;
  },
): string[] {
  return studioHotkeyDisplayTokens(resolveStudioShortcutHotkey(shortcutId, options), options);
}

export function studioShortcutDisplayText(
  shortcutId: StudioShortcutId,
  options?: {
    platform?: ShortcutDisplayPlatform;
    overrides?: StudioShortcutOverrides;
    spaceKeyLabel?: string;
  },
): string {
  return studioShortcutDisplayTokens(shortcutId, options).join("+");
}

export function withShortcutLabel(
  label: string,
  shortcutId: StudioShortcutId,
  options?: {
    platform?: ShortcutDisplayPlatform;
    overrides?: StudioShortcutOverrides;
    spaceKeyLabel?: string;
  },
): string {
  return `${label} (${studioShortcutDisplayText(shortcutId, options)})`;
}

export function studioShortcutMenuAccelerator(
  shortcutId: StudioShortcutId,
  options?: {
    platform?: ShortcutDisplayPlatform;
    overrides?: StudioShortcutOverrides;
  },
): string {
  return studioHotkeyMenuAccelerator(resolveStudioShortcutHotkey(shortcutId, options));
}

export function studioHotkeyMenuAccelerator(hotkey: string): string {
  const parsed = parseStudioHotkey(hotkey);
  const parts = parsed.modifiers.map((modifier) => {
    switch (modifier) {
      case "Meta":
        return "Command";
      case "Control":
        return "Control";
      case "Alt":
        return "Alt";
      case "Shift":
        return "Shift";
    }
  });

  const key =
    parsed.key === "Space"
      ? "Space"
      : parsed.key.length === 1
        ? parsed.key.toUpperCase()
        : parsed.key;
  return [...parts, key].join("+");
}

export function sanitizeStudioShortcutOverrides(
  overrides: StudioShortcutOverrides | undefined,
  platform: ShortcutDisplayPlatform,
): StudioShortcutOverrides {
  if (!overrides) {
    return {};
  }

  const nextOverrides: StudioShortcutOverrides = {};
  for (const shortcutId of studioShortcutIds) {
    const normalizedHotkey = sanitizeShortcutOverrideEntry(
      shortcutId,
      overrides[shortcutId],
      platform,
    );
    if (!normalizedHotkey) {
      continue;
    }

    const validation = validateStudioShortcutOverride({
      shortcutId,
      hotkey: normalizedHotkey,
      platform,
      overrides: nextOverrides,
    });
    if (validation.ok) {
      nextOverrides[shortcutId] = validation.hotkey;
    }
  }
  return nextOverrides;
}

export function studioShortcutOverridesEqual(
  left: StudioShortcutOverrides | undefined,
  right: StudioShortcutOverrides | undefined,
): boolean {
  for (const shortcutId of studioShortcutIds) {
    if ((left?.[shortcutId] ?? null) !== (right?.[shortcutId] ?? null)) {
      return false;
    }
  }
  return true;
}

export function validateStudioShortcutOverride(params: {
  shortcutId: StudioShortcutId;
  hotkey: string;
  platform: ShortcutDisplayPlatform;
  overrides: StudioShortcutOverrides;
}): StudioShortcutValidationResult {
  const normalizedHotkey = normalizeShortcutOverrideEntry(params.hotkey);
  if (!normalizedHotkey) {
    return {
      ok: false,
      reason: "invalid",
      message: "Shortcut is invalid.",
    };
  }

  const nextOverrides = {
    ...params.overrides,
    [params.shortcutId]: normalizedHotkey,
  } satisfies StudioShortcutOverrides;

  for (const shortcutId of studioShortcutIds) {
    if (shortcutId === params.shortcutId) {
      continue;
    }
    if (
      resolveStudioShortcutHotkey(shortcutId, {
        platform: params.platform,
        overrides: nextOverrides,
      }) === normalizedHotkey
    ) {
      return {
        ok: false,
        reason: "conflict",
        message: "Shortcut is already assigned.",
        conflictingShortcutId: shortcutId,
      };
    }
  }

  return {
    ok: true,
    hotkey: normalizedHotkey,
  };
}
