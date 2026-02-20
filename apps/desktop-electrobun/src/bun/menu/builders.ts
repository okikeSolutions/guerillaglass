import type { ApplicationMenuItemConfig, MenuItemConfig } from "electrobun/bun";
import { getDesktopMenuMessages } from "@guerillaglass/localization";
import type { HostMenuState } from "../../shared/bridgeRpc";
import { studioShortcuts, withShortcutLabel } from "../../shared/shortcuts";
import { encodeHostMenuAction } from "./actions";

const separator = { type: "separator" as const };

export function buildApplicationMenu(
  state: HostMenuState,
  platform: NodeJS.Platform = process.platform,
  locale?: string,
): ApplicationMenuItemConfig[] {
  const labels = getDesktopMenuMessages(locale ?? state.locale);
  const recordingLabel = state.isRecording ? labels.stopRecording : labels.startRecording;
  const localeSelection = state.locale === "de-DE" ? "de-DE" : "en-US";
  const densitySelection = state.densityMode === "compact" ? "compact" : "comfortable";

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
        {
          label: labels.openProject,
          action: encodeHostMenuAction("file.openProject"),
          accelerator: "o",
        },
        separator,
        {
          label: labels.saveProject,
          action: encodeHostMenuAction("file.saveProject"),
          accelerator: studioShortcuts.save.menuAccelerator,
          enabled: state.canSave,
        },
        {
          label: labels.saveProjectAs,
          action: encodeHostMenuAction("file.saveProjectAs"),
          accelerator: studioShortcuts.saveAs.menuAccelerator,
          enabled: state.canSave,
        },
        separator,
        {
          label: labels.export,
          action: encodeHostMenuAction("file.export"),
          accelerator: studioShortcuts.export.menuAccelerator,
          enabled: state.canExport,
        },
        ...(platform !== "darwin" ? [separator, { role: "quit" }] : []),
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
      submenu: [
        {
          label: recordingLabel,
          action: encodeHostMenuAction("capture.toggleRecording"),
          accelerator: studioShortcuts.record.menuAccelerator,
        },
        { label: labels.startPreview, action: encodeHostMenuAction("capture.startPreview") },
        { label: labels.stopPreview, action: encodeHostMenuAction("capture.stopPreview") },
        separator,
        {
          label: labels.refreshSources,
          action: encodeHostMenuAction("app.refresh"),
        },
      ],
    },
    {
      label: labels.timeline,
      action: "menu.timeline",
      submenu: [
        {
          label: labels.playPause,
          action: encodeHostMenuAction("timeline.playPause"),
          accelerator: studioShortcuts.playPause.menuAccelerator,
        },
        {
          label: labels.setTrimIn,
          action: encodeHostMenuAction("timeline.trimIn"),
          accelerator: studioShortcuts.trimIn.menuAccelerator,
        },
        {
          label: labels.setTrimOut,
          action: encodeHostMenuAction("timeline.trimOut"),
          accelerator: studioShortcuts.trimOut.menuAccelerator,
        },
        separator,
        {
          label: labels.toggleTimeline,
          action: encodeHostMenuAction("timeline.togglePanel"),
        },
      ],
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
          submenu: [
            {
              label:
                localeSelection === "en-US"
                  ? `\u2713 ${labels.languageEnglish}`
                  : labels.languageEnglish,
              action: encodeHostMenuAction("app.locale.enUS"),
            },
            {
              label:
                localeSelection === "de-DE"
                  ? `\u2713 ${labels.languageGerman}`
                  : labels.languageGerman,
              action: encodeHostMenuAction("app.locale.deDE"),
            },
          ],
        },
        {
          label: labels.density,
          action: "menu.view.density",
          submenu: [
            {
              label:
                densitySelection === "comfortable"
                  ? `\u2713 ${labels.densityComfortable}`
                  : labels.densityComfortable,
              action: encodeHostMenuAction("view.density.comfortable"),
            },
            {
              label:
                densitySelection === "compact"
                  ? `\u2713 ${labels.densityCompact}`
                  : labels.densityCompact,
              action: encodeHostMenuAction("view.density.compact"),
            },
          ],
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
  const recordingLabel = withShortcutLabel(
    state.isRecording ? labels.stopRecording : labels.startRecording,
    "record",
    { platform: "linux" },
  );
  const localeSelection = state.locale === "de-DE" ? "de-DE" : "en-US";
  const densitySelection = state.densityMode === "compact" ? "compact" : "comfortable";
  return [
    { type: "normal", label: labels.openProject, action: encodeHostMenuAction("file.openProject") },
    {
      type: "normal",
      label: withShortcutLabel(labels.saveProject, "save", { platform: "linux" }),
      action: encodeHostMenuAction("file.saveProject"),
      enabled: state.canSave,
    },
    {
      type: "normal",
      label: withShortcutLabel(labels.saveProjectAs, "saveAs", { platform: "linux" }),
      action: encodeHostMenuAction("file.saveProjectAs"),
      enabled: state.canSave,
    },
    separator,
    {
      type: "normal",
      label: recordingLabel,
      action: encodeHostMenuAction("capture.toggleRecording"),
    },
    {
      type: "normal",
      label: withShortcutLabel(labels.export, "export", { platform: "linux" }),
      action: encodeHostMenuAction("file.export"),
      enabled: state.canExport,
    },
    separator,
    {
      type: "normal",
      label:
        localeSelection === "en-US" ? `\u2713 ${labels.languageEnglish}` : labels.languageEnglish,
      action: encodeHostMenuAction("app.locale.enUS"),
    },
    {
      type: "normal",
      label:
        localeSelection === "de-DE" ? `\u2713 ${labels.languageGerman}` : labels.languageGerman,
      action: encodeHostMenuAction("app.locale.deDE"),
    },
    separator,
    {
      type: "normal",
      label:
        densitySelection === "comfortable"
          ? `\u2713 ${labels.densityComfortable}`
          : labels.densityComfortable,
      action: encodeHostMenuAction("view.density.comfortable"),
    },
    {
      type: "normal",
      label:
        densitySelection === "compact" ? `\u2713 ${labels.densityCompact}` : labels.densityCompact,
      action: encodeHostMenuAction("view.density.compact"),
    },
    separator,
    { type: "normal", label: labels.quit, action: "app.quit" },
  ];
}
