import { BrowserWindow, Updater, Utils } from "electrobun/bun";
import type { AutoZoomSettings } from "@guerillaglass/engine-protocol";
import { EngineClient } from "./engineClient";

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

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

const engineClient = new EngineClient();
await engineClient.start();

const mainWindow = new BrowserWindow({
  title: "Guerillaglass",
  url: await getMainViewURL(),
  frame: {
    width: 1320,
    height: 860,
    x: 180,
    y: 100,
  },
});

mainWindow.webview.expose("ggEnginePing", async () => engineClient.ping());
mainWindow.webview.expose("ggEngineGetPermissions", async () => engineClient.getPermissions());
mainWindow.webview.expose(
  "ggEngineRequestScreenRecordingPermission",
  async () => engineClient.requestScreenRecordingPermission(),
);
mainWindow.webview.expose(
  "ggEngineRequestMicrophonePermission",
  async () => engineClient.requestMicrophonePermission(),
);
mainWindow.webview.expose(
  "ggEngineRequestInputMonitoringPermission",
  async () => engineClient.requestInputMonitoringPermission(),
);
mainWindow.webview.expose(
  "ggEngineOpenInputMonitoringSettings",
  async () => engineClient.openInputMonitoringSettings(),
);
mainWindow.webview.expose("ggEngineListSources", async () => engineClient.listSources());
mainWindow.webview.expose(
  "ggEngineStartDisplayCapture",
  async (enableMic: boolean) => engineClient.startDisplayCapture(enableMic),
);
mainWindow.webview.expose(
  "ggEngineStartWindowCapture",
  async (windowId: number, enableMic: boolean) => engineClient.startWindowCapture(windowId, enableMic),
);
mainWindow.webview.expose("ggEngineStopCapture", async () => engineClient.stopCapture());
mainWindow.webview.expose(
  "ggEngineStartRecording",
  async (trackInputEvents: boolean) => engineClient.startRecording(trackInputEvents),
);
mainWindow.webview.expose("ggEngineStopRecording", async () => engineClient.stopRecording());
mainWindow.webview.expose("ggEngineCaptureStatus", async () => engineClient.captureStatus());
mainWindow.webview.expose("ggEngineExportInfo", async () => engineClient.exportInfo());
mainWindow.webview.expose(
  "ggEngineRunExport",
  async (params: {
    outputURL: string;
    presetId: string;
    trimStartSeconds?: number;
    trimEndSeconds?: number;
  }) => engineClient.runExport(params),
);
mainWindow.webview.expose("ggEngineProjectCurrent", async () => engineClient.projectCurrent());
mainWindow.webview.expose("ggEngineProjectOpen", async (projectPath: string) => engineClient.projectOpen(projectPath));
mainWindow.webview.expose(
  "ggEngineProjectSave",
  async (params: { projectPath?: string; autoZoom?: AutoZoomSettings }) => engineClient.projectSave(params),
);
mainWindow.webview.expose("ggPickDirectory", async (startingFolder?: string) => pickDirectory(startingFolder));

mainWindow.on("close", async () => {
  await engineClient.stop();
  Utils.quit();
});

console.log("Guerillaglass Electrobun shell started");
