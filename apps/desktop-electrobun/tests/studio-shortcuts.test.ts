import { describe, expect, test } from "bun:test";
import {
  resolveStudioShortcutBinding,
  resolveStudioShortcutHotkey,
  sanitizeStudioShortcutOverrides,
  studioHotkeyMenuAccelerator,
  studioShortcutDisplayText,
  studioShortcutDisplayTokens,
  validateStudioShortcutOverride,
} from "@shared/shortcuts";

describe("studio shortcuts", () => {
  test("resolves platform-aware defaults for menu-exposed shortcuts", () => {
    expect(studioShortcutDisplayText("playPause")).toBe("Space");
    expect(resolveStudioShortcutHotkey("save", { platform: "mac" })).toBe("Meta+S");
    expect(resolveStudioShortcutHotkey("save", { platform: "windows" })).toBe("Control+S");
    expect(resolveStudioShortcutHotkey("saveAs", { platform: "linux" })).toBe("Control+Shift+S");
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

  test("builds one resolved binding shape for display and menu consumers", () => {
    expect(
      resolveStudioShortcutBinding("saveAs", {
        platform: "windows",
        overrides: {
          saveAs: "Control+Shift+P",
        },
      }),
    ).toEqual({
      hotkey: "Control+Shift+P",
      key: "P",
      modifiers: ["Control", "Shift"],
      singleKey: false,
      displayTokens: ["Ctrl", "Shift", "P"],
      displayText: "Ctrl+Shift+P",
      menuAccelerator: "Control+Shift+P",
    });
  });

  test("sanitizes overrides and drops invalid or conflicting entries", () => {
    expect(
      sanitizeStudioShortcutOverrides(
        {
          save: "Control+Shift+P",
          export: "Control+Shift+P",
          record: "Bad Shortcut",
          trimIn: "I",
        },
        "windows",
      ),
    ).toEqual({
      save: "Control+Shift+P",
    });
  });

  test("validates shortcut overrides against active bindings", () => {
    expect(
      validateStudioShortcutOverride({
        shortcutId: "export",
        hotkey: "Control+Shift+P",
        platform: "windows",
        overrides: {
          save: "Control+Shift+P",
        },
      }),
    ).toEqual({
      ok: false,
      reason: "conflict",
      message: "Shortcut is already assigned.",
      conflictingShortcutId: "save",
    });

    expect(
      validateStudioShortcutOverride({
        shortcutId: "export",
        hotkey: "Control+Alt+E",
        platform: "windows",
        overrides: {},
      }),
    ).toEqual({
      ok: true,
      hotkey: "Control+Alt+E",
    });
  });

  test("formats hotkeys for menu accelerators", () => {
    expect(studioHotkeyMenuAccelerator("Meta+Shift+S", { platform: "mac" })).toBe(
      "Command+Shift+S",
    );
    expect(studioHotkeyMenuAccelerator("Meta+P", { platform: "windows" })).toBe("Super+P");
    expect(studioHotkeyMenuAccelerator("Meta+P", { platform: "linux" })).toBe("Super+P");
    expect(studioHotkeyMenuAccelerator("Control+Alt+E", { platform: "windows" })).toBe(
      "Control+Alt+E",
    );
    expect(studioHotkeyMenuAccelerator("Space", { platform: "linux" })).toBe("Space");
  });
});
