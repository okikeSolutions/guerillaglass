import Electrobun, {
  ApplicationMenu,
  BrowserView,
  BrowserWindow,
  Tray,
  Updater,
  Utils,
} from "electrobun/bun";
import { Effect } from "effect";
import { constants as fsConstants } from "node:fs";
import { access } from "node:fs/promises";
import type { ReviewBridgeEvent } from "@guerillaglass/review-protocol";
import { decodeUnknownWithSchemaSync } from "../../shared/errors";
import {
  hostReviewEventMessageSchema,
  type DesktopBridgeRPC,
  type HostMenuCommand,
  type HostMenuState,
} from "../../shared/bridge";
import { studioShortcutOverridesEqual } from "../../shared/shortcuts";
import { extractMenuAction } from "../menu/actions";
import { buildApplicationMenu, buildLinuxTrayMenu } from "../menu/builders";
import { routeMenuAction } from "../menu/router";
import { readAllowedTextFile } from "../security/fileAccess";
import { createEngineBridgeHandlers } from "../bridge/requestHandlers";
import { EngineTransport } from "../engine/service";
import { pickPathForMode } from "../path/picker";
import type { HostPathPickerMode } from "../../shared/bridge";
import { createHostRuntime, type HostRuntime } from "../runtime/hostRuntime";

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;
type BunRPC = ReturnType<typeof BrowserView.defineRPC<DesktopBridgeRPC>>;

let mainWindow: BrowserWindow<BunRPC> | null = null;
let linuxTray: Tray | null = null;
let hostMenuState: HostMenuState = {
  canSave: false,
  canExport: false,
  isRecording: false,
  recordingURL: null,
  locale: "en-US",
  densityMode: "comfortable",
  shortcutOverrides: {},
};
let currentProjectPath: string | null = null;
let hostRuntime: HostRuntime | null = null;

async function disposeHostShell() {
  const runtime = hostRuntime;
  hostRuntime = null;
  mainWindow = null;
  linuxTray?.remove();
  linuxTray = null;
  await runtime?.dispose();
}

async function getMainViewURL(): Promise<string> {
  const channel = await Updater.localInfo.channel();
  if (channel === "dev") {
    try {
      await fetch(DEV_SERVER_URL, { method: "HEAD" });
      console.log(`HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`);
      return DEV_SERVER_URL;
    } catch {
      console.log("Vite dev server not running. Run 'bun run dev:hmr' for HMR support.");
    }
  }
  return "views://mainview/index.html";
}

async function pickPath(params: {
  mode: HostPathPickerMode;
  startingFolder?: string;
}): Promise<string | null> {
  const defaultPickerFolder = Utils.paths.videos ?? Utils.paths.documents;

  return await pickPathForMode(params.mode, {
    currentProjectPath,
    startingFolder: params.startingFolder,
    defaultFolder: defaultPickerFolder,
    // Keep dialog calls bound to Utils to avoid runtime method-context issues.
    openFileDialog: (options) => Utils.openFileDialog(options),
    pathExists: async (filePath) => {
      try {
        await access(filePath, fsConstants.F_OK);
        return true;
      } catch {
        return false;
      }
    },
    confirmOverwritePath: async (filePath) => {
      const result = await Utils.showMessageBox({
        type: "question",
        title: "Replace Project?",
        message: "A project already exists at this location.",
        detail: filePath,
        buttons: ["Replace", "Cancel"],
        defaultId: 1,
        cancelId: 1,
      });
      return result.response === 0;
    },
  });
}

async function readTextFile(filePath: string): Promise<string> {
  return await readAllowedTextFile(filePath, {
    currentProjectPath,
    tempDirectory: process.env.TMPDIR,
  });
}

function applyShellMenus() {
  try {
    ApplicationMenu.setApplicationMenu(buildApplicationMenu(hostMenuState));
  } catch (error) {
    console.warn("Application menu setup failed:", error);
  }

  if (process.platform !== "linux") {
    return;
  }

  if (!linuxTray) {
    linuxTray = new Tray({ title: "GG" });
    linuxTray.on("tray-clicked", (event: unknown) => {
      const action = extractMenuAction(event);
      if (!action) {
        return;
      }
      handleShellAction(action);
    });
  }

  linuxTray.setMenu(buildLinuxTrayMenu(hostMenuState));
}

