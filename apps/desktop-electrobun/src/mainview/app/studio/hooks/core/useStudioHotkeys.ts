import { useHotkey, type RegisterableHotkey } from "@tanstack/react-hotkeys";
import { hostMenuCommands, type HostMenuCommand } from "../../../../../shared/bridgeRpc";
import {
  isStudioShortcutSingleKey,
  resolveStudioShortcutHotkey,
  type ShortcutDisplayPlatform,
  type StudioShortcutId,
  type StudioShortcutOverrides,
} from "../../../../../shared/shortcuts";

type TimelineTool = "select" | "trim" | "blade";

const interactiveGlobalHotkeySelector = [
  "input",
  "textarea",
  "select",
  "button",
  "a[href]",
  "[contenteditable]:not([contenteditable='false'])",
  "[role='button']",
  "[role='link']",
  "[role='menuitem']",
  "[role='tab']",
  "[role='checkbox']",
  "[role='radio']",
  "[role='switch']",
].join(",");

function shouldBlockGlobalSingleKeyHotkey(target: EventTarget | null): boolean {
  if (target == null || typeof target !== "object") {
    return false;
  }
  const elementLike = target as { closest?: (selector: string) => Element | null };
  if (typeof elementLike.closest !== "function") {
    return false;
  }
  return elementLike.closest(interactiveGlobalHotkeySelector) != null;
}

type UseStudioHotkeysOptions = {
  runHostCommand: (command: HostMenuCommand) => void;
  singleKeyShortcutsEnabled: boolean;
  shortcutOverrides: StudioShortcutOverrides;
  shortcutPlatform: ShortcutDisplayPlatform;
  clearInspectorSelection: () => void;
  clearNotice: () => void;
  setTimelineTool: (tool: TimelineTool) => void;
};

function shortcutOptionsFor(
  shortcutId: StudioShortcutId,
  shortcutOverrides: StudioShortcutOverrides,
  shortcutPlatform: ShortcutDisplayPlatform,
) {
  const hotkey = resolveStudioShortcutHotkey(shortcutId, {
    platform: shortcutPlatform,
    overrides: shortcutOverrides,
  });
  const singleKey = isStudioShortcutSingleKey(shortcutId, {
    platform: shortcutPlatform,
    overrides: shortcutOverrides,
  });

  return {
    hotkey: hotkey as RegisterableHotkey,
    singleKey,
  };
}

export function useStudioHotkeys({
  runHostCommand,
  singleKeyShortcutsEnabled,
  shortcutOverrides,
  shortcutPlatform,
  clearInspectorSelection,
  clearNotice,
  setTimelineTool,
}: UseStudioHotkeysOptions): void {
  const saveShortcut = shortcutOptionsFor("save", shortcutOverrides, shortcutPlatform);
  const saveAsShortcut = shortcutOptionsFor("saveAs", shortcutOverrides, shortcutPlatform);
  const exportShortcut = shortcutOptionsFor("export", shortcutOverrides, shortcutPlatform);
  const playPauseShortcut = shortcutOptionsFor("playPause", shortcutOverrides, shortcutPlatform);
  const recordShortcut = shortcutOptionsFor("record", shortcutOverrides, shortcutPlatform);
  const trimInShortcut = shortcutOptionsFor("trimIn", shortcutOverrides, shortcutPlatform);
  const trimOutShortcut = shortcutOptionsFor("trimOut", shortcutOverrides, shortcutPlatform);
  const bladeShortcut = shortcutOptionsFor("timelineBlade", shortcutOverrides, shortcutPlatform);

  useHotkey(
    saveShortcut.hotkey,
    (event) => {
      if (event.shiftKey) {
        return;
      }
      event.preventDefault();
      runHostCommand(hostMenuCommands.fileSaveProject);
    },
    {
      ignoreInputs: false,
      preventDefault: false,
      stopPropagation: false,
    },
  );

  useHotkey(
    saveAsShortcut.hotkey,
    (event) => {
      event.preventDefault();
      runHostCommand(hostMenuCommands.fileSaveProjectAs);
    },
    {
      ignoreInputs: false,
      preventDefault: false,
      stopPropagation: false,
    },
  );

  useHotkey(
    exportShortcut.hotkey,
    (event) => {
      event.preventDefault();
      runHostCommand(hostMenuCommands.fileExport);
    },
    {
      ignoreInputs: false,
      preventDefault: false,
      stopPropagation: false,
    },
  );

  useHotkey(
    "Escape",
    () => {
      clearInspectorSelection();
      clearNotice();
    },
    { ignoreInputs: false },
  );

  useHotkey(
    playPauseShortcut.hotkey,
    (event) => {
      if (
        playPauseShortcut.singleKey &&
        (!singleKeyShortcutsEnabled || shouldBlockGlobalSingleKeyHotkey(event.target))
      ) {
        return;
      }
      event.preventDefault();
      runHostCommand(hostMenuCommands.timelinePlayPause);
    },
    {
      ignoreInputs: playPauseShortcut.singleKey,
      preventDefault: false,
      stopPropagation: false,
    },
  );

  useHotkey(
    recordShortcut.hotkey,
    (event) => {
      if (
        recordShortcut.singleKey &&
        (!singleKeyShortcutsEnabled || shouldBlockGlobalSingleKeyHotkey(event.target))
      ) {
        return;
      }
      event.preventDefault();
      runHostCommand(hostMenuCommands.captureToggleRecording);
    },
    {
      ignoreInputs: recordShortcut.singleKey,
      preventDefault: false,
      stopPropagation: false,
    },
  );

  useHotkey(
    trimInShortcut.hotkey,
    (event) => {
      if (
        trimInShortcut.singleKey &&
        (!singleKeyShortcutsEnabled || shouldBlockGlobalSingleKeyHotkey(event.target))
      ) {
        return;
      }
      event.preventDefault();
      runHostCommand(hostMenuCommands.timelineTrimIn);
    },
    {
      ignoreInputs: trimInShortcut.singleKey,
      preventDefault: false,
      stopPropagation: false,
    },
  );

  useHotkey(
    trimOutShortcut.hotkey,
    (event) => {
      if (
        trimOutShortcut.singleKey &&
        (!singleKeyShortcutsEnabled || shouldBlockGlobalSingleKeyHotkey(event.target))
      ) {
        return;
      }
      event.preventDefault();
      runHostCommand(hostMenuCommands.timelineTrimOut);
    },
    {
      ignoreInputs: trimOutShortcut.singleKey,
      preventDefault: false,
      stopPropagation: false,
    },
  );

  useHotkey(
    bladeShortcut.hotkey,
    (event) => {
      if (
        bladeShortcut.singleKey &&
        (!singleKeyShortcutsEnabled || shouldBlockGlobalSingleKeyHotkey(event.target))
      ) {
        return;
      }
      event.preventDefault();
      setTimelineTool("blade");
    },
    {
      ignoreInputs: bladeShortcut.singleKey,
      preventDefault: false,
      stopPropagation: false,
    },
  );
}
