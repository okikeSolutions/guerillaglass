import { beforeEach, describe, expect, test, vi } from "vitest";
import { hostMenuCommands } from "@shared/bridge/desktopBridgeContract";

type RegisteredHotkey = {
  hotkey: string;
  handler: (event: {
    preventDefault: () => void;
    shiftKey: boolean;
    target: EventTarget | null;
  }) => void;
};

const { registeredHotkeys, useHotkeyMock } = vi.hoisted(() => {
  const registeredHotkeys: RegisteredHotkey[] = [];
  const useHotkeyMock = vi.fn((hotkey: string, handler: RegisteredHotkey["handler"]) => {
    registeredHotkeys.push({ hotkey, handler });
  });
  return { registeredHotkeys, useHotkeyMock };
});

vi.mock("@tanstack/react-hotkeys", async (importOriginal) => {
  const hotkeysModule = await importOriginal<typeof import("@tanstack/react-hotkeys")>();
  return {
    ...hotkeysModule,
    useHotkey: useHotkeyMock,
  };
});

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
      canEditSelectedTimelineClip: false,
      singleKeyShortcutsEnabled: true,
      shortcutOverrides: {
        save: "Control+Shift+P",
      },
      shortcutPlatform: "windows",
      clearInspectorSelection: () => {},
      clearNotice: () => {},
      deleteSelectedTimelineClip: () => {},
      liftSelectedTimelineClip: () => {},
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