function updateHostMenuState(nextState: HostMenuState) {
  const hasChange =
    hostMenuState.canSave !== nextState.canSave ||
    hostMenuState.canExport !== nextState.canExport ||
    hostMenuState.isRecording !== nextState.isRecording ||
    hostMenuState.recordingURL !== nextState.recordingURL ||
    hostMenuState.locale !== nextState.locale ||
    hostMenuState.densityMode !== nextState.densityMode ||
    !studioShortcutOverridesEqual(hostMenuState.shortcutOverrides, nextState.shortcutOverrides);
  if (!hasChange) {
    return;
  }
  console.info(
    `[host-menu] state changed canSave=${nextState.canSave} canExport=${nextState.canExport} isRecording=${nextState.isRecording} recordingURL=${nextState.recordingURL ?? "null"} locale=${nextState.locale ?? "en-US"} density=${nextState.densityMode ?? "comfortable"}`,
  );
  hostMenuState = nextState;
  applyShellMenus();
}

function dispatchHostCommand(command: HostMenuCommand) {
  if (!mainWindow) {
    return;
  }

  try {
    const rpcClient = mainWindow.webview.rpc;
    rpcClient?.send.hostMenuCommand({ command });
  } catch (error) {
    console.warn("Failed to dispatch host menu command:", command, error);
  }
}

function dispatchReviewEvent(event: ReviewBridgeEvent) {
  if (!mainWindow) {
    return;
  }

  try {
    const payload = decodeUnknownWithSchemaSync(
      hostReviewEventMessageSchema,
      { event },
      "host review event",
    );
    mainWindow.webview.rpc?.send.hostReviewEvent(payload);
  } catch (error) {
    console.warn("Failed to dispatch review bridge event:", event.type, error);
  }
}

function handleShellAction(action: string) {
  routeMenuAction(action, {
    dispatchHostCommand,
    toggleDevTools: () => mainWindow?.webview.toggleDevTools(),
    openDocs: () => {
      void Utils.openExternal("https://github.com/okikeSolutions/guerillaglass");
    },
    quit: () => Utils.quit(),
  });
}

async function bootstrapApp() {
  hostRuntime = await createHostRuntime({
    sendCaptureStatus: (captureStatus) => {
      mainWindow?.webview.rpc?.send.hostCaptureStatus({ captureStatus });
    },
  });

  try {
    try {
      const initialProject = await hostRuntime.runPromise(
        Effect.flatMap(EngineTransport, (transport) => transport.projectCurrent),
      );
      currentProjectPath = initialProject.projectPath;
    } catch (error) {
      console.warn("Failed to load initial project state for file-access policy", error);
    }

    const rpc = BrowserView.defineRPC<DesktopBridgeRPC>({
      maxRequestTime: Infinity,
      handlers: {
        requests: createEngineBridgeHandlers({
          runtime: hostRuntime,
          pickPath,
          readTextFile,
          getCurrentProjectPath: () => currentProjectPath,
          setCurrentProjectPath: (projectPath) => {
            currentProjectPath = projectPath;
          },
          emitReviewEvent: dispatchReviewEvent,
        }),
        messages: {
          hostMenuState: (nextState: HostMenuState) => {
            updateHostMenuState({ ...hostMenuState, ...nextState });
          },
        },
      },
    });

    applyShellMenus();

    mainWindow = new BrowserWindow({
      title: "Guerillaglass",
      url: await getMainViewURL(),
      rpc,
      frame: {
        width: 1320,
        height: 860,
        x: 180,
        y: 100,
      },
    });

    setTimeout(() => {
      applyShellMenus();
    }, 500);

    Electrobun.events.on("application-menu-clicked", (event: unknown) => {
      const action = extractMenuAction(event);
      if (!action) {
        return;
      }
      handleShellAction(action);
    });

    mainWindow.on("close", async () => {
      try {
        await disposeHostShell();
      } finally {
        Utils.quit();
      }
    });

    mainWindow.on("focus", () => {
      applyShellMenus();
    });
  } catch (error) {
    try {
      await disposeHostShell();
    } catch (disposeError) {
      console.warn("Failed to dispose host runtime after bootstrap failure", disposeError);
    }
    throw error;
  }
}

await bootstrapApp();

console.log("Guerillaglass Electrobun shell started");
