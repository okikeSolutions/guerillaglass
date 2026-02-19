import type { ApplicationMenuItemConfig, MenuItemConfig } from "electrobun/bun";
import { getDesktopMenuMessages } from "@guerillaglass/localization";
import type { HostMenuState } from "../../shared/bridgeRpc";
import { encodeHostMenuAction } from "./actions";

const separator = { type: "separator" as const };

export function buildApplicationMenu(
  state: HostMenuState,
  platform: NodeJS.Platform = process.platform,
  locale?: string,
): ApplicationMenuItemConfig[] {
  const labels = getDesktopMenuMessages(locale ?? state.locale);
  const recordingLabel = state.isRecording ? labels.stopRecording : labels.startRecording;

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
          accelerator: "s",
          enabled: state.canSave,
        },
        {
          label: labels.saveProjectAs,
          action: encodeHostMenuAction("file.saveProjectAs"),
          enabled: state.canSave,
        },
        separator,
        {
          label: labels.export,
          action: encodeHostMenuAction("file.export"),
          accelerator: "e",
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
          accelerator: "r",
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
          accelerator: "space",
        },
        {
          label: labels.setTrimIn,
          action: encodeHostMenuAction("timeline.trimIn"),
          accelerator: "i",
        },
        {
          label: labels.setTrimOut,
          action: encodeHostMenuAction("timeline.trimOut"),
          accelerator: "o",
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
  const recordingLabel = state.isRecording ? labels.stopRecording : labels.startRecording;
  return [
    { type: "normal", label: labels.openProject, action: encodeHostMenuAction("file.openProject") },
    {
      type: "normal",
      label: labels.saveProject,
      action: encodeHostMenuAction("file.saveProject"),
      enabled: state.canSave,
    },
    {
      type: "normal",
      label: labels.saveProjectAs,
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
      label: labels.export,
      action: encodeHostMenuAction("file.export"),
      enabled: state.canExport,
    },
    separator,
    { type: "normal", label: labels.quit, action: "app.quit" },
  ];
}
