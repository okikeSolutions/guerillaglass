import { isoDateTimeSchema } from "@guerillaglass/engine-contract/schema-primitives";
import { CaptureService } from "@guerillaglass/engine-client/services/CaptureService";
import { Effect, Layer } from "effect";
import { beforeEach, describe, expect, test } from "vitest";
import {
  reviewAuthTokenSchema,
  reviewIdSchema,
  timelineSegmentIdSchema,
} from "@guerillaglass/engine-contract/schema-primitives";
import {
  defaultBackgroundFramingSettings,
  timelineDocumentSchema,
} from "@guerillaglass/engine-contract/shared/valueObjects";
import {
  desktopApi,
  engineApi,
  parseInputEventLog,
  sendHostMenuState,
  sendHostStudioDiagnostics,
} from "@lib/engine";
import {
  createBunBridgeHandlers,
  createWindowBridgeBindings,
} from "@shared/bridge/desktopBridgeBindings";
import type {
  BridgeRequestHandlerMap,
  BridgeRequestInvoker,
} from "@shared/bridge/desktopBridgeContract";
import {
  BridgeUnavailableError,
  CaptureWindowPickerUnsupportedError,
  StudioActionError,
  MediaServerError,
} from "@shared/errors/desktopErrors";
import { ContractDecodeError, EngineResponseError } from "@guerillaglass/engine-client/errors";
import { AgentService } from "@guerillaglass/engine-client/services/AgentService";
import { ExportService } from "@guerillaglass/engine-client/services/ExportService";
import { PermissionsService } from "@guerillaglass/engine-client/services/PermissionsService";
import { ProjectService } from "@guerillaglass/engine-client/services/ProjectService";
import { RecordingService } from "@guerillaglass/engine-client/services/RecordingService";
import { SourcesService } from "@guerillaglass/engine-client/services/SourcesService";
import { SystemService } from "@guerillaglass/engine-client/services/SystemService";
import { createEngineBridgeHandlers } from "../src/bun/bridge/requestHandlers";
import { MediaSourceService } from "../src/bun/media/service";
import { makeLayerReviewGateway } from "../src/bun/review/service";
import { makeDesktopAppRuntime } from "../src/bun/app/AppRuntime";
import { DesktopShell } from "../src/bun/shell/DesktopShell";
import { ProjectSession } from "../src/bun/session/ProjectSession";
import { DesktopTempDirectory } from "../src/bun/security/DesktopTempDirectory";

const captureTelemetryFixture = {
  sourceDroppedFrames: 0,
  writerDroppedFrames: 0,
  writerBackpressureDrops: 0,
  achievedFps: 0,
  captureCallbackMs: 0,
  recordQueueLagMs: 0,
  writerAppendMs: 0,
  previewEncodeMs: 0,
};

function makeCaptureStatus(overrides: Partial<Record<string, unknown>> = {}) {
  const isRunning = overrides.isRunning === true;
  return {
    isRunning,
    isRecording: false,
    ...(isRunning ? { captureSessionId: "capture-session-1" } : {}),
    recordingDurationSeconds: 0,
    telemetry: { ...captureTelemetryFixture },
    ...overrides,
  };
}

function installWindowBridge(
  overrides: Partial<Record<keyof BridgeRequestHandlerMap, (params: unknown) => Promise<unknown>>>,
) {
  const rawHandlers = new Proxy(
    {},
    {
      get: (_target, property: string) => {
        const override = overrides[property as keyof typeof overrides];
        if (override) {
          return override;
        }
        return async () => {
          throw new Error(`Unhandled bridge request in test: ${property}`);
        };
      },
    },
  ) as BridgeRequestHandlerMap;
  const bunHandlers = createBunBridgeHandlers(rawHandlers);
  const invoke: BridgeRequestInvoker = (name, params) =>
    (bunHandlers[name] as (value: unknown) => Promise<unknown>)(params) as Promise<never>;
  const bindings = createWindowBridgeBindings(
    invoke,
    () => {},
    () => {},
  );
  installRendererWindow(bindings);
  return bindings;
}

function installRendererWindow(value: object) {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value,
    writable: true,
  });
}

beforeEach(() => {
  Reflect.deleteProperty(globalThis, "window");
});

