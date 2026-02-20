export type StudioShortcutId =
  | "playPause"
  | "record"
  | "trimIn"
  | "trimOut"
  | "save"
  | "saveAs"
  | "export"
  | "timelineBlade";

type StudioShortcutDefinition = {
  hotkey: StudioHotkey;
  displayTokens: readonly ShortcutToken[];
  menuAccelerator?: string;
};

type ShortcutToken = "MOD" | "SHIFT" | "SPACE" | "R" | "I" | "O" | "B" | "S" | "E";

type StudioHotkey = "Space" | "R" | "I" | "O" | "B" | "Mod+S" | "Mod+Shift+S" | "Mod+E";

export const studioShortcuts: Record<StudioShortcutId, StudioShortcutDefinition> = {
  playPause: {
    hotkey: "Space",
    displayTokens: ["SPACE"],
    menuAccelerator: "space",
  },
  record: {
    hotkey: "R",
    displayTokens: ["R"],
    menuAccelerator: "r",
  },
  trimIn: {
    hotkey: "I",
    displayTokens: ["I"],
    menuAccelerator: "i",
  },
  trimOut: {
    hotkey: "O",
    displayTokens: ["O"],
    menuAccelerator: "o",
  },
  save: {
    hotkey: "Mod+S",
    displayTokens: ["MOD", "S"],
    menuAccelerator: "s",
  },
  saveAs: {
    hotkey: "Mod+Shift+S",
    displayTokens: ["MOD", "SHIFT", "S"],
    menuAccelerator: "shift+s",
  },
  export: {
    hotkey: "Mod+E",
    displayTokens: ["MOD", "E"],
    menuAccelerator: "e",
  },
  timelineBlade: {
    hotkey: "B",
    displayTokens: ["B"],
  },
};

export type ShortcutDisplayPlatform = "mac" | "windows" | "linux";

type StudioShortcutDisplayOptions = {
  platform?: ShortcutDisplayPlatform;
  spaceKeyLabel?: string;
};

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

function mapTokenForDisplay(token: ShortcutToken, options?: StudioShortcutDisplayOptions): string {
  switch (token) {
    case "MOD":
      return options?.platform === "mac" ? "\u2318" : "Ctrl";
    case "SHIFT":
      return options?.platform === "mac" ? "\u21E7" : "Shift";
    case "SPACE":
      return options?.spaceKeyLabel ?? "Space";
    default:
      return token;
  }
}

export function studioShortcutDisplayTokens(
  shortcutId: StudioShortcutId,
  options?: StudioShortcutDisplayOptions,
): string[] {
  return studioShortcuts[shortcutId].displayTokens.map((token) =>
    mapTokenForDisplay(token, options),
  );
}

export function studioShortcutDisplayText(
  shortcutId: StudioShortcutId,
  options?: StudioShortcutDisplayOptions,
): string {
  return studioShortcutDisplayTokens(shortcutId, options).join("+");
}

export function withShortcutLabel(
  label: string,
  shortcutId: StudioShortcutId,
  options?: StudioShortcutDisplayOptions,
): string {
  return `${label} (${studioShortcutDisplayText(shortcutId, options)})`;
}
