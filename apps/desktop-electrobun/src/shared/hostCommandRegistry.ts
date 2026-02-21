import type { DesktopMenuMessages } from "@guerillaglass/localization";
import { hostMenuCommands, type HostMenuCommand, type HostMenuState } from "./bridgeRpc";
import { studioShortcuts, type StudioShortcutId } from "./shortcuts";

type HostCommandLabelKey = keyof DesktopMenuMessages | "recordingToggle";
type HostCommandEnablement = "canSave" | "canExport";
type HostCommandCheckedState =
  | "locale.en-US"
  | "locale.de-DE"
  | "density.comfortable"
  | "density.compact";

export type HostCommandAppSection = "file" | "capture" | "timeline" | "language" | "density";
export type HostCommandHandlerKey =
  | "appRefresh"
  | "appLocaleEnUS"
  | "appLocaleDeDE"
  | "captureToggleRecording"
  | "captureStartPreview"
  | "captureStopPreview"
  | "timelinePlayPause"
  | "timelineTrimIn"
  | "timelineTrimOut"
  | "timelineTogglePanel"
  | "viewDensityComfortable"
  | "viewDensityCompact"
  | "fileOpenProject"
  | "fileSaveProject"
  | "fileSaveProjectAs"
  | "fileExport";

type HostCommandMenuMetadata = {
  appSection?: HostCommandAppSection;
  appGroup?: number;
  includeInTray?: boolean;
  trayGroup?: number;
  labelKey: HostCommandLabelKey;
  accelerator?: string;
  enableWhen?: HostCommandEnablement;
  checkedWhen?: HostCommandCheckedState;
};

export type HostCommandDefinition = {
  id: HostMenuCommand;
  handler: HostCommandHandlerKey;
  shortcut?: StudioShortcutId;
  menu: HostCommandMenuMetadata;
};

export const hostCommandDefinitions: HostCommandDefinition[] = [
  {
    id: hostMenuCommands.appRefresh,
    handler: "appRefresh",
    menu: {
      appSection: "capture",
      appGroup: 1,
      labelKey: "refreshSources",
    },
  },
  {
    id: hostMenuCommands.appLocaleEnUS,
    handler: "appLocaleEnUS",
    menu: {
      appSection: "language",
      appGroup: 0,
      includeInTray: true,
      trayGroup: 2,
      labelKey: "languageEnglish",
      checkedWhen: "locale.en-US",
    },
  },
  {
    id: hostMenuCommands.appLocaleDeDE,
    handler: "appLocaleDeDE",
    menu: {
      appSection: "language",
      appGroup: 0,
      includeInTray: true,
      trayGroup: 2,
      labelKey: "languageGerman",
      checkedWhen: "locale.de-DE",
    },
  },
  {
    id: hostMenuCommands.captureToggleRecording,
    handler: "captureToggleRecording",
    shortcut: "record",
    menu: {
      appSection: "capture",
      appGroup: 0,
      includeInTray: true,
      trayGroup: 1,
      labelKey: "recordingToggle",
    },
  },
  {
    id: hostMenuCommands.captureStartPreview,
    handler: "captureStartPreview",
    menu: {
      appSection: "capture",
      appGroup: 0,
      labelKey: "startPreview",
    },
  },
  {
    id: hostMenuCommands.captureStopPreview,
    handler: "captureStopPreview",
    menu: {
      appSection: "capture",
      appGroup: 0,
      labelKey: "stopPreview",
    },
  },
  {
    id: hostMenuCommands.timelinePlayPause,
    handler: "timelinePlayPause",
    shortcut: "playPause",
    menu: {
      appSection: "timeline",
      appGroup: 0,
      labelKey: "playPause",
    },
  },
  {
    id: hostMenuCommands.timelineTrimIn,
    handler: "timelineTrimIn",
    shortcut: "trimIn",
    menu: {
      appSection: "timeline",
      appGroup: 0,
      labelKey: "setTrimIn",
    },
  },
  {
    id: hostMenuCommands.timelineTrimOut,
    handler: "timelineTrimOut",
    shortcut: "trimOut",
    menu: {
      appSection: "timeline",
      appGroup: 0,
      labelKey: "setTrimOut",
    },
  },
  {
    id: hostMenuCommands.timelineTogglePanel,
    handler: "timelineTogglePanel",
    menu: {
      appSection: "timeline",
      appGroup: 1,
      labelKey: "toggleTimeline",
    },
  },
  {
    id: hostMenuCommands.viewDensityComfortable,
    handler: "viewDensityComfortable",
    menu: {
      appSection: "density",
      appGroup: 0,
      includeInTray: true,
      trayGroup: 3,
      labelKey: "densityComfortable",
      checkedWhen: "density.comfortable",
    },
  },
  {
    id: hostMenuCommands.viewDensityCompact,
    handler: "viewDensityCompact",
    menu: {
      appSection: "density",
      appGroup: 0,
      includeInTray: true,
      trayGroup: 3,
      labelKey: "densityCompact",
      checkedWhen: "density.compact",
    },
  },
  {
    id: hostMenuCommands.fileOpenProject,
    handler: "fileOpenProject",
    menu: {
      appSection: "file",
      appGroup: 0,
      includeInTray: true,
      trayGroup: 0,
      labelKey: "openProject",
      accelerator: "o",
    },
  },
  {
    id: hostMenuCommands.fileSaveProject,
    handler: "fileSaveProject",
    shortcut: "save",
    menu: {
      appSection: "file",
      appGroup: 1,
      includeInTray: true,
      trayGroup: 0,
      labelKey: "saveProject",
      enableWhen: "canSave",
    },
  },
  {
    id: hostMenuCommands.fileSaveProjectAs,
    handler: "fileSaveProjectAs",
    shortcut: "saveAs",
    menu: {
      appSection: "file",
      appGroup: 1,
      includeInTray: true,
      trayGroup: 0,
      labelKey: "saveProjectAs",
      enableWhen: "canSave",
    },
  },
  {
    id: hostMenuCommands.fileExport,
    handler: "fileExport",
    shortcut: "export",
    menu: {
      appSection: "file",
      appGroup: 2,
      includeInTray: true,
      trayGroup: 1,
      labelKey: "export",
      enableWhen: "canExport",
    },
  },
];

