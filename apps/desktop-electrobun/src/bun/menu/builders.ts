import type { ApplicationMenuItemConfig, MenuItemConfig } from "electrobun/bun";
import type { HostMenuState } from "../../shared/bridgeRpc";
import { encodeHostMenuAction } from "./actions";

const separator = { type: "separator" as const };

export function buildApplicationMenu(
  state: HostMenuState,
  platform: NodeJS.Platform = process.platform,
): ApplicationMenuItemConfig[] {
  const recordingLabel = state.isRecording ? "Stop Recording" : "Start Recording";

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
      label: "File",
      action: "menu.file",
      submenu: [
        {
          label: "Open Project...",
          action: encodeHostMenuAction("file.openProject"),
          accelerator: "o",
        },
        separator,
        {
          label: "Save Project",
          action: encodeHostMenuAction("file.saveProject"),
          accelerator: "s",
          enabled: state.canSave,
        },
        {
          label: "Save Project As...",
          action: encodeHostMenuAction("file.saveProjectAs"),
          enabled: state.canSave,
        },
        separator,
        {
          label: "Export...",
          action: encodeHostMenuAction("file.export"),
          accelerator: "e",
          enabled: state.canExport,
        },
        ...(platform !== "darwin" ? [separator, { role: "quit" }] : []),
      ],
    },
    {
      label: "Edit",
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
      label: "Capture",
      action: "menu.capture",
      submenu: [
        {
          label: recordingLabel,
          action: encodeHostMenuAction("capture.toggleRecording"),
          accelerator: "r",
        },
        { label: "Start Preview", action: encodeHostMenuAction("capture.startPreview") },
        { label: "Stop Preview", action: encodeHostMenuAction("capture.stopPreview") },
        separator,
        {
          label: "Refresh Sources",
          action: encodeHostMenuAction("app.refresh"),
        },
      ],
    },
    {
      label: "Timeline",
      action: "menu.timeline",
      submenu: [
        {
          label: "Play/Pause",
          action: encodeHostMenuAction("timeline.playPause"),
          accelerator: "space",
        },
        {
          label: "Set Trim In",
          action: encodeHostMenuAction("timeline.trimIn"),
          accelerator: "i",
        },
        {
          label: "Set Trim Out",
          action: encodeHostMenuAction("timeline.trimOut"),
          accelerator: "o",
        },
      ],
    },
    {
      label: "View",
      action: "menu.view",
      submenu: [
        { role: "toggleFullScreen" },
        separator,
        {
          label: "Toggle Developer Tools",
          action: "view.toggleDevTools",
        },
      ],
    },
    ...(platform === "darwin"
      ? [
          {
            label: "Window",
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
      label: "Help",
      action: "menu.help",
      submenu: [{ label: "Guerillaglass Documentation", action: "help.docs" }],
    },
  ];
}

export function buildLinuxTrayMenu(state: HostMenuState): MenuItemConfig[] {
  const recordingLabel = state.isRecording ? "Stop Recording" : "Start Recording";
  return [
    { type: "normal", label: "Open Project...", action: encodeHostMenuAction("file.openProject") },
    {
      type: "normal",
      label: "Save Project",
      action: encodeHostMenuAction("file.saveProject"),
      enabled: state.canSave,
    },
    {
      type: "normal",
      label: "Save Project As...",
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
      label: "Export...",
      action: encodeHostMenuAction("file.export"),
      enabled: state.canExport,
    },
    separator,
    { type: "normal", label: "Quit", action: "app.quit" },
  ];
}