describe("renderer engine bridge", () => {
  test("throws a clear error when bridge is missing", async () => {
    installRendererWindow({});
    try {
      await engineApi.ping();
      throw new Error("Expected ping to fail when bridge is missing");
    } catch (error) {
      expect(error).toBeInstanceOf(BridgeUnavailableError);
      expect(error).toMatchObject({ bridge: "ggEnginePing" });
    }
  });

  test("strips renderer-supplied transcript paths from Agent requests", async () => {
    let received: unknown;
    const bindings = installWindowBridge({
      ggEngineAgentPreflight: async (params) => {
        received = params;
        return {
          ready: false,
          blockingReasons: ["missing_imported_transcript"],
          canApplyDestructive: false,
          transcriptionProvider: "imported_transcript",
        };
      },
    });

    await (bindings.ggEngineAgentPreflight as (params: unknown) => Promise<unknown>)({
      runtimeBudgetMinutes: 10,
      transcriptionProvider: "imported_transcript",
      importedTranscriptPath: "/tmp/untrusted.json",
    });

    expect(received).toEqual({
      runtimeBudgetMinutes: 10,
      transcriptionProvider: "imported_transcript",
    });
  });

  test("parses parity command payloads", async () => {
    let lastMenuState: unknown;
    let lastStudioDiagnostics: unknown;
    const lastStartDisplayCaptureCall = {
      called: false,
      enableMic: false,
      captureFps: 0,
      displayId: undefined as number | undefined,
      enablePreview: true,
    };
    installRendererWindow({
      ggEnginePing: async () => ({
        app: "guerillaglass",
        engineVersion: "0.2.0",
        protocolVersion: "2",
        platform: "macOS",
      }),
      ggEngineCapabilities: async () => ({
        protocolVersion: "2",
        platform: "macos",
        phase: "native",
        capture: { display: true, window: true, systemAudio: true, microphone: true },
        recording: { inputTracking: true },
        export: { presets: true, cutPlan: true, backgroundFraming: true },
        project: { openSave: true },
      }),
      ggEngineGetPermissions: async () => ({
        screenRecordingGranted: true,
        microphoneGranted: false,
        inputMonitoring: "granted",
      }),
      ggEngineRequestScreenRecordingPermission: async () => ({
        success: true,
      }),
      ggEngineRequestMicrophonePermission: async () => ({
        success: true,
      }),
      ggEngineRequestInputMonitoringPermission: async () => ({
        success: true,
      }),
      ggEngineOpenInputMonitoringSettings: async () => ({
        success: true,
      }),
      ggEngineListSources: async () => ({
        displays: [
          {
            id: 1,
            displayName: "Built-in Display",
            isPrimary: true,
            width: 3024,
            height: 1964,
            pixelScale: 1,
            refreshHz: 120,
            supportedCaptureFrameRates: [24, 30, 60, 120],
          },
        ],
        windows: [
          {
            id: 12,
            title: "Demo",
            appName: "Xcode",
            width: 800,
            height: 600,
            isOnScreen: true,
            pixelScale: 1,
            refreshHz: 60,
            supportedCaptureFrameRates: [24, 30, 60],
          },
        ],
      }),
      ggEngineCaptureStatus: async () => ({
        ...makeCaptureStatus(),
      }),
      ggEngineExportInfo: async () => ({
        presets: [
          {
            id: "h264-1080p-30",
            name: "1080p 30fps",
            width: 1920,
            height: 1080,
            fps: 30,
            fileType: "mp4",
          },
        ],
      }),
      ggEngineProjectCurrent: async () => ({
        autoZoom: {
          isEnabled: true,
          intensity: 1,
          minimumKeyframeInterval: 1 / 30,
        },
        backgroundFraming: defaultBackgroundFramingSettings,
        timeline: { version: 2, items: [] },
      }),
      ggEngineStartDisplayCapture: async (
        enableMic: boolean,
        captureFps: number,
        displayId?: number,
        enablePreview = true,
      ) => {
        lastStartDisplayCaptureCall.called = true;
        lastStartDisplayCaptureCall.enableMic = enableMic;
        lastStartDisplayCaptureCall.captureFps = captureFps;
        lastStartDisplayCaptureCall.displayId = displayId;
        lastStartDisplayCaptureCall.enablePreview = enablePreview;
        return {
          ...makeCaptureStatus({ isRunning: true }),
        };
      },
      ggEngineStartCurrentWindowCapture: async () => ({
        ...makeCaptureStatus({ isRunning: true }),
      }),
      ggEngineStartWindowCapture: async () => ({
        ...makeCaptureStatus({ isRunning: true }),
      }),
      ggEngineStopCapture: async () => ({
        ...makeCaptureStatus({ isRunning: false }),
      }),
      ggEngineStartRecording: async () => ({
        ...makeCaptureStatus({ isRunning: true, isRecording: true }),
      }),
      ggEngineStopRecording: async () => ({
        ...makeCaptureStatus({ isRunning: true, isRecording: false }),
      }),
      ggEngineRunExport: async () => ({
        jobId: "export-job-1",
        status: "succeeded",
        outputURL: "/tmp/out.mp4",
      }),
      ggEngineProjectOpen: async () => ({
        projectPath: "/tmp/project.gglassproj",
        recordingURL: "/tmp/project.gglassproj/recording.mov",
        autoZoom: {
          isEnabled: true,
          intensity: 1,
          minimumKeyframeInterval: 1 / 30,
        },
        backgroundFraming: defaultBackgroundFramingSettings,
        timeline: { version: 2, items: [] },
      }),
      ggEngineProjectSave: async () => ({
        projectPath: "/tmp/project.gglassproj",
        recordingURL: "/tmp/project.gglassproj/recording.mov",
        autoZoom: {
          isEnabled: true,
          intensity: 1,
          minimumKeyframeInterval: 1 / 30,
        },
        backgroundFraming: defaultBackgroundFramingSettings,
        timeline: { version: 2, items: [] },
      }),
      ggEngineProjectRecents: async () => ({
        items: [
          {
            projectPath: "/tmp/project.gglassproj",
            displayName: "project",
            lastOpenedAt: "2026-02-19T10:00:00.000Z",
          },
        ],
      }),
      ggPickPath: async ({ mode }: { mode: string }) =>
        mode === "saveProjectAs" ? "/tmp/alpha.gglassproj" : "/tmp",
      ggReadTextFile: async () =>
        JSON.stringify({
          schemaVersion: 1,
          events: [
            {
              type: "cursorMoved",
              timestamp: 0.15,
              position: { x: 100, y: 120 },
            },
          ],
        }),
      ggGrantMediaSourceCapability: async () => "media-capability-token",
      ggResolveMediaSourceURL: async () => "media://token",
      ggGrantCapturePreviewCapability: async () => "capture-capability-token",
      ggResolveCapturePreviewURL: async () => "http://127.0.0.1:42424/media/preview-token",
      ggHostSendMenuState: (state: unknown) => {
        lastMenuState = state;
      },
      ggHostSendStudioDiagnostics: (entry: unknown) => {
        lastStudioDiagnostics = entry;
      },
    });

    const ping = await engineApi.ping();
    const capabilities = await engineApi.capabilities();
    const permissions = await engineApi.getPermissions();
    const requestedScreenPermission = await engineApi.requestScreenRecordingPermission();
    const requestedMicPermission = await engineApi.requestMicrophonePermission();
    const requestedInputPermission = await engineApi.requestInputMonitoringPermission();
    const openedInputMonitoringSettings = await engineApi.openInputMonitoringSettings();
    const sources = await engineApi.listSources();
    const capture = await engineApi.captureStatus();
    const exportInfo = await engineApi.exportInfo();
    const project = await engineApi.projectCurrent();
    const started = await engineApi.startDisplayCapture(true, 30, 1);
    const startedWithoutPreview = await engineApi.startDisplayCapture(false, 30, 1, false);
    const startedCurrentWindow = await engineApi.startCurrentWindowCapture(true);
    const startedWindow = await engineApi.startWindowCapture(12, true);
    const recording = await engineApi.startRecording(true);
    const stoppedRecording = await engineApi.stopRecording();
    const stoppedCapture = await engineApi.stopCapture();
    const exportResult = await engineApi.runExport({
      outputURL: "/tmp/out.mp4",
      presetId: "h264-1080p-30",
      trimStartSeconds: 0,
      trimEndSeconds: 10,
    });
    const openedProject = await engineApi.projectOpen("/tmp/project.gglassproj");
    const savedProject = await engineApi.projectSave({ projectPath: "/tmp/project.gglassproj" });
    const recentProjects = await engineApi.projectRecents(5);
    const picked = await desktopApi.pickPath({ mode: "export" });
    const eventsRaw = await desktopApi.readTextFile("/tmp/events.json");
    const mediaSourceURL = await desktopApi.resolveMediaSourceURL("/tmp/out.mp4");
    const capturePreviewURL = await desktopApi.resolveCapturePreviewURL("capture-session-1");
    sendHostMenuState({
      canSave: true,
      canExport: true,
      canTrimTimeline: true,
      canToggleTimeline: true,
      isRecording: false,
      locale: "en-US",
      densityMode: "comfortable",
    });
    sendHostStudioDiagnostics({
      source: "renderer",
      level: "INFO",
      message: "renderer diagnostics enabled",
      timestamp: isoDateTimeSchema.make("2026-04-10T15:00:00.000Z"),
      annotations: {
        route: "/edit",
      },
    });
    const events = parseInputEventLog(eventsRaw);

    expect(ping.protocolVersion).toBe("2");
    expect(capabilities.export.backgroundFraming).toBe(true);
    expect(permissions.inputMonitoring).toBe("granted");
    expect(requestedScreenPermission.success).toBe(true);
    expect(requestedMicPermission.success).toBe(true);
    expect(requestedInputPermission.success).toBe(true);
    expect(openedInputMonitoringSettings.success).toBe(true);
    expect(sources.displays.length).toBe(1);
    expect(sources.displays[0]?.displayName).toBe("Built-in Display");
    expect(sources.displays[0]?.isPrimary).toBe(true);
    expect(sources.displays[0]?.supportedCaptureFrameRates).toEqual([24, 30, 60, 120]);
    expect(sources.displays[0]?.pixelScale).toBe(1);
    expect(sources.windows[0]?.refreshHz).toBe(60);
    expect(sources.windows[0]?.pixelScale).toBe(1);
    expect(capture.captureSessionId).toBeUndefined();
    expect(capture.eventsURL).toBeUndefined();
    expect(exportInfo.presets[0]?.id).toBe("h264-1080p-30");
    expect(project.autoZoom.isEnabled).toBe(true);
    expect(started.isRunning).toBe(true);
    expect(startedWithoutPreview.isRunning).toBe(true);
    expect(lastStartDisplayCaptureCall.called).toBe(true);
    expect(lastStartDisplayCaptureCall.enableMic).toBe(false);
    expect(lastStartDisplayCaptureCall.captureFps).toBe(30);
    expect(lastStartDisplayCaptureCall.displayId).toBe(1);
    expect(lastStartDisplayCaptureCall.enablePreview).toBe(false);
    expect(started.captureSessionId).toBe("capture-session-1");
    expect(startedCurrentWindow.isRunning).toBe(true);
    expect(startedWindow.isRunning).toBe(true);
    expect(recording.isRecording).toBe(true);
    expect(stoppedRecording.isRecording).toBe(false);
    expect(stoppedCapture.isRunning).toBe(false);
    expect(stoppedCapture.captureSessionId).toBeUndefined();
    expect(exportResult.outputURL).toBe("/tmp/out.mp4");
    expect(openedProject.projectPath).toBe("/tmp/project.gglassproj");
    expect(savedProject.projectPath).toBe("/tmp/project.gglassproj");
    expect(recentProjects.items).toHaveLength(1);
    expect(picked).toBe("/tmp");
    expect(mediaSourceURL).toBe("media://token");
    expect(capturePreviewURL).toBe("http://127.0.0.1:42424/media/preview-token");
    expect(lastMenuState).toEqual({
      canSave: true,
      canExport: true,
      canTrimTimeline: true,
      canToggleTimeline: true,
      isRecording: false,
      locale: "en-US",
      densityMode: "comfortable",
    });
    expect(lastStudioDiagnostics).toEqual({
      source: "renderer",
      level: "INFO",
      message: "renderer diagnostics enabled",
      timestamp: isoDateTimeSchema.make("2026-04-10T15:00:00.000Z"),
      annotations: {
        route: "/edit",
      },
    });
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("cursorMoved");
  });

  test("normalizes unsupported window picker capture into a tagged renderer error", async () => {
    installWindowBridge({
      ggEngineStartWindowCapture: async () => {
        throw new EngineResponseError({
          code: "invalid_params",
          description: "windowId must be greater than 0 on macOS 13",
        });
      },
    });

    await expect(engineApi.startWindowCapture(0, true)).rejects.toBeInstanceOf(
      CaptureWindowPickerUnsupportedError,
    );
  });

  test("preserves Bun-side media errors across bridge serialization", async () => {
    installWindowBridge({
      ggGrantMediaSourceCapability: async () => "media-capability-token",
      ggResolveMediaSourceURL: async () => {
        throw new MediaServerError({
          code: "MEDIA_FILE_MISSING",
          description: "Media file could not be found.",
        });
      },
    });

    try {
      await desktopApi.resolveMediaSourceURL("/tmp/missing.mov");
      throw new Error("Expected media source resolution to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(MediaServerError);
      if (!(error instanceof MediaServerError)) {
        throw error;
      }
      expect(error.code).toBe("MEDIA_FILE_MISSING");
      expect(error.message).toBe("Media file could not be found.");
    }
  });

  test("rejects invalid capture preview URL payloads at the bridge contract boundary", async () => {
    installWindowBridge({
      ggGrantCapturePreviewCapability: async () => "capture-capability-token",
      ggResolveCapturePreviewURL: async () => "",
    });

    await expect(desktopApi.resolveCapturePreviewURL("capture-session-1")).rejects.toBeInstanceOf(
      ContractDecodeError,
    );
  });

  test("rejects invalid host path picker payloads at the bridge contract boundary", async () => {
    installWindowBridge({
      ggPickPath: async () => 42,
    });

    await expect(desktopApi.pickPath({ mode: "export" })).rejects.toBeInstanceOf(
      ContractDecodeError,
    );
  });

  test("rejects invalid text file payloads at the bridge contract boundary", async () => {
    installWindowBridge({
      ggReadTextFile: async () => 42,
    });

    await expect(desktopApi.readTextFile("/tmp/events.json")).rejects.toBeInstanceOf(
      ContractDecodeError,
    );
  });

  test("rejects invalid media source URL payloads at the bridge contract boundary", async () => {
    installWindowBridge({
      ggGrantMediaSourceCapability: async () => "media-capability-token",
      ggResolveMediaSourceURL: async () => "",
    });

    await expect(desktopApi.resolveMediaSourceURL("/tmp/out.mp4")).rejects.toBeInstanceOf(
      ContractDecodeError,
    );
  });

  test("preserves export timeline and background framing through renderer and Bun bridge validation", async () => {
    let capturedParams: unknown;
    installWindowBridge({
      ggEngineRunExport: async (params) => {
        capturedParams = params;
        return {
          jobId: "export-job-1",
          status: "succeeded",
          outputURL: "/tmp/out.mp4",
        };
      },
    });

    const timeline = timelineDocumentSchema.make({
      version: 2 as const,
      items: [
        {
          kind: "clip" as const,
          id: timelineSegmentIdSchema.make("clip-a"),
          sourceAssetId: "recording" as const,
          sourceStartSeconds: 0,
          sourceEndSeconds: 1,
        },
        {
          kind: "gap" as const,
          id: timelineSegmentIdSchema.make("gap-a"),
          durationSeconds: 0.5,
        },
      ],
    });

    await engineApi.runExport({
      outputURL: "/tmp/out.mp4",
      presetId: "h264-1080p-30",
      timeline,
      autoZoom: { isEnabled: true, intensity: 0.75, minimumKeyframeInterval: 1 / 30 },
      backgroundFraming: defaultBackgroundFramingSettings,
    });

    expect(capturedParams).toMatchObject({
      timeline,
      autoZoom: { isEnabled: true, intensity: 0.75, minimumKeyframeInterval: 1 / 30 },
      backgroundFraming: defaultBackgroundFramingSettings,
    });
  });

  test("rejects invalid export timeline payloads at the bridge boundary", async () => {
    installWindowBridge({
      ggEngineRunExport: async () => ({
        jobId: "export-job-1",
        status: "succeeded",
        outputURL: "/tmp/out.mp4",
      }),
    });

    await expect(
      engineApi.runExport({
        outputURL: "/tmp/out.mp4",
        presetId: "h264-1080p-30",
        timeline: {
          version: 2,
          items: [{ kind: "gap", id: "bad-gap", durationSeconds: Number.NaN }],
        } as never,
      }),
    ).rejects.toBeInstanceOf(ContractDecodeError);
  });

  test("rejects invalid engine ping payloads at the generic bridge boundary", async () => {
    const bindings = installWindowBridge({
      ggEnginePing: async () => ({
        protocolVersion: 2,
      }),
    });

    const ping = bindings.ggEnginePing as () => Promise<unknown>;
    await expect(ping()).rejects.toBeInstanceOf(ContractDecodeError);
  });

  test("rejects invalid review snapshot payloads at the generic bridge boundary", async () => {
    const bindings = installWindowBridge({
      ggReviewSessionSnapshot: async () => ({
        reviewId: "review-123",
      }),
    });

    const sessionSnapshot = bindings.ggReviewSessionSnapshot as (params: {
      authToken: string;
      reviewId: string;
    }) => Promise<unknown>;
    await expect(
      sessionSnapshot({
        authToken: "token",
        reviewId: "review-123",
      }),
    ).rejects.toBeInstanceOf(ContractDecodeError);
  });

  test("serializes tagged review bridge configuration failures", async () => {
    const runtime = await makeDesktopAppRuntime({
      desktopShellLayer: Layer.succeed(DesktopShell, {
        start: () => Effect.void,
        publishCaptureStatus: () => Effect.void,
        publishReviewEvent: () => Effect.void,
        dispose: Effect.void,
      }),
      enableCaptureStatusPolling: false,
      projectSessionLayer: Layer.mock(ProjectSession, {}),
      desktopTempDirectoryLayer: Layer.succeed(DesktopTempDirectory, { path: "/tmp" }),
      engineDomainServicesLayer: Layer.mergeAll(
        Layer.mock(CaptureService, {}),
        Layer.mock(AgentService, {}),
        Layer.mock(ExportService, {}),
        Layer.mock(PermissionsService, {}),
        Layer.mock(ProjectService, {}),
        Layer.mock(RecordingService, {}),
        Layer.mock(SourcesService, {}),
        Layer.mock(SystemService, {}),
      ),
      reviewGatewayLayer: makeLayerReviewGateway({ resolveConvexUrl: () => undefined }),
      mediaSourceServiceLayer: Layer.mock(MediaSourceService, {}),
    });

    try {
      const handlers = createEngineBridgeHandlers({ runtime });

      const response = await handlers.ggReviewSessionSnapshot({
        authToken: reviewAuthTokenSchema.make("token"),
        reviewId: reviewIdSchema.make("review-123"),
      });

      expect(response.ok).toBe(false);
      if (response.ok) {
        throw new Error("Expected review snapshot bridge request to fail");
      }
      expect(response.error.tag).toBe("ReviewBridgeError");
      expect(response.error.data?.code).toBe("REVIEW_BRIDGE_URL_MISSING");
    } finally {
      await runtime.dispose();
    }
  });

  test("sendHostMenuState is a no-op when host sender is not available", () => {
    installRendererWindow({});
    expect(() =>
      sendHostMenuState({
        canSave: false,
        canExport: false,
        canTrimTimeline: false,
        canToggleTimeline: false,
        isRecording: false,
      }),
    ).not.toThrow();
  });
});

test("localizes picker failures while preserving direct-window transport errors", async () => {
  installWindowBridge({
    ggEngineStartWindowCapture: async () => {
      throw new EngineResponseError({
        code: "invalid_request",
        description: "native diagnostic from an arbitrary locale",
      });
    },
  });
  const pickerFailure = await engineApi
    .startWindowCapture(0, false)
    .catch((error: unknown) => error);
  expect(pickerFailure).toBeInstanceOf(StudioActionError);
  expect(pickerFailure).toMatchObject({ reason: "window_selection_failed" });
  const { getStudioMessages } = await import("@shared/localization");
  const { mapStudioActionErrorMessage } = await import("@studio/hooks/core/useStudioController");
  const german = getStudioMessages("de-DE");
  expect(mapStudioActionErrorMessage(german, pickerFailure)).toBe(
    german.notices.windowSelectionFailed,
  );
  await expect(engineApi.startWindowCapture(42, false)).rejects.toBeInstanceOf(EngineResponseError);
  installWindowBridge({
    ggEngineStartWindowCapture: async () => {
      throw new EngineResponseError({
        code: "permission_denied",
        description: "microphone authorization denied",
      });
    },
  });
  const permissionFailure = await engineApi
    .startWindowCapture(0, true)
    .catch((error: unknown) => error);
  expect(permissionFailure).toMatchObject({ reason: "capture_permission_required" });
  expect(mapStudioActionErrorMessage(german, permissionFailure)).toBe(
    german.notices.capturePermissionRequired,
  );
  installWindowBridge({
    ggEngineStartWindowCapture: async () => {
      throw new EngineResponseError({
        code: "runtime_error",
        description: "stream failed after selection",
      });
    },
  });
  await expect(engineApi.startWindowCapture(0, false)).rejects.toBeInstanceOf(EngineResponseError);
});