export const hostCommandDefinitionById = Object.fromEntries(
  hostCommandDefinitions.map((definition) => [definition.id, definition]),
) as Record<HostMenuCommand, HostCommandDefinition>;
const hostCommandOrderById = new Map(
  hostCommandDefinitions.map((definition, index) => [definition.id, index]),
);

function resolveCheckedState(
  checkedWhen: HostCommandCheckedState | undefined,
  state: HostMenuState,
): boolean {
  switch (checkedWhen) {
    case "locale.en-US":
      return state.locale !== "de-DE";
    case "locale.de-DE":
      return state.locale === "de-DE";
    case "density.comfortable":
      return state.densityMode !== "compact";
    case "density.compact":
      return state.densityMode === "compact";
    default:
      return false;
  }
}

export function resolveHostCommandLabel(
  definition: HostCommandDefinition,
  labels: DesktopMenuMessages,
  state: HostMenuState,
): string {
  if (definition.menu.labelKey === "recordingToggle") {
    return state.isRecording ? labels.stopRecording : labels.startRecording;
  }
  return labels[definition.menu.labelKey];
}

export function resolveHostCommandEnabled(
  definition: HostCommandDefinition,
  state: HostMenuState,
): boolean | undefined {
  if (!definition.menu.enableWhen) {
    return undefined;
  }
  return state[definition.menu.enableWhen];
}

export function isHostCommandChecked(
  definition: HostCommandDefinition,
  state: HostMenuState,
): boolean {
  return resolveCheckedState(definition.menu.checkedWhen, state);
}

export function resolveHostCommandAccelerator(
  definition: HostCommandDefinition,
): string | undefined {
  if (definition.menu.accelerator) {
    return definition.menu.accelerator;
  }
  if (!definition.shortcut) {
    return undefined;
  }
  return studioShortcuts[definition.shortcut].menuAccelerator;
}

export function listHostCommandsForAppSection(
  section: HostCommandAppSection,
): HostCommandDefinition[] {
  return hostCommandDefinitions.filter((definition) => definition.menu.appSection === section);
}

export function listHostCommandsForTray(): HostCommandDefinition[] {
  return hostCommandDefinitions
    .filter((definition) => definition.menu.includeInTray === true)
    .sort((left, right) => {
      const leftGroup = left.menu.trayGroup ?? Number.MAX_SAFE_INTEGER;
      const rightGroup = right.menu.trayGroup ?? Number.MAX_SAFE_INTEGER;
      if (leftGroup !== rightGroup) {
        return leftGroup - rightGroup;
      }
      return (
        (hostCommandOrderById.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
        (hostCommandOrderById.get(right.id) ?? Number.MAX_SAFE_INTEGER)
      );
    });
}

export function createHostCommandRunner(
  handlers: Partial<Record<HostMenuCommand, () => void>>,
): (command: HostMenuCommand) => void {
  return (command: HostMenuCommand) => {
    const handler = handlers[command];
    if (!handler) {
      throw new Error(`Unhandled host command: ${command}`);
    }
    handler();
  };
}

export function createHostCommandRunnerFromHandlers(
  handlers: Record<HostCommandHandlerKey, () => void>,
): (command: HostMenuCommand) => void {
  const commandHandlers: Record<HostMenuCommand, () => void> = Object.fromEntries(
    hostCommandDefinitions.map((definition) => [definition.id, handlers[definition.handler]]),
  ) as Record<HostMenuCommand, () => void>;
  return createHostCommandRunner(commandHandlers);
}
