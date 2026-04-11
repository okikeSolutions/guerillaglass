import { beforeEach, describe, expect, mock, test } from "bun:test";
import { hostMenuCommands } from "@shared/bridge";

type RegisteredHotkey = {
  hotkey: string;
  handler: (event: {
    preventDefault: () => void;
    shiftKey: boolean;
    target: EventTarget | null;
  }) => void;
};

const registeredHotkeys: RegisteredHotkey[] = [];
const useHotkeyMock = mock((hotkey: string, handler: RegisteredHotkey["handler"]) => {
  registeredHotkeys.push({ hotkey, handler });
});
const hotkeysModule = await import("@tanstack/react-hotkeys");

mock.module("@tanstack/react-hotkeys", () => ({
  ...hotkeysModule,
  useHotkey: useHotkeyMock,
}));

const { useStudioHotkeys } = await import("@studio/hooks/core/useStudioHotkeys");

describe("studio hotkeys", () => {
  beforeEach(() => {
    registeredHotkeys.length = 0;
    useHotkeyMock.mockClear();
  });

  test("save override continues to fire when the binding includes Shift", () => {
    const commands: string[] = [];

    useStudioHotkeys({
      runHostCommand: (command) => commands.push(command),
      canTrimTimeline: true,
      singleKeyShortcutsEnabled: true,
      shortcutOverrides: {
        save: "Control+Shift+P",
      },
      shortcutPlatform: "windows",
      clearInspectorSelection: () => {},
      clearNotice: () => {},
      setTimelineTool: () => {},
    });

    const saveRegistration = registeredHotkeys.find(
      (registration) => registration.hotkey === "Control+Shift+P",
    );
    expect(saveRegistration).toBeDefined();

    let prevented = false;
    saveRegistration?.handler({
      preventDefault: () => {
        prevented = true;
      },
      shiftKey: true,
      target: null,
    });

    expect(prevented).toBe(true);
    expect(commands).toEqual([hostMenuCommands.fileSaveProject]);
  });
});
