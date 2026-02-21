import type { ApplicationMenuItemConfig, MenuItemConfig } from "electrobun/bun";
import { getDesktopMenuMessages } from "@guerillaglass/localization";
import type { HostMenuState } from "../../shared/bridgeRpc";
import {
  isHostCommandChecked,
  listHostCommandsForAppSection,
  listHostCommandsForTray,
  resolveHostCommandAccelerator,
  resolveHostCommandEnabled,
  resolveHostCommandLabel,
  type HostCommandDefinition,
} from "../../shared/hostCommandRegistry";
import { withShortcutLabel } from "../../shared/shortcuts";
import { encodeHostMenuAction } from "./actions";

const separator = { type: "separator" as const };

function prefixedCheckLabel(label: string, checked: boolean): string {
  return checked ? `\u2713 ${label}` : label;
}

function buildAppSectionCommands(
  section: "file" | "capture" | "timeline" | "language" | "density",
  state: HostMenuState,
  locale?: string,
): ApplicationMenuItemConfig[] {
  const labels = getDesktopMenuMessages(locale ?? state.locale);
  const definitions = listHostCommandsForAppSection(section);
  const items: ApplicationMenuItemConfig[] = [];
  let previousGroup: number | undefined;
  for (const definition of definitions) {
    const group = definition.menu.appGroup;
    if (
      previousGroup !== undefined &&
      group !== undefined &&
      group !== previousGroup &&
      items.length > 0
    ) {
      items.push(separator);
    }
    previousGroup = group;
    items.push({
      label: prefixedCheckLabel(
        resolveHostCommandLabel(definition, labels, state),
        isHostCommandChecked(definition, state),
      ),
      action: encodeHostMenuAction(definition.id),
      accelerator: resolveHostCommandAccelerator(definition),
      enabled: resolveHostCommandEnabled(definition, state),
    });
  }
  return items;
}

function toTrayCommandItem(
  definition: HostCommandDefinition,
  state: HostMenuState,
  locale?: string,
): MenuItemConfig {
  const labels = getDesktopMenuMessages(locale ?? state.locale);
  const checkedLabel = prefixedCheckLabel(
    resolveHostCommandLabel(definition, labels, state),
    isHostCommandChecked(definition, state),
  );
  const label = definition.shortcut
    ? withShortcutLabel(checkedLabel, definition.shortcut, { platform: "linux" })
    : checkedLabel;

  return {
    type: "normal",
    label,
    action: encodeHostMenuAction(definition.id),
    enabled: resolveHostCommandEnabled(definition, state),
  };
}

function buildTrayCommands(state: HostMenuState, locale?: string): MenuItemConfig[] {
  const definitions = listHostCommandsForTray();
  const items: MenuItemConfig[] = [];
  let previousGroup: number | undefined;
  for (const definition of definitions) {
    const group = definition.menu.trayGroup;
    if (
      previousGroup !== undefined &&
      group !== undefined &&
      group !== previousGroup &&
      items.length > 0
    ) {
      items.push(separator);
    }
    previousGroup = group;
    items.push(toTrayCommandItem(definition, state, locale));
  }
  return items;
}

export function buildApplicationMenu(
  state: HostMenuState,
  platform: NodeJS.Platform = process.platform,
  locale?: string,
): ApplicationMenuItemConfig[] {
  const labels = getDesktopMenuMessages(locale ?? state.locale);

  return [
    ...(platform === "darwin"
      ? [
          {
            submenu: [
              { role: "about" },
              separator,
              { role: "hide" },
              { role: "hideOthers" },
              { role: "showAll" },
              separator,
              { role: "quit" },
            ],
          },
        ]
      : []),
    {
      label: labels.file,
      action: "menu.file",
      submenu: [
        ...buildAppSectionCommands("file", state, locale),
        separator,
        {
          label: labels.quit,
          action: "app.quit",
          accelerator: "q",
        },
      ],
    },
    {
      label: labels.edit,
      action: "menu.edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        separator,
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: labels.capture,
      action: "menu.capture",
      submenu: buildAppSectionCommands("capture", state, locale),
    },
    {
      label: labels.timeline,
      action: "menu.timeline",
      submenu: buildAppSectionCommands("timeline", state, locale),
    },
    {
      label: labels.view,
      action: "menu.view",
      submenu: [
        { role: "toggleFullScreen" },
        separator,
        {
          label: labels.language,
          action: "menu.view.language",
          submenu: buildAppSectionCommands("language", state, locale),
        },
        {
          label: labels.density,
          action: "menu.view.density",
          submenu: buildAppSectionCommands("density", state, locale),
        },
        separator,
        {
          label: labels.toggleDeveloperTools,
          action: "view.toggleDevTools",
        },
      ],
    },
    ...(platform === "darwin"
      ? [
          {
            label: labels.window,
            action: "menu.window",
            submenu: [
              { role: "minimize" },
              { role: "zoom" },
              separator,
              { role: "bringAllToFront" },
            ],
          },
        ]
      : []),
    {
      label: labels.help,
      action: "menu.help",
      submenu: [{ label: labels.documentation, action: "help.docs" }],
    },
  ];
}

export function buildLinuxTrayMenu(state: HostMenuState, locale?: string): MenuItemConfig[] {
  const labels = getDesktopMenuMessages(locale ?? state.locale);
  return [
    ...buildTrayCommands(state, locale),
    separator,
    { type: "normal", label: labels.quit, action: "app.quit" },
  ];
}
