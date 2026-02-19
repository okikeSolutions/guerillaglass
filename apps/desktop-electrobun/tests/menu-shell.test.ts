import { describe, expect, test } from "bun:test";
import type { ApplicationMenuItemConfig } from "electrobun/bun";
import { hostMenuCommandList } from "../src/shared/bridgeRpc";
import {
  decodeHostMenuAction,
  encodeHostMenuAction,
  extractMenuAction,
  isHostMenuCommand,
} from "../src/bun/menu/actions";
import { buildApplicationMenu, buildLinuxTrayMenu } from "../src/bun/menu/builders";
import { routeMenuAction } from "../src/bun/menu/router";

function isNormalApplicationItem(
  item: ApplicationMenuItemConfig,
): item is Exclude<ApplicationMenuItemConfig, { type: "divider" | "separator" }> {
  return item.type !== "divider" && item.type !== "separator";
}

describe("shell menu helpers", () => {
  test("host command registry and encode/decode stay in sync", () => {
    for (const command of hostMenuCommandList) {
      expect(isHostMenuCommand(command)).toBe(true);
      const action = encodeHostMenuAction(command);
      expect(decodeHostMenuAction(action)).toBe(command);
    }
    expect(decodeHostMenuAction("help.docs")).toBeNull();
    expect(isHostMenuCommand("invalid.command")).toBe(false);
  });

  test("application menu varies by platform and reflects state", () => {
    const darwinMenu = buildApplicationMenu(
      {
        canSave: true,
        canExport: false,
        isRecording: true,
        locale: "en-US",
      },
      "darwin",
    );
    const windowsMenu = buildApplicationMenu(
      {
        canSave: false,
        canExport: true,
        isRecording: false,
        locale: "en-US",
      },
      "win32",
    );

    expect(darwinMenu[0]).toEqual(expect.objectContaining({ submenu: expect.any(Array) }));
    expect(windowsMenu[0]).toEqual(expect.objectContaining({ label: "File" }));

    const fileMenu = windowsMenu.find(
      (item): item is Exclude<ApplicationMenuItemConfig, { type: "divider" | "separator" }> =>
        isNormalApplicationItem(item) && item.label === "File",
    );
    expect(fileMenu).toBeDefined();
    const fileSubmenu: ApplicationMenuItemConfig[] = fileMenu?.submenu ?? [];
    const saveItem = fileSubmenu.find(
      (item) => isNormalApplicationItem(item) && item.label === "Save Project",
    );
    expect(saveItem).toEqual(expect.objectContaining({ enabled: false }));
  });

  test("linux tray menu stays command-driven", () => {
    const trayMenu = buildLinuxTrayMenu({
      canSave: true,
      canExport: true,
      isRecording: false,
      locale: "en-US",
    });

    expect(trayMenu[0]).toEqual(
      expect.objectContaining({
        type: "normal",
        action: encodeHostMenuAction("file.openProject"),
      }),
    );
    const exportItem = trayMenu.find(
      (item) => item.type === "normal" && item.label === "Export...",
    );
    expect(exportItem).toEqual(expect.objectContaining({ enabled: true }));
  });

  test("menu labels localize to German", () => {
    const menu = buildApplicationMenu(
      {
        canSave: true,
        canExport: true,
        isRecording: false,
        locale: "de-DE",
      },
      "win32",
    );

    expect(menu[0]).toEqual(expect.objectContaining({ label: "Datei" }));
    const trayMenu = buildLinuxTrayMenu(
      {
        canSave: true,
        canExport: true,
        isRecording: false,
        locale: "de-DE",
      },
      "de-DE",
    );
    expect(trayMenu[0]).toEqual(expect.objectContaining({ label: "Projekt öffnen..." }));
  });

  test("routeMenuAction dispatches host/system actions", () => {
    const calls: string[] = [];

    routeMenuAction(encodeHostMenuAction("file.openProject"), {
      dispatchHostCommand: (command) => calls.push(`host:${command}`),
      toggleDevTools: () => calls.push("devtools"),
      openDocs: () => calls.push("docs"),
      quit: () => calls.push("quit"),
    });
    routeMenuAction("view.toggleDevTools", {
      dispatchHostCommand: (command) => calls.push(`host:${command}`),
      toggleDevTools: () => calls.push("devtools"),
      openDocs: () => calls.push("docs"),
      quit: () => calls.push("quit"),
    });
    routeMenuAction("help.docs", {
      dispatchHostCommand: (command) => calls.push(`host:${command}`),
      toggleDevTools: () => calls.push("devtools"),
      openDocs: () => calls.push("docs"),
      quit: () => calls.push("quit"),
    });
    routeMenuAction("app.quit", {
      dispatchHostCommand: (command) => calls.push(`host:${command}`),
      toggleDevTools: () => calls.push("devtools"),
      openDocs: () => calls.push("docs"),
      quit: () => calls.push("quit"),
    });

    expect(calls).toEqual(["host:file.openProject", "devtools", "docs", "quit"]);
  });

  test("extractMenuAction reads electrobun event payload", () => {
    expect(extractMenuAction({ data: { action: "app.quit" } })).toBe("app.quit");
    expect(extractMenuAction({ data: {} })).toBeNull();
    expect(extractMenuAction(null)).toBeNull();
  });
});
