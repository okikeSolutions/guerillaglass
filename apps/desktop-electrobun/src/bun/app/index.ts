import Electrobun, {
  ApplicationMenu,
  BrowserView,
  BrowserWindow,
  Tray,
  Updater,
  Utils,
} from "electrobun/bun";
import { Effect, Fiber } from "effect";
import { constants as fsConstants } from "node:fs";
import { access } from "node:fs/promises";
import type { CaptureStatusResult } from "@guerillaglass/engine-protocol";
import type { ReviewBridgeEvent } from "@guerillaglass/review-protocol";
import { decodeUnknownWithSchemaSync } from "@shared/errors";
import { EngineClient } from "../engine/client";
import {
  hostReviewEventMessageSchema,
  type DesktopBridgeRPC,
  type HostMenuCommand,
  type HostMenuState,
} from "@shared/bridge";
import { studioShortcutOverridesEqual } from "@shared/shortcuts";
import { extractMenuAction } from "../menu/actions";
import { buildApplicationMenu, buildLinuxTrayMenu } from "../menu/builders";
import { routeMenuAction } from "../menu/router";
import { readAllowedTextFile, resolveAllowedMediaFilePath } from "../security/fileAccess";
import { createEngineBridgeHandlers } from "../bridge/requestHandlers";
import { MediaServer } from "../media/server";
import { pickPathForMode } from "../path/picker";
import type { HostPathPickerMode } from "@shared/bridge";

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
let captureStatusStreamFiber: Fiber.RuntimeFiber<void, unknown> | null = null;

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
  const saveFileDialog = Utils.saveFileDialog;

  return await pickPathForMode(params.mode, {
    currentProjectPath,
    startingFolder: params.startingFolder,
    defaultFolder: defaultPickerFolder,
    // Keep dialog calls bound to Utils to avoid runtime method-context issues.
    openFileDialog: (options) => Utils.openFileDialog(options),
    saveFileDialog: saveFileDialog ? (options) => saveFileDialog(options) : undefined,
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

function captureStatusStreamInterval(status: CaptureStatusResult): number {
  if (status.isRecording) {
    return 250;
  }
  if (status.isRunning) {
    return 500;
  }
  return 1000;
}

function stopCaptureStatusStream() {
  const fiber = captureStatusStreamFiber;
  captureStatusStreamFiber = null;
  if (fiber) {
    void Effect.runFork(Fiber.interrupt(fiber));
  }
}

function captureStatusStreamEffect(initialDelayMs: number): Effect.Effect<void, unknown> {
  return Effect.gen(function* () {
    let nextDelay = Math.max(0, initialDelayMs);
    while (true) {
      if (nextDelay > 0) {
        yield* Effect.sleep(`${nextDelay} millis`);
      }
      if (!mainWindow) {
        nextDelay = 500;
        continue;
      }

      try {
        const captureStatus = yield* Effect.tryPromise({
          try: () => engineClient.captureStatus(),
          catch: (cause) => cause,
        });
        nextDelay = captureStatusStreamInterval(captureStatus);
        yield* Effect.sync(() => {
          mainWindow?.webview.rpc?.send.hostCaptureStatus({ captureStatus });
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        nextDelay = 1000;
        yield* Effect.sync(() => {
          console.warn(`capture status stream tick failed: ${message}`);
        });
      }
    }
  });
}

function startCaptureStatusStream(initialDelayMs = 0): void {
  stopCaptureStatusStream();
  captureStatusStreamFiber = Effect.runFork(captureStatusStreamEffect(initialDelayMs));
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
      pickPath,
      readTextFile,
      resolveMediaSourceURL,
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

startCaptureStatusStream(0);

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
  stopCaptureStatusStream();
  mainWindow = null;
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
