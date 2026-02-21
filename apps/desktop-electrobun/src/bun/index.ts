import Electrobun, {
  ApplicationMenu,
  BrowserView,
  BrowserWindow,
  Tray,
  Updater,
  Utils,
} from "electrobun/bun";
import { EngineClient } from "./engineClient";
import type { DesktopBridgeRPC, HostMenuCommand, HostMenuState } from "../shared/bridgeRpc";
import { extractMenuAction } from "./menu/actions";
import { buildApplicationMenu, buildLinuxTrayMenu } from "./menu/builders";
import { routeMenuAction } from "./menu/router";
import { readAllowedTextFile, resolveAllowedMediaFilePath } from "./fileAccess";
import { createEngineBridgeHandlers } from "./bridgeHandlers";
import { MediaServer } from "./mediaServer";

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;
type BunRPC = ReturnType<typeof BrowserView.defineRPC<DesktopBridgeRPC>>;

let mainWindow: BrowserWindow<BunRPC> | null = null;
let linuxTray: Tray | null = null;
let hostMenuState: HostMenuState = {
  canSave: false,
  canExport: false,
  isRecording: false,
  locale: "en-US",
  densityMode: "comfortable",
};
let currentProjectPath: string | null = null;

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

async function pickDirectory(startingFolder?: string): Promise<string | null> {
  const chosenPaths = await Utils.openFileDialog({
    startingFolder: startingFolder ?? Utils.paths.documents,
    canChooseFiles: false,
    canChooseDirectory: true,
    allowsMultipleSelection: false,
    allowedFileTypes: "*",
  });
  if (!Array.isArray(chosenPaths) || chosenPaths.length === 0) {
    return null;
  }
  return chosenPaths[0] ?? null;
}

async function readTextFile(filePath: string): Promise<string> {
  return await readAllowedTextFile(filePath, {
    currentProjectPath,
    tempDirectory: process.env.TMPDIR,
  });
}

async function resolveMediaSourceURL(filePath: string): Promise<string> {
  const allowedMediaPath = resolveAllowedMediaFilePath(filePath, {
    currentProjectPath,
    tempDirectory: process.env.TMPDIR,
  });
  return await mediaServer.resolveMediaSourceURL(allowedMediaPath);
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
    hostMenuState.locale !== nextState.locale ||
    hostMenuState.densityMode !== nextState.densityMode;
  if (!hasChange) {
    return;
  }
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

function handleShellAction(action: string) {
  routeMenuAction(action, {
    dispatchHostCommand,
    toggleDevTools: () => mainWindow?.webview.toggleDevTools(),
    openDocs: () => {
      void Utils.openExternal("https://github.com/okikio/guerillaglass");
    },
    quit: () => Utils.quit(),
  });
}

const engineClient = new EngineClient();
const mediaServer = new MediaServer();
await engineClient.start();
try {
  const initialProject = await engineClient.projectCurrent();
  currentProjectPath = initialProject.projectPath;
} catch (error) {
  console.warn("Failed to load initial project state for file-access policy", error);
}

const rpc = BrowserView.defineRPC<DesktopBridgeRPC>({
  maxRequestTime: Infinity,
  handlers: {
    requests: createEngineBridgeHandlers({
      engineClient,
      pickDirectory,
      readTextFile,
      resolveMediaSourceURL,
      setCurrentProjectPath: (projectPath) => {
        currentProjectPath = projectPath;
      },
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
  linuxTray?.remove();
  linuxTray = null;
  mediaServer.stop();
  await engineClient.stop();
  Utils.quit();
});

mainWindow.on("focus", () => {
  applyShellMenus();
});

console.log("Guerillaglass Electrobun shell started");
