import { BrowserWindow, Updater, Utils } from "electrobun/bun";
import { EngineClient } from "./engineClient";

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

async function getMainViewUrl(): Promise<string> {
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

const engineClient = new EngineClient();
await engineClient.start();

const mainWindow = new BrowserWindow({
  title: "Guerillaglass",
  url: await getMainViewUrl(),
  frame: {
    width: 1280,
    height: 820,
    x: 200,
    y: 120,
  },
});

mainWindow.webview.expose("ggEnginePing", async () => engineClient.ping());
mainWindow.webview.expose("ggEngineGetPermissions", async () => engineClient.getPermissions());
mainWindow.webview.expose("ggEngineListSources", async () => engineClient.listSources());
mainWindow.webview.expose("ggEngineCaptureStatus", async () => engineClient.captureStatus());

mainWindow.on("close", async () => {
  await engineClient.stop();
  Utils.quit();
});

console.log("Guerillaglass Electrobun shell started");
