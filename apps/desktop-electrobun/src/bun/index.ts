import { BrowserView, BrowserWindow, Updater, Utils } from "electrobun/bun";
import type { AutoZoomSettings } from "@guerillaglass/engine-protocol";
import { EngineClient } from "./engineClient";
import type { DesktopBridgeRPC } from "../shared/bridgeRpc";

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
      ggEngineProjectCurrent: async () => engineClient.projectCurrent(),
      ggEngineProjectOpen: async ({ projectPath }: { projectPath: string }) =>
        engineClient.projectOpen(projectPath),
      ggEngineProjectSave: async (params: { projectPath?: string; autoZoom?: AutoZoomSettings }) =>
        engineClient.projectSave(params),
      ggPickDirectory: async ({ startingFolder }: { startingFolder?: string }) =>
        pickDirectory(startingFolder),
    },
    messages: {},
  },
});

const mainWindow = new BrowserWindow({
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

mainWindow.on("close", async () => {
  await engineClient.stop();
  Utils.quit();
});

console.log("Guerillaglass Electrobun shell started");
