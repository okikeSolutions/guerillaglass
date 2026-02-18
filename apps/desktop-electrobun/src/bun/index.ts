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

type ExposedWebview = {
  expose: <TArgs extends unknown[], TResult>(
    name: string,
    handler: (...args: TArgs) => Promise<TResult> | TResult,
  ) => void;
};

const exposedWebview = mainWindow.webview as unknown as ExposedWebview;

exposedWebview.expose("ggEnginePing", async () => engineClient.ping());
exposedWebview.expose("ggEngineGetPermissions", async () => engineClient.getPermissions());
exposedWebview.expose("ggEngineRequestScreenRecordingPermission", async () =>
  engineClient.requestScreenRecordingPermission(),
);
exposedWebview.expose("ggEngineRequestMicrophonePermission", async () =>
  engineClient.requestMicrophonePermission(),
);
exposedWebview.expose("ggEngineRequestInputMonitoringPermission", async () =>
  engineClient.requestInputMonitoringPermission(),
);
exposedWebview.expose("ggEngineOpenInputMonitoringSettings", async () =>
  engineClient.openInputMonitoringSettings(),
);
exposedWebview.expose("ggEngineListSources", async () => engineClient.listSources());
exposedWebview.expose("ggEngineStartDisplayCapture", async (enableMic: boolean) =>
  engineClient.startDisplayCapture(enableMic),
);
exposedWebview.expose("ggEngineStartWindowCapture", async (windowId: number, enableMic: boolean) =>
  engineClient.startWindowCapture(windowId, enableMic),
);
exposedWebview.expose("ggEngineStopCapture", async () => engineClient.stopCapture());
exposedWebview.expose("ggEngineStartRecording", async (trackInputEvents: boolean) =>
  engineClient.startRecording(trackInputEvents),
);
exposedWebview.expose("ggEngineStopRecording", async () => engineClient.stopRecording());
exposedWebview.expose("ggEngineCaptureStatus", async () => engineClient.captureStatus());
exposedWebview.expose("ggEngineExportInfo", async () => engineClient.exportInfo());
exposedWebview.expose(
  "ggEngineRunExport",
  async (params: {
    outputURL: string;
    presetId: string;
    trimStartSeconds?: number;
    trimEndSeconds?: number;
  }) => engineClient.runExport(params),
);
exposedWebview.expose("ggEngineProjectCurrent", async () => engineClient.projectCurrent());
exposedWebview.expose("ggEngineProjectOpen", async (projectPath: string) =>
  engineClient.projectOpen(projectPath),
);
exposedWebview.expose(
  "ggEngineProjectSave",
  async (params: { projectPath?: string; autoZoom?: AutoZoomSettings }) =>
    engineClient.projectSave(params),
);
exposedWebview.expose("ggPickDirectory", async (startingFolder?: string) =>
  pickDirectory(startingFolder),
);

mainWindow.on("close", async () => {
  await engineClient.stop();
  Utils.quit();
});

console.log("Guerillaglass Electrobun shell started");
