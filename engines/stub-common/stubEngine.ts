import { createInterface } from "node:readline";

type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [key: string]: Json };

type Request = {
  id: string;
  method: string;
  params?: Record<string, Json>;
};

type Response =
  | {
      id: string;
      ok: true;
      result: Json;
    }
  | {
      id: string;
      ok: false;
      error: {
        code:
          | "invalid_request"
          | "invalid_params"
          | "unsupported_method"
          | "permission_denied"
          | "runtime_error";
        message: string;
      };
    };

type State = {
  isRunning: boolean;
  isRecording: boolean;
  recordingDurationSeconds: number;
  recordingURL: string | null;
  eventsURL: string | null;
  lastError: string | null;
  recordingStartedAt: number | null;
  projectPath: string | null;
  autoZoom: {
    isEnabled: boolean;
    intensity: number;
    minimumKeyframeInterval: number;
  };
  captureMetadata: {
    window: {
      id: number;
      title: string;
      appName: string;
    } | null;
    source: "display" | "window";
    contentRect: { x: number; y: number; width: number; height: number };
    pixelScale: number;
  } | null;
  recentProjects: Array<{
    projectPath: string;
    displayName: string;
    lastOpenedAt: string;
  }>;
};

const state: State = {
  isRunning: false,
  isRecording: false,
  recordingDurationSeconds: 0,
  recordingURL: null,
  eventsURL: null,
  lastError: null,
  recordingStartedAt: null,
  projectPath: null,
  autoZoom: {
    isEnabled: false,
    intensity: 0.55,
    minimumKeyframeInterval: 0.15,
  },
  captureMetadata: null,
  recentProjects: [],
};

function statusResult(): Json {
  const now = Date.now();
  const activeDuration =
    state.isRecording && state.recordingStartedAt != null
      ? (now - state.recordingStartedAt) / 1000
      : 0;

  return {
    isRunning: state.isRunning,
    isRecording: state.isRecording,
    recordingDurationSeconds: state.recordingDurationSeconds + activeDuration,
    recordingURL: state.recordingURL,
    captureMetadata: state.captureMetadata,
    lastError: state.lastError,
    eventsURL: state.eventsURL,
    telemetry: {
      totalFrames: 0,
      droppedFrames: 0,
      droppedFramePercent: 0,
      audioLevelDbfs: null,
      health: "good",
      healthReason: null,
    },
  };
}

function projectState(): Json {
  return {
    projectPath: state.projectPath,
    recordingURL: state.recordingURL,
    eventsURL: state.eventsURL,
    autoZoom: state.autoZoom,
    captureMetadata: state.captureMetadata,
  };
}

function recordRecentProject(projectPath: string): void {
  const normalizedPath = projectPath.trim();
  if (!normalizedPath) {
    return;
  }
  const displayName =
    normalizedPath.split(/[\\/]/).pop()?.replace(/\.gglassproj$/i, "") || normalizedPath;
  state.recentProjects = [
    {
      projectPath: normalizedPath,
      displayName,
      lastOpenedAt: new Date().toISOString(),
    },
    ...state.recentProjects.filter((item) => item.projectPath !== normalizedPath),
  ].slice(0, 20);
}

function success(id: string, result: Json): Response {
  return { id, ok: true, result };
}

function failure(
  id: string,
  code: Response extends { ok: false; error: { code: infer C } } ? C : never,
  message: string,
): Response {
  return {
    id,
    ok: false,
    error: { code, message },
  };
}

function writeResponse(response: Response): void {
  process.stdout.write(`${JSON.stringify(response)}\n`);
}

