import Electrobun, {
  ApplicationMenu,
  BrowserView,
  BrowserWindow,
  Tray,
  Updater,
  Utils,
} from "electrobun/bun";
import type { AutoZoomSettings } from "@guerillaglass/engine-protocol";
import { EngineClient } from "./engineClient";
import type { DesktopBridgeRPC, HostMenuCommand, HostMenuState } from "../shared/bridgeRpc";
import { extractMenuAction } from "./menu/actions";
import { buildApplicationMenu, buildLinuxTrayMenu } from "./menu/builders";
import { routeMenuAction } from "./menu/router";
import { readAllowedTextFile } from "./fileAccess";

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
await engineClient.start();
try {
  const initialProject = await engineClient.projectCurrent();
  currentProjectPath = initialProject.projectPath;
} catch (error) {
  console.warn("Failed to load initial project state for file-access policy", error);
}

const rpc = BrowserView.defineRPC<DesktopBridgeRPC>({
  handlers: {
    requests: {
      ggEnginePing: async () => engineClient.ping(),
      ggEngineGetPermissions: async () => engineClient.getPermissions(),
      ggEngineRequestScreenRecordingPermission: async () =>
        engineClient.requestScreenRecordingPermission(),
      ggEngineRequestMicrophonePermission: async () => engineClient.requestMicrophonePermission(),
      ggEngineRequestInputMonitoringPermission: async () =>
        engineClient.requestInputMonitoringPermission(),
      ggEngineOpenInputMonitoringSettings: async () => engineClient.openInputMonitoringSettings(),
      ggEngineListSources: async () => engineClient.listSources(),
      ggEngineStartDisplayCapture: async ({ enableMic }: { enableMic: boolean }) =>
        engineClient.startDisplayCapture(enableMic),
      ggEngineStartWindowCapture: async ({
        windowId,
        enableMic,
      }: {
        windowId: number;
        enableMic: boolean;
      }) => engineClient.startWindowCapture(windowId, enableMic),
      ggEngineStopCapture: async () => engineClient.stopCapture(),
      ggEngineStartRecording: async ({ trackInputEvents }: { trackInputEvents: boolean }) =>
        engineClient.startRecording(trackInputEvents),
      ggEngineStopRecording: async () => engineClient.stopRecording(),
      ggEngineCaptureStatus: async () => engineClient.captureStatus(),
      ggEngineExportInfo: async () => engineClient.exportInfo(),
      ggEngineRunExport: async (params: {
        outputURL: string;
        presetId: string;
        trimStartSeconds?: number;
        trimEndSeconds?: number;
      }) => engineClient.runExport(params),
      ggEngineProjectCurrent: async () => {
        const projectState = await engineClient.projectCurrent();
        currentProjectPath = projectState.projectPath;
        return projectState;
      },
      ggEngineProjectOpen: async ({ projectPath }: { projectPath: string }) =>
        engineClient.projectOpen(projectPath).then((projectState) => {
          currentProjectPath = projectState.projectPath;
          return projectState;
        }),
      ggEngineProjectSave: async (params: { projectPath?: string; autoZoom?: AutoZoomSettings }) =>
        engineClient.projectSave(params).then((projectState) => {
          currentProjectPath = projectState.projectPath;
          return projectState;
        }),
      ggEngineProjectRecents: async ({ limit }: { limit?: number }) =>
        engineClient.projectRecents(limit),
      ggPickDirectory: async ({ startingFolder }: { startingFolder?: string }) =>
        pickDirectory(startingFolder),
      ggReadTextFile: async ({ filePath }: { filePath: string }) => readTextFile(filePath),
    },
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
  await engineClient.stop();
  Utils.quit();
});

mainWindow.on("focus", () => {
  applyShellMenus();
});

console.log("Guerillaglass Electrobun shell started");
