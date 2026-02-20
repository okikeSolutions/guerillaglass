import { describe, expect, test } from "bun:test";
import {
  studioShortcutDisplayTokens,
  studioShortcutDisplayText,
  studioShortcuts,
  withShortcutLabel,
} from "../src/shared/shortcuts";

describe("studio shortcuts", () => {
  test("defines display text for all menu-exposed shortcuts", () => {
    expect(studioShortcutDisplayText("playPause")).toBe("Space");
    expect(studioShortcutDisplayText("save")).toBe("Ctrl+S");
    expect(studioShortcutDisplayText("saveAs")).toBe("Ctrl+Shift+S");
    expect(studioShortcutDisplayText("export")).toBe("Ctrl+E");
  });

  test("resolves platform-aware shortcut tokens", () => {
    expect(studioShortcutDisplayTokens("save", { platform: "mac" })).toEqual(["⌘", "S"]);
    expect(studioShortcutDisplayTokens("saveAs", { platform: "windows" })).toEqual([
      "Ctrl",
      "Shift",
      "S",
    ]);
    expect(
      studioShortcutDisplayTokens("playPause", {
        platform: "linux",
        spaceKeyLabel: "Leertaste",
      }),
    ).toEqual(["Leertaste"]);
  });

  test("formats labels with shortcut hints", () => {
    expect(withShortcutLabel("Play/Pause", "playPause")).toBe("Play/Pause (Space)");
    expect(withShortcutLabel("Blade", "timelineBlade")).toBe("Blade (B)");
  });

  test("keeps menu accelerators and hotkeys aligned for core actions", () => {
    expect(studioShortcuts.record.menuAccelerator).toBe("r");
    expect(studioShortcuts.record.hotkey).toBe("R");
    expect(studioShortcuts.trimIn.menuAccelerator).toBe("i");
    expect(studioShortcuts.trimOut.menuAccelerator).toBe("o");
  });
});
