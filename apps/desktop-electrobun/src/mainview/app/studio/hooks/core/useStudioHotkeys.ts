import { useHotkey } from "@tanstack/react-hotkeys";
import { hostMenuCommands, type HostMenuCommand } from "../../../../../shared/bridgeRpc";
import { studioShortcuts } from "../../../../../shared/shortcuts";

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
  clearInspectorSelection: () => void;
  clearNotice: () => void;
  setTimelineTool: (tool: TimelineTool) => void;
};

export function useStudioHotkeys({
  runHostCommand,
  singleKeyShortcutsEnabled,
  clearInspectorSelection,
  clearNotice,
  setTimelineTool,
}: UseStudioHotkeysOptions): void {
  useHotkey(
    studioShortcuts.save.hotkey,
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
    studioShortcuts.saveAs.hotkey,
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
    studioShortcuts.export.hotkey,
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
    studioShortcuts.playPause.hotkey,
    (event) => {
      if (!singleKeyShortcutsEnabled) {
        return;
      }
      if (shouldBlockGlobalSingleKeyHotkey(event.target)) {
        return;
      }
      event.preventDefault();
      runHostCommand(hostMenuCommands.timelinePlayPause);
    },
    {
      ignoreInputs: true,
      preventDefault: false,
      stopPropagation: false,
    },
  );

  useHotkey(
    studioShortcuts.record.hotkey,
    (event) => {
      if (!singleKeyShortcutsEnabled) {
        return;
      }
      if (shouldBlockGlobalSingleKeyHotkey(event.target)) {
        return;
      }
      event.preventDefault();
      runHostCommand(hostMenuCommands.captureToggleRecording);
    },
    {
      ignoreInputs: true,
      preventDefault: false,
      stopPropagation: false,
    },
  );

  useHotkey(
    studioShortcuts.trimIn.hotkey,
    (event) => {
      if (!singleKeyShortcutsEnabled) {
        return;
      }
      if (shouldBlockGlobalSingleKeyHotkey(event.target)) {
        return;
      }
      event.preventDefault();
      runHostCommand(hostMenuCommands.timelineTrimIn);
    },
    {
      ignoreInputs: true,
      preventDefault: false,
      stopPropagation: false,
    },
  );

  useHotkey(
    studioShortcuts.trimOut.hotkey,
    (event) => {
      if (!singleKeyShortcutsEnabled) {
        return;
      }
      if (shouldBlockGlobalSingleKeyHotkey(event.target)) {
        return;
      }
      event.preventDefault();
      runHostCommand(hostMenuCommands.timelineTrimOut);
    },
    {
      ignoreInputs: true,
      preventDefault: false,
      stopPropagation: false,
    },
  );

  useHotkey(
    studioShortcuts.timelineBlade.hotkey,
    (event) => {
      if (!singleKeyShortcutsEnabled) {
        return;
      }
      if (shouldBlockGlobalSingleKeyHotkey(event.target)) {
        return;
      }
      event.preventDefault();
      setTimelineTool("blade");
    },
    {
      ignoreInputs: true,
      preventDefault: false,
      stopPropagation: false,
    },
  );
}