function handleRequest(platform: string, request: Request): Response {
  const params = request.params ?? {};

  switch (request.method) {
    case "system.ping":
      return success(request.id, {
        app: "guerillaglass",
        engineVersion: "0.1.0-stub",
        protocolVersion: "2",
        platform,
      });

    case "engine.capabilities":
      return success(request.id, {
        protocolVersion: "2",
        platform,
        phase: "stub",
        capture: {
          display: true,
          window: true,
          systemAudio: false,
          microphone: true,
        },
        recording: {
          inputTracking: true,
        },
        export: {
          presets: true,
        },
        project: {
          openSave: true,
        },
      });

    case "permissions.get":
      return success(request.id, {
        screenRecordingGranted: true,
        microphoneGranted: true,
        inputMonitoring: "authorized",
      });

    case "permissions.requestScreenRecording":
    case "permissions.requestMicrophone":
    case "permissions.requestInputMonitoring":
    case "permissions.openInputMonitoringSettings":
      return success(request.id, {
        success: true,
        message: "Stub engine: simulated success.",
      });

    case "sources.list":
      return success(request.id, {
        displays: [{ id: 1, width: 1920, height: 1080 }],
        windows: [
          {
            id: 101,
            title: "Stub Window",
            appName: "StubApp",
            width: 1280,
            height: 720,
            isOnScreen: true,
          },
        ],
      });

    case "capture.startDisplay":
      state.isRunning = true;
      state.lastError = null;
      state.captureMetadata = {
        window: null,
        source: "display",
        contentRect: { x: 0, y: 0, width: 1920, height: 1080 },
        pixelScale: 1,
      };
      return success(request.id, statusResult());

    case "capture.startCurrentWindow":
      state.isRunning = true;
      state.lastError = null;
      state.captureMetadata = {
        window: {
          id: 101,
          title: "Stub Window",
          appName: "StubApp",
        },
        source: "window",
        contentRect: { x: 0, y: 0, width: 1280, height: 720 },
        pixelScale: 1,
      };
      return success(request.id, statusResult());

    case "capture.startWindow": {
      const requestedWindowId =
        typeof params.windowId === "number" && Number.isFinite(params.windowId)
          ? Math.max(0, Math.floor(params.windowId))
          : 101;
      state.isRunning = true;
      state.lastError = null;
      state.captureMetadata = {
        window: {
          id: requestedWindowId,
          title: "Stub Window",
          appName: "StubApp",
        },
        source: "window",
        contentRect: { x: 0, y: 0, width: 1280, height: 720 },
        pixelScale: 1,
      };
      return success(request.id, statusResult());
    }

    case "capture.stop":
      if (state.isRecording && state.recordingStartedAt != null) {
        state.recordingDurationSeconds += (Date.now() - state.recordingStartedAt) / 1000;
      }
      state.recordingStartedAt = null;
      state.isRecording = false;
      state.isRunning = false;
      return success(request.id, statusResult());

    case "recording.start":
      if (!state.isRunning) {
        return failure(request.id, "invalid_params", "Start capture before recording.");
      }
      state.isRecording = true;
      state.recordingStartedAt = Date.now();
      state.recordingURL = "stub://recordings/session.mp4";
      state.eventsURL = params.trackInputEvents === true ? "stub://events/session-events.json" : null;
      state.lastError = null;
      return success(request.id, statusResult());

    case "recording.stop":
      if (state.isRecording && state.recordingStartedAt != null) {
        state.recordingDurationSeconds += (Date.now() - state.recordingStartedAt) / 1000;
      }
      state.recordingStartedAt = null;
      state.isRecording = false;
      return success(request.id, statusResult());

    case "capture.status":
      return success(request.id, statusResult());

    case "export.info":
      return success(request.id, {
        presets: [
          {
            id: "stub-1080p30",
            name: "Stub 1080p 30",
            width: 1920,
            height: 1080,
            fps: 30,
            fileType: "mp4",
          },
        ],
      });

    case "export.run": {
      const outputURL = typeof params.outputURL === "string" ? params.outputURL : "";
      if (!outputURL) {
        return failure(request.id, "invalid_params", "outputURL is required");
      }
      return success(request.id, { outputURL });
    }

    case "project.current":
      return success(request.id, projectState());

    case "project.open": {
      const projectPath = typeof params.projectPath === "string" ? params.projectPath : "";
      if (!projectPath) {
        return failure(request.id, "invalid_params", "projectPath is required");
      }
      state.projectPath = projectPath;
      recordRecentProject(projectPath);
      return success(request.id, projectState());
    }

    case "project.save": {
      const projectPath = typeof params.projectPath === "string" ? params.projectPath : null;
      if (projectPath) {
        state.projectPath = projectPath;
        recordRecentProject(projectPath);
      }
      const autoZoom = params.autoZoom;
      if (autoZoom && typeof autoZoom === "object" && !Array.isArray(autoZoom)) {
        const cast = autoZoom as {
          isEnabled?: boolean;
          intensity?: number;
          minimumKeyframeInterval?: number;
        };
        state.autoZoom = {
          isEnabled: cast.isEnabled ?? state.autoZoom.isEnabled,
          intensity: cast.intensity ?? state.autoZoom.intensity,
          minimumKeyframeInterval:
            cast.minimumKeyframeInterval ?? state.autoZoom.minimumKeyframeInterval,
        };
      }
      return success(request.id, projectState());
    }

    case "project.recents": {
      const requestedLimit = typeof params.limit === "number" ? Math.floor(params.limit) : 10;
      const limit = Math.min(Math.max(requestedLimit, 1), 100);
      return success(request.id, { items: state.recentProjects.slice(0, limit) });
    }

    default:
      return failure(request.id, "unsupported_method", `Unsupported method: ${request.method}`);
  }
}

export function runStubEngine(platform: string): void {
  const rl = createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
  });

  rl.on("line", (line) => {
    const raw = line.trim();
    if (!raw) {
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      writeResponse(failure("unknown", "invalid_request", "Invalid JSON"));
      return;
    }

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("id" in parsed) ||
      !("method" in parsed) ||
      typeof (parsed as { id?: unknown }).id !== "string" ||
      typeof (parsed as { method?: unknown }).method !== "string"
    ) {
      writeResponse(failure("unknown", "invalid_request", "Malformed request envelope"));
      return;
    }

    const request = parsed as Request;
    writeResponse(handleRequest(platform, request));
  });
}
