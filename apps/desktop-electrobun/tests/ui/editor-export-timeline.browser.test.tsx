import { ReplacementConfirmation } from "../../src/mainview/app/studio/layout/ReplacementConfirmation";
import { studioShortcutDisplayTokens } from "../../src/shared/shortcuts";
import {
  defaultStudioLayoutState,
  saveStudioLayoutState,
} from "../../src/mainview/app/studio/contracts/studioLayoutModel";
import { act, useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HotkeysProvider } from "@tanstack/react-hotkeys";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { timelineSegmentIdSchema } from "@guerillaglass/engine-contract/schema-primitives";
import {
  defaultBackgroundFramingSettings,
  sceneCameraSchema,
  type TimelineDocument,
} from "@guerillaglass/engine-contract/shared/valueObjects";
import {
  exportRunPayloadSchema,
  projectSavePayloadSchema,
} from "@guerillaglass/engine-contract/httpApi";
import { decodeUnknownWithSchemaSync } from "@guerillaglass/engine-client/schemaContracts";
import {
  useStudioController,
  type StudioController,
} from "../../src/mainview/app/studio/hooks/core/useStudioController";
import type { StudioMode } from "../../src/mainview/app/studio/domain/inspectorSelectionModel";
import { studioQueryKeys } from "../../src/mainview/app/studio/hooks/core/useStudioDataQueries";
import { StudioProvider } from "../../src/mainview/app/studio/state/StudioProvider";
import { StudioPreferences } from "../../src/mainview/app/studio/layout/StudioShellHeader";
import { InspectorPanel } from "../../src/mainview/app/studio/panels/InspectorPanel";
import { CaptureRoute } from "../../src/mainview/app/studio/routes/CaptureRoute";
import { DeliverRoute } from "../../src/mainview/app/studio/routes/DeliverRoute";
import { ProgramPreview } from "../../src/mainview/app/studio/routes/ProgramPreview";
const healthyMediaSource = new URL("../fixtures/timeline-red.mp4", import.meta.url).href;
const staticCamera = decodeUnknownWithSchemaSync(
  sceneCameraSchema,
  [{ timeSeconds: 0, centerX: 0.5, centerY: 0.5, zoom: 1 }],
  "static scene camera fixture",
);

const initialTimeline: TimelineDocument = {
  version: 2,
  items: [
    {
      kind: "clip",
      id: timelineSegmentIdSchema.make("segment-0"),
      sourceAssetId: "recording",
      sourceStartSeconds: 0,
      sourceEndSeconds: 4,
    },
  ],
};

let root: Root | undefined;
let queryClient: QueryClient | undefined;
let latestStudio: StudioController | null = null;
let updateInspectorMode: ((mode: StudioMode) => void) | null = null;
let updatePreviewRoute: ((route: "capture" | "edit" | "deliver" | null) => void) | null = null;
let capturedExportParams: unknown = null;
let capturedSaveParams: unknown = null;
let replacementDecision: "discard" | "keep" | null = null;
let replacementPromptCount = 0;
let bridgeSnapshot = new Map<string, unknown>();

function reverseObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(reverseObjectKeys);
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .reverse()
      .map(([key, entry]) => [key, reverseObjectKeys(entry)]),
  );
}

function installMockBridge() {
  const bridgeWindow = window as unknown as Record<string, unknown>;
  bridgeWindow.ggEnginePing = async () => ({
    app: "guerillaglass-engine",
    engineVersion: "0.1.0",
    protocolVersion: "1.0.0",
    platform: "darwin",
  });
  bridgeWindow.ggEngineCapabilities = async () => ({
    protocolVersion: "1.0.0",
    phase: "native",
    platform: "macos",
    capture: { display: true, window: true, systemAudio: true, microphone: true },
    recording: { inputTracking: true },
    export: { presets: true, cutPlan: true, backgroundFraming: true },
    project: { openSave: true },
  });
  bridgeWindow.ggEngineGetPermissions = async () => ({
    screenRecordingGranted: true,
    microphoneGranted: true,
    inputMonitoring: "granted",
  });
  bridgeWindow.ggEngineRequestScreenRecordingPermission = async () => ({ success: true });
  bridgeWindow.ggEngineRequestMicrophonePermission = async () => ({ success: true });
  bridgeWindow.ggEngineRequestInputMonitoringPermission = async () => ({ success: true });
  bridgeWindow.ggEngineOpenInputMonitoringSettings = async () => ({ success: true });
  bridgeWindow.ggEngineListSources = async () => ({ displays: [], windows: [] });
  const idleCaptureStatus = {
    isRunning: false,
    isRecording: false,
    recordingDurationSeconds: 4,
    recordingURL: "/tmp/recording.mov",
    telemetry: {},
  };
  bridgeWindow.ggEngineCaptureStatus = async () => idleCaptureStatus;
  bridgeWindow.ggEngineStopCapture = async () => idleCaptureStatus;
  bridgeWindow.ggEngineStartDisplayCapture = async () => ({
    ...idleCaptureStatus,
    isRunning: true,
  });
  bridgeWindow.ggEngineStartWindowCapture = async () => ({ ...idleCaptureStatus, isRunning: true });
  bridgeWindow.ggEngineStartCurrentWindowCapture = async () => ({
    ...idleCaptureStatus,
    isRunning: true,
  });
  bridgeWindow.ggEngineCapturePreviewFrame = async () => ({});
  bridgeWindow.ggEngineExportInfo = async () => ({
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
  });
  bridgeWindow.ggEngineProjectCurrent = async () => ({
    projectPath: "/tmp/project.gglassproj",
    recordingURL: "/tmp/recording.mov",
    autoZoom: { isEnabled: true, intensity: 1, minimumKeyframeInterval: 1 / 30 },
    backgroundFraming: defaultBackgroundFramingSettings,
    timeline: initialTimeline,
  });
  bridgeWindow.ggEngineProjectSave = async (params: unknown) => {
    capturedSaveParams = params;
    const saved = decodeUnknownWithSchemaSync(
      projectSavePayloadSchema,
      params,
      "saved editor document",
    );
    return {
      projectPath: saved.projectPath ?? "/tmp/project.gglassproj",
      recordingURL: "/tmp/recording.mov",
      autoZoom: saved.autoZoom,
      backgroundFraming: saved.backgroundFraming,
      timeline: saved.timeline,
    };
  };
  bridgeWindow.ggEngineProjectRecents = async () => ({ items: [] });
  bridgeWindow.ggEngineRunExport = async (params: unknown) => {
    capturedExportParams = params;
    return {
      jobId: "export-job-1",
      status: "succeeded",
      outputURL: "/tmp/guerillaglass-export.mp4",
    };
  };
  bridgeWindow.ggPickPath = async () => "/tmp";
  bridgeWindow.ggReadTextFile = async () => "";
  bridgeWindow.ggGrantMediaSourceCapability = async () => "media-token";
  bridgeWindow.ggResolveMediaSourceURL = async () => "http://127.0.0.1:42424/media/recording";
  bridgeWindow.ggGrantCapturePreviewCapability = async () => "preview-token";
  bridgeWindow.ggResolveCapturePreviewURL = async () => null;
  bridgeWindow.ggHostSendMenuState = () => {};
  bridgeWindow.ggHostSendStudioDiagnostics = () => {};
}

function currentStudio(): StudioController {
  if (!latestStudio) {
    throw new Error("Studio controller has not mounted");
  }
  return latestStudio;
}

function currentTimelineClip(index: number) {
  const item = currentStudio().timelineDocument.items[index];
  if (!item || item.kind !== "clip") {
    throw new Error(`Expected timeline item ${index} to be a clip`);
  }
  return item;
}

function currentTimelineGap(index: number) {
  const item = currentStudio().timelineDocument.items[index];
  if (!item || item.kind !== "gap") {
    throw new Error(`Expected timeline item ${index} to be a gap`);
  }
  return item;
}

function capturedExportTimeline(): TimelineDocument {
  const payload = decodeUnknownWithSchemaSync(
    exportRunPayloadSchema,
    capturedExportParams,
    "captured export payload",
  );
  if (!payload.timeline) {
    throw new Error("Export payload omitted its timeline");
  }
  return payload.timeline;
}

function StudioHarness({ onStudio }: { onStudio: (studio: StudioController) => void }) {
  const studio = useStudioController();
  const [mode, setMode] = useState<StudioMode>("deliver");
  const [previewRoute, setPreviewRoute] = useState<"capture" | "edit" | "deliver" | null>(null);
  useEffect(() => {
    updatePreviewRoute = setPreviewRoute;
    return () => {
      updatePreviewRoute = null;
    };
  }, []);
  useEffect(() => {
    onStudio(studio);
  }, [onStudio, studio]);
  useEffect(() => {
    updateInspectorMode = setMode;
    return () => {
      updateInspectorMode = null;
    };
  }, []);
  return (
    <StudioProvider value={studio}>
      <ReplacementConfirmation />
      <div style={{ height: 800, display: "flex", flexDirection: "column" }}>
        <StudioPreferences />
        {previewRoute === "capture" ? (
          <CaptureRoute />
        ) : previewRoute === "deliver" ? (
          <DeliverRoute />
        ) : previewRoute === "edit" ? (
          <ProgramPreview />
        ) : (
          <InspectorPanel mode={mode} />
        )}
      </div>
    </StudioProvider>
  );
}

function waitFor(assertion: () => void, timeoutMs = 2000): Promise<void> {
  const started = performance.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      try {
        assertion();
        resolve();
      } catch (error) {
        if (performance.now() - started > timeoutMs) {
          reject(error);
          return;
        }
        window.setTimeout(tick, 20);
      }
    };
    tick();
  });
}

async function decideReplacement(decision: "discard" | "keep") {
  const dialog = page.getByTestId("replacement-confirmation");
  await expect.element(dialog).toBeVisible();
  replacementPromptCount += 1;
  await expect
    .element(dialog.getByRole("button", { name: "Keep editing", exact: true }))
    .toHaveFocus();
  const label =
    decision === "keep"
      ? "Keep editing"
      : currentStudio().replacementConfirmation.kind === "recording"
        ? "Start new recording"
        : "Discard edits and open";
  await dialog.getByRole("button", { name: label, exact: true }).click();
}

async function applyStudioAction(action: (studio: StudioController) => void | Promise<unknown>) {
  let pending: Promise<unknown> = Promise.resolve();
  let settled = false;
  await act(async () => {
    if (!latestStudio) {
      throw new Error("Studio controller has not rendered.");
    }
    pending = Promise.resolve(action(latestStudio));
    void pending.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
  });
  if (replacementDecision !== null) {
    await waitFor(() =>
      expect(
        settled || document.querySelector('[data-testid="replacement-confirmation"]') !== null,
      ).toBe(true),
    );
    if (!settled) {
      await decideReplacement(replacementDecision);
    }
  }
  await act(async () => {
    await pending;
  });
}

async function setInspectorMode(mode: StudioMode) {
  await act(async () => {
    if (!updateInspectorMode) {
      throw new Error("Inspector mode control has not mounted");
    }
    latestStudio?.setLastRoute(`/${mode}`);
    updateInspectorMode(mode);
  });
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  saveStudioLayoutState({ ...defaultStudioLayoutState, lastRoute: "/deliver" });
  const bridge = window as unknown as Record<string, unknown>;
  bridgeSnapshot = new Map(
    Object.keys(bridge)
      .filter((key) => key.startsWith("gg"))
      .map((key) => [key, bridge[key]]),
  );
  updatePreviewRoute = null;
  capturedExportParams = null;
  capturedSaveParams = null;
  replacementDecision = null;
  replacementPromptCount = 0;
  latestStudio = null;
  updateInspectorMode = null;
  installMockBridge();
  document.body.innerHTML = '<div id="root"></div>';
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
  root = createRoot(document.getElementById("root")!);
  act(() => {
    root?.render(
      <QueryClientProvider client={queryClient!}>
        <HotkeysProvider>
          <StudioHarness onStudio={(studio) => (latestStudio = studio)} />
        </HotkeysProvider>
      </QueryClientProvider>,
    );
  });
});

afterEach(() => {
  act(() => root?.unmount());
  const bridge = window as unknown as Record<string, unknown>;
  for (const key of Object.keys(bridge).filter((key) => key.startsWith("gg"))) {
    if (bridgeSnapshot.has(key)) {
      bridge[key] = bridgeSnapshot.get(key);
    } else {
      delete bridge[key];
    }
  }
  queryClient?.clear();
  root = undefined;
  queryClient = undefined;
  latestStudio = null;
  updateInspectorMode = null;
  document.body.innerHTML = "";
});

describe("editor timeline export integration", () => {
  test("visual document history blocks changes while recording and makes scene camera reset undoable", async () => {
    await waitFor(() => expect(currentStudio().timelineDocument).toEqual(initialTimeline));
    const first = initialTimeline.items[0]!;
    if (first.kind !== "clip") {
      throw new Error("Expected clip");
    }
    const cameraTimeline: TimelineDocument = {
      ...initialTimeline,
      items: [{ ...first, camera: staticCamera }],
    };
    await act(async () => {
      queryClient?.setQueryData(studioQueryKeys.projectCurrent(), {
        ...currentStudio().projectQuery.data,
        timeline: cameraTimeline,
      });
    });
    await applyStudioAction((studio) =>
      studio.selectTimelineClip({
        laneId: "video",
        clipId: first.id,
        startSeconds: 0,
        endSeconds: 4,
      }),
    );
    await applyStudioAction((studio) => studio.resetSelectedSceneCamera());
    expect(currentStudio().timelineDocument.items[0]).not.toHaveProperty("camera");
    await applyStudioAction((studio) => studio.undoTimeline());
    expect(currentStudio().timelineDocument).toEqual(cameraTimeline);
    const visual = currentStudio().settingsForm.state.values.backgroundFraming;
    await act(async () => {
      queryClient?.setQueryData(studioQueryKeys.captureStatus(), {
        ...currentStudio().captureStatusQuery.data,
        isRecording: true,
      });
    });
    await applyStudioAction((studio) => studio.resetSelectedSceneCamera());
    await applyStudioAction((studio) => studio.undoTimeline());
    await applyStudioAction((studio) =>
      studio.settingsForm.setFieldValue("backgroundFraming", {
        ...visual,
        enabled: !visual.enabled,
      }),
    );
    expect(currentStudio().timelineDocument).toEqual(cameraTimeline);
    expect(currentStudio().settingsForm.state.values.backgroundFraming).toEqual(visual);
  });

  test("visual document history preserves interleaved edits, Save As relocation and exact undo order", async () => {
    await waitFor(() => expect(currentStudio().timelineDocument).toEqual(initialTimeline));
    const originalAutoZoom = currentStudio().settingsForm.state.values.autoZoom;
    const originalFraming = currentStudio().settingsForm.state.values.backgroundFraming;
    const framing = { ...originalFraming, enabled: true, paddingFraction: 0.15 };
    await applyStudioAction((studio) =>
      studio.settingsForm.setFieldValue("backgroundFraming", framing),
    );
    await applyStudioAction((studio) => studio.splitTimelineClipAtSeconds(1));
    const split = currentStudio().timelineDocument;
    const autoZoom = { ...originalAutoZoom, isEnabled: false, intensity: 0.5 };
    await applyStudioAction((studio) => studio.settingsForm.setFieldValue("autoZoom", autoZoom));
    const bridge = window as unknown as Record<string, unknown>;
    bridge.ggEngineProjectSave = async (params: { timeline: TimelineDocument }) => ({
      ...params,
      projectPath: "/tmp/visual-history-copy.gglassproj",
      recordingURL: "/tmp/visual-history-copy.gglassproj/recording.mov",
      timeline: { ...params.timeline, updatedAt: "2026-11-09T00:00:00.000Z" },
    });
    await applyStudioAction(async (studio) => {
      await studio.saveProjectMutation.mutateAsync(true);
    });
    await waitFor(() => expect(currentStudio().hasUnsavedProjectEdits).toBe(false));
    await applyStudioAction((studio) => studio.undoTimeline());
    expect(currentStudio().settingsForm.state.values.autoZoom).toEqual(originalAutoZoom);
    expect(currentStudio().timelineDocument).toEqual(split);
    expect(currentStudio().settingsForm.state.values.backgroundFraming).toEqual(framing);
    await applyStudioAction((studio) => studio.undoTimeline());
    expect(currentStudio().timelineDocument).toEqual(initialTimeline);
    expect(currentStudio().settingsForm.state.values.backgroundFraming).toEqual(framing);
    await applyStudioAction((studio) => studio.undoTimeline());
    expect(currentStudio().settingsForm.state.values.backgroundFraming).toEqual(originalFraming);
    await applyStudioAction((studio) => studio.redoTimeline());
    await applyStudioAction((studio) => studio.redoTimeline());
    await applyStudioAction((studio) => studio.redoTimeline());
    expect(currentStudio().settingsForm.state.values.autoZoom).toEqual(autoZoom);
    expect(currentStudio().settingsForm.state.values.backgroundFraming).toEqual(framing);
    expect(currentStudio().timelineDocument).toEqual(split);
    expect(currentStudio().hasUnsavedProjectEdits).toBe(false);
    await applyStudioAction(async (studio) => {
      await studio.exportMutation.mutateAsync();
    });
    expect(capturedExportParams).toMatchObject({
      timeline: split,
      autoZoom,
      backgroundFraming: framing,
    });
  });

  test("visual document history adopts complete external proposals and resets on fresh projects", async () => {
    await waitFor(() => expect(currentStudio().timelineDocument).toEqual(initialTimeline));
    const original = currentStudio().settingsForm.state.values;
    const framing = { ...original.backgroundFraming, enabled: true, paddingFraction: 0.15 };
    const autoZoom = { ...original.autoZoom, isEnabled: false };
    await act(async () => {
      queryClient?.setQueryData(studioQueryKeys.projectCurrent(), {
        ...currentStudio().projectQuery.data,
        autoZoom,
        backgroundFraming: framing,
      });
    });
    await waitFor(() =>
      expect(currentStudio().settingsForm.state.values.autoZoom).toEqual(autoZoom),
    );
    expect(currentStudio().hasUnsavedProjectEdits).toBe(false);
    await applyStudioAction((studio) => studio.undoTimeline());
    expect(currentStudio().settingsForm.state.values.autoZoom).toEqual(original.autoZoom);
    expect(currentStudio().settingsForm.state.values.backgroundFraming).toEqual(
      original.backgroundFraming,
    );
    expect(currentStudio().hasUnsavedProjectEdits).toBe(true);
    await applyStudioAction((studio) => studio.redoTimeline());
    expect(currentStudio().settingsForm.state.values.backgroundFraming).toEqual(framing);
    await act(async () => {
      queryClient?.setQueryData(studioQueryKeys.projectCurrent(), {
        ...currentStudio().projectQuery.data,
        projectPath: "/tmp/fresh-visual-project.gglassproj",
        recordingURL: "/tmp/fresh-visual-recording.mov",
        autoZoom: original.autoZoom,
        backgroundFraming: original.backgroundFraming,
      });
    });
    await waitFor(() => expect(currentStudio().canUndoTimeline).toBe(false));
    expect(currentStudio().canRedoTimeline).toBe(false);
    expect(currentStudio().settingsForm.state.values.autoZoom).toEqual(original.autoZoom);
    expect(currentStudio().settingsForm.state.values.backgroundFraming).toEqual(
      original.backgroundFraming,
    );
  });

  test("undo and redo survive saving the draft and external proposal adoption", async () => {
    await waitFor(() => expect(currentStudio().timelineDocument).toEqual(initialTimeline));
    await applyStudioAction((studio) => studio.setLastRoute("/edit"));
    await waitFor(() => expect(currentStudio().activeMode).toBe("edit"));
    await applyStudioAction((studio) => studio.splitTimelineClipAtSeconds(1));
    const split = currentStudio().timelineDocument;
    expect(split.items).toHaveLength(2);
    await act(async () => {
      queryClient?.setQueryData(studioQueryKeys.projectCurrent(), {
        ...currentStudio().projectQuery.data,
        timeline: split,
      });
    });
    await waitFor(() => expect(currentStudio().hasUnsavedTimelineEdits).toBe(false));
    await applyStudioAction((studio) => studio.undoTimeline());
    expect(currentStudio().timelineDocument).toEqual(initialTimeline);
    expect(currentStudio().hasUnsavedTimelineEdits).toBe(true);
    await applyStudioAction((studio) => studio.redoTimeline());
    expect(currentStudio().timelineDocument).toEqual(split);
    const proposed: TimelineDocument = { version: 2, items: [split.items[1]!] };
    await act(async () => {
      queryClient?.setQueryData(studioQueryKeys.projectCurrent(), {
        ...currentStudio().projectQuery.data,
        timeline: proposed,
      });
    });
    await waitFor(() => expect(currentStudio().timelineDocument).toEqual(proposed));
    await applyStudioAction((studio) => studio.undoTimeline());
    expect(currentStudio().timelineDocument).toEqual(split);
    await applyStudioAction((studio) => studio.redoTimeline());
    expect(currentStudio().timelineDocument).toEqual(proposed);
  });

  test("project replacement resets history even with the same source and timeline", async () => {
    await waitFor(() => expect(currentStudio().timelineDocument).toEqual(initialTimeline));
    await applyStudioAction((studio) => studio.setLastRoute("/edit"));
    await applyStudioAction((studio) => studio.splitTimelineClipAtSeconds(1));
    expect(currentStudio().canUndoTimeline).toBe(true);
    await act(async () => {
      queryClient?.setQueryData(studioQueryKeys.projectCurrent(), {
        ...currentStudio().projectQuery.data,
        projectPath: "/tmp/different-project.gglassproj",
        timeline: initialTimeline,
      });
    });
    await waitFor(() => expect(currentStudio().canUndoTimeline).toBe(false));
    expect(currentStudio().canRedoTimeline).toBe(false);
    expect(currentStudio().timelineDocument).toEqual(initialTimeline);
    await applyStudioAction((studio) => studio.undoTimeline());
    expect(currentStudio().timelineDocument).toEqual(initialTimeline);
  });

  test("saved legacy timelines wait for their own media duration", async () => {
    await waitFor(() => expect(currentStudio().timelineDocument).toEqual(initialTimeline));
    await act(async () => {
      queryClient?.setQueryData(studioQueryKeys.captureStatus(), {
        ...currentStudio().captureStatusQuery.data,
        recordingURL: "/tmp/stale.mov",
        recordingDurationSeconds: 999,
      });
      queryClient?.setQueryData(studioQueryKeys.projectCurrent(), {
        ...currentStudio().projectQuery.data,
        recordingURL: "/tmp/legacy.mov",
        timeline: { version: 2, items: [] },
      });
    });
    await waitFor(() => {
      expect(currentStudio().recordingURL).toBe("/tmp/legacy.mov");
      expect(currentStudio().timelineDocument.items).toHaveLength(0);
    });
    await applyStudioAction((studio) => studio.setRecordingMediaDurationSeconds(6));
    await waitFor(() =>
      expect(currentStudio().timelineItems.slice(-1)[0]?.programEndSeconds).toBe(6),
    );
  });

  test("Save As keeps history when the saved package relocates its recording", async () => {
    await waitFor(() => expect(currentStudio().timelineDocument).toEqual(initialTimeline));
    await applyStudioAction((studio) => studio.splitTimelineClipAtSeconds(1));
    const bridge = window as unknown as Record<string, unknown>;
    bridge.ggEngineProjectSave = async (params: { timeline: TimelineDocument }) => ({
      ...currentStudio().projectQuery.data,
      projectPath: "/tmp/copied.gglassproj",
      recordingURL: "/tmp/copied/recording.mov",
      timeline: params.timeline,
    });
    await applyStudioAction(async (studio) => {
      await studio.saveProjectMutation.mutateAsync(true);
    });
    await waitFor(() => {
      expect(currentStudio().recordingURL).toBe("/tmp/copied/recording.mov");
      expect(currentStudio().canUndoTimeline).toBe(true);
    });
    await applyStudioAction((studio) => studio.undoTimeline());
    expect(currentStudio().timelineDocument).toEqual(initialTimeline);
  });

  test("starting a recording adopts its fresh native project and resets draft history", async () => {
    await waitFor(() => expect(currentStudio().timelineDocument).toEqual(initialTimeline));
    await applyStudioAction((studio) => studio.splitTimelineClipAtSeconds(1));
    const configuredAutoZoom = {
      ...currentStudio().settingsForm.state.values.autoZoom,
      isEnabled: false,
      intensity: 0.35,
    };
    const configuredFraming = {
      ...defaultBackgroundFramingSettings,
      enabled: true,
      paddingFraction: 0.2,
      backgroundColor: "#113355",
    };
    await applyStudioAction((studio) => {
      studio.settingsForm.setFieldValue("autoZoom", configuredAutoZoom);
      studio.settingsForm.setFieldValue("backgroundFraming", configuredFraming);
    });
    await applyStudioAction((studio) => studio.setLastRoute("/capture"));
    const bridge = window as unknown as Record<string, unknown>;
    const status = {
      isRunning: true,
      isRecording: true,
      recordingDurationSeconds: 0,
      recordingURL: "/tmp/new-take.mov",
      telemetry: {},
    };
    bridge.ggEngineStartRecording = async () => status;
    bridge.ggEngineCaptureStatus = async () => status;
    bridge.ggEngineProjectCurrent = async () => ({
      recordingURL: "/tmp/new-take.mov",
      autoZoom: { isEnabled: true, intensity: 1, minimumKeyframeInterval: 1 / 30 },
      backgroundFraming: defaultBackgroundFramingSettings,
      timeline: { version: 2, items: [] },
    });
    await act(async () => {
      queryClient?.setQueryData(studioQueryKeys.captureStatus(), {
        ...currentStudio().captureStatusQuery.data,
        isRunning: true,
        isRecording: false,
      });
    });
    const originalDecision = replacementDecision;
    replacementDecision = "discard";
    try {
      await applyStudioAction(async (studio) => {
        await studio.toggleRecordingMutation.mutateAsync(undefined);
      });
      await waitFor(() => {
        expect(currentStudio().recordingURL).toBe("/tmp/new-take.mov");
        expect(currentStudio().projectQuery.data?.projectPath).toBeUndefined();
        expect(currentStudio().timelineDocument.items).toHaveLength(0);
        expect(currentStudio().canUndoTimeline).toBe(false);
        expect(currentStudio().settingsForm.state.values.autoZoom).toEqual(configuredAutoZoom);
        expect(currentStudio().settingsForm.state.values.backgroundFraming).toEqual(
          configuredFraming,
        );
      });
    } finally {
      replacementDecision = originalDecision;
    }
  });

  test("native timestamped reordered Save As response is clean while Undo remains dirty", async () => {
    await waitFor(() => expect(currentStudio().timelineDocument).toEqual(initialTimeline));
    await applyStudioAction((studio) => studio.splitTimelineClipAtSeconds(1));
    const bridge = window as unknown as Record<string, unknown>;
    bridge.ggEngineProjectSave = async (params: { timeline: TimelineDocument }) =>
      reverseObjectKeys({
        ...currentStudio().projectQuery.data,
        projectPath: "/tmp/reordered.gglassproj",
        recordingURL: "/tmp/reordered/recording.mov",
        timeline: { ...params.timeline, updatedAt: "2026-11-08T18:10:00.000Z" },
        autoZoom: currentStudio().settingsForm.state.values.autoZoom,
        backgroundFraming: currentStudio().settingsForm.state.values.backgroundFraming,
      });
    await applyStudioAction(async (studio) => {
      await studio.saveProjectMutation.mutateAsync(true);
    });
    await waitFor(() => expect(currentStudio().hasUnsavedProjectEdits).toBe(false));
    await applyStudioAction((studio) => studio.undoTimeline());
    expect(currentStudio().hasUnsavedProjectEdits).toBe(true);
    await applyStudioAction((studio) => studio.redoTimeline());
    expect(currentStudio().hasUnsavedProjectEdits).toBe(false);
  });

  test("external timestamp-only timeline refresh preserves redo and clean state", async () => {
    await waitFor(() => expect(currentStudio().timelineDocument).toEqual(initialTimeline));
    await applyStudioAction((studio) => studio.splitTimelineClipAtSeconds(1));
    await applyStudioAction((studio) => studio.undoTimeline());
    expect(currentStudio().canRedoTimeline).toBe(true);
    await act(async () => {
      queryClient?.setQueryData(studioQueryKeys.projectCurrent(), {
        ...currentStudio().projectQuery.data,
        timeline: { ...initialTimeline, updatedAt: "2026-11-08T18:11:00.000Z" },
      });
    });
    await waitFor(() => {
      expect(currentStudio().hasUnsavedProjectEdits).toBe(false);
      expect(currentStudio().canRedoTimeline).toBe(true);
    });
    await applyStudioAction((studio) => studio.redoTimeline());
    expect(currentStudio().timelineDocument.items).toHaveLength(2);
    expect(currentStudio().hasUnsavedProjectEdits).toBe(true);
  });

  test.each(["capture", "edit", "deliver"] as const)(
    "modified Undo works from a focused button in %s",
    async (mode) => {
      await waitFor(() => expect(currentStudio().timelineDocument).toEqual(initialTimeline));
      await applyStudioAction((studio) => studio.splitTimelineClipAtSeconds(1));
      await applyStudioAction((studio) => studio.setLastRoute(`/${mode}`));
      await act(() => {
        const button = document.querySelector("button");
        if (!button) {
          throw new Error("Expected a focusable toolbar button");
        }
        button.focus();
        const modifiers =
          currentStudio().shortcutPlatform === "mac" ? { metaKey: true } : { ctrlKey: true };
        button.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "z",
            code: "KeyZ",
            ...modifiers,
            bubbles: true,
            cancelable: true,
          }),
        );
        button.dispatchEvent(
          new KeyboardEvent("keyup", {
            key: "z",
            code: "KeyZ",
            ...modifiers,
            bubbles: true,
            cancelable: true,
          }),
        );
      });
      await waitFor(() => expect(currentStudio().timelineDocument).toEqual(initialTimeline));
      expect(currentStudio().canRedoTimeline).toBe(true);
    },
  );

  test("Edit range selection carries into Deliver and Capture cannot change it", async () => {
    await waitFor(() => expect(currentStudio().timelineDocument).toEqual(initialTimeline));
    await applyStudioAction((studio) => studio.setLastRoute("/edit"));
    await applyStudioAction((studio) => studio.setPlayheadSeconds(1));
    await applyStudioAction((studio) => studio.setTrimInFromPlayhead());
    expect(currentStudio().exportForm.state.values).toMatchObject({
      rangeMode: "selected",
      trimStartSeconds: 1,
      trimEndSeconds: 4,
    });
    await applyStudioAction((studio) => studio.setLastRoute("/deliver"));
    expect(currentStudio().exportForm.state.values.trimStartSeconds).toBe(1);
    await applyStudioAction((studio) => studio.setLastRoute("/capture"));
    await applyStudioAction((studio) => {
      studio.setPlayheadSeconds(2);
      studio.setTrimInFromPlayhead();
    });
    expect(currentStudio().exportForm.state.values.trimStartSeconds).toBe(1);
  });

  test("exports a selected range starting at zero with both explicit endpoints", async () => {
    await waitFor(() => expect(latestStudio?.selectedPreset?.id).toBe("h264-1080p-30"));
    await applyStudioAction((studio) => studio.setTrimEndSeconds(2));
    await applyStudioAction(async (studio) => studio.exportMutation.mutateAsync());
    expect(capturedExportParams).toMatchObject({ trimStartSeconds: 0, trimEndSeconds: 2 });
  });

  test("rejects equal endpoints rather than silently exporting the full recording", async () => {
    await waitFor(() => expect(latestStudio?.selectedPreset?.id).toBe("h264-1080p-30"));
    await applyStudioAction((studio) => {
      studio.setTrimStartSeconds(2);
      studio.setTrimEndSeconds(2);
    });
    await expect(currentStudio().exportMutation.mutateAsync()).rejects.toThrow("Choose a range");
    expect(capturedExportParams).toBeNull();
  });

  test("rejects a selected range made stale by a shorter timeline", async () => {
    await waitFor(() => expect(latestStudio?.selectedPreset?.id).toBe("h264-1080p-30"));
    await applyStudioAction((studio) => studio.setTrimEndSeconds(4));
    await applyStudioAction((studio) => studio.splitTimelineClipAtSeconds(1));
    await applyStudioAction((studio) => {
      studio.toggleTimelineRipple();
      studio.selectTimelineClip({
        laneId: "video",
        clipId: "segment-0",
        startSeconds: 0,
        endSeconds: 1,
      });
    });
    await applyStudioAction((studio) => studio.deleteSelectedTimelineClip());
    await expect(currentStudio().exportMutation.mutateAsync()).rejects.toThrow("Choose a range");
    expect(capturedExportParams).toBeNull();
  });

  test("full program ignores old range endpoints and empty programs cannot export", async () => {
    await waitFor(() => expect(latestStudio?.selectedPreset?.id).toBe("h264-1080p-30"));
    await applyStudioAction((studio) => studio.setTrimEndSeconds(2));
    await applyStudioAction((studio) => studio.setExportRangeMode("full"));
    await applyStudioAction(async (studio) => studio.exportMutation.mutateAsync());
    expect(capturedExportParams).not.toHaveProperty("trimStartSeconds");
    expect(capturedExportParams).not.toHaveProperty("trimEndSeconds");
    capturedExportParams = null;
    await applyStudioAction((studio) => {
      studio.toggleTimelineRipple();
      studio.selectTimelineClip({
        laneId: "video",
        clipId: "segment-0",
        startSeconds: 0,
        endSeconds: 4,
      });
    });
    await applyStudioAction((studio) => studio.deleteSelectedTimelineClip());
    await expect(currentStudio().exportMutation.mutateAsync()).rejects.toThrow("Choose a range");
    expect(capturedExportParams).toBeNull();
  });

  test("shows deliver defaults when no inspector selection is active", async () => {
    await waitFor(() =>
      expect(latestStudio?.timelineDocument.items).toEqual(initialTimeline.items),
    );

    await expect.element(page.getByRole("heading", { name: "Deliver Inspector" })).toBeVisible();
    await expect.element(page.getByText("Active Preset")).toBeVisible();
    await expect.element(page.getByText("Trim Window")).toBeVisible();
  });

  test("shows the selected clip inspector in the rendered editor", async () => {
    await waitFor(() =>
      expect(latestStudio?.timelineDocument.items).toEqual(initialTimeline.items),
    );
    await applyStudioAction((studio) =>
      studio.selectTimelineClip({
        laneId: "video",
        clipId: "segment-0",
        startSeconds: 0,
        endSeconds: 4,
      }),
    );

    await expect.element(page.getByRole("heading", { name: "Video Clip Inspector" })).toBeVisible();
    await expect.element(page.getByRole("heading", { name: "Scene 1", exact: true })).toBeVisible();
    await expect.element(page.getByText("Active Preset")).not.toBeInTheDocument();
  });

  test("shows selected preset details and preserves deliver controls", async () => {
    await waitFor(() => expect(latestStudio?.selectedPreset?.id).toBe("h264-1080p-30"));
    await applyStudioAction((studio) => studio.setLastRoute("/deliver"));
    await waitFor(() => expect(latestStudio?.activeMode).toBe("deliver"));
    await applyStudioAction((studio) => studio.selectExportPreset("h264-1080p-30"));

    await expect.element(page.getByRole("heading", { name: "Preset Inspector" })).toBeVisible();
    await expect.element(page.getByText("Selected Preset")).toBeVisible();
    await expect.element(page.getByText("File Type")).toBeVisible();
    await expect.element(page.getByText("mp4")).toBeVisible();
    await expect.element(page.getByText("Active Preset")).toBeVisible();
    await expect.element(page.getByText("Trim Window")).toBeVisible();
  });

  test("shows selected capture window details and working capture controls", async () => {
    await waitFor(() =>
      expect(latestStudio?.timelineDocument.items).toEqual(initialTimeline.items),
    );
    await applyStudioAction((studio) =>
      studio.selectCaptureWindow({ windowId: 42, appName: "Safari", title: "Docs" }),
    );
    await setInspectorMode("capture");

    await expect.element(page.getByRole("heading", { name: "Window Inspector" })).toBeVisible();
    await expect.element(page.getByText("Selected Window")).toBeVisible();
    await expect.element(page.getByText("Safari")).toBeVisible();
    await expect.element(page.getByText("Window ID")).toBeVisible();
    await expect.element(page.getByText("42", { exact: true })).toBeVisible();
    const captureFps = page.getByRole("combobox", { name: "Capture FPS" });
    await expect.element(captureFps).toBeVisible();
    await waitFor(() => expect(latestStudio?.settingsForm.state.values.captureFps).toBe(30));
    const microphone = page.getByRole("checkbox", { name: "Include microphone" });
    await microphone.click();
    await waitFor(() => expect(latestStudio?.settingsForm.state.values.micEnabled).toBe(true));
    await expect.element(microphone).toBeChecked();
  });

  test("records and resets a shortcut override from global Preferences", async () => {
    await waitFor(() =>
      expect(latestStudio?.timelineDocument.items).toEqual(initialTimeline.items),
    );
    await setInspectorMode("capture");
    await page.getByRole("button", { name: "Preferences and shortcuts" }).click();

    const saveShortcutRow = page.getByRole("group", { name: "Save Project", exact: true });
    const saveShortcutRecordButton = saveShortcutRow.getByRole("button", {
      name: "Change shortcut",
    });
    await expect.element(saveShortcutRecordButton).toBeVisible();
    await saveShortcutRecordButton.click();
    await act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "p",
          code: "KeyP",
          ctrlKey: true,
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    await waitFor(() => expect(latestStudio?.shortcutOverrides.save).toBe("Control+Shift+P"));
    const currentBinding = studioShortcutDisplayTokens("save", {
      platform: currentStudio().shortcutPlatform,
      overrides: currentStudio().shortcutOverrides,
    }).join("+");
    await expect
      .element(
        saveShortcutRow.getByText(currentStudio().ui.helper.shortcutCustomized(currentBinding), {
          exact: true,
        }),
      )
      .toBeVisible();
    const resetSaveShortcut = saveShortcutRow.getByRole("button", { name: "Reset" });
    await expect.element(resetSaveShortcut).toBeEnabled();
    await resetSaveShortcut.click();
    await waitFor(() => expect(latestStudio?.shortcutOverrides.save).toBeUndefined());
    await expect.element(resetSaveShortcut).toBeDisabled();
  });

  test("drag-drop ripple move commits order, clears selection, moves playhead, and exports", async () => {
    await waitFor(() =>
      expect(latestStudio?.timelineDocument.items).toEqual(initialTimeline.items),
    );
    await applyStudioAction((studio) => studio.splitTimelineClipAtSeconds(1));
    await waitFor(() => expect(latestStudio?.timelineDocument.items).toHaveLength(2));

    const movedClip = currentTimelineClip(0);
    await applyStudioAction((studio) => {
      studio.selectTimelineClip({
        laneId: "video",
        clipId: movedClip.id,
        startSeconds: 0,
        endSeconds: 1,
      });
    });
    await waitFor(() => expect(latestStudio?.inspectorSelection).not.toBeNull());
    await applyStudioAction((studio) =>
      studio.moveTimelineClipByDrop({ clipId: movedClip.id, destinationIndex: 2 }),
    );

    await waitFor(() => {
      expect(latestStudio?.timelineDocument.items.map((item) => item.id)).toEqual([
        expect.not.stringMatching(movedClip.id),
        movedClip.id,
      ]);
      expect(latestStudio?.inspectorSelection).toEqual({ kind: "none" });
      expect(latestStudio?.playbackStore.getSnapshot().playheadSeconds).toBe(3);
    });

    await applyStudioAction(async (studio) => studio.saveProjectMutation.mutateAsync(false));
    expect(capturedSaveParams).toMatchObject({
      backgroundFraming: defaultBackgroundFramingSettings,
    });

    await applyStudioAction(async (studio) => studio.exportMutation.mutateAsync());
    expect(capturedExportTimeline()).toEqual(currentStudio().timelineDocument);
    expect(capturedExportParams).toMatchObject({
      backgroundFraming: defaultBackgroundFramingSettings,
    });
  });

  test("exports complete unsaved background framing settings", async () => {
    await waitFor(() => expect(latestStudio?.selectedPreset?.id).toBe("h264-1080p-30"));
    const backgroundFraming = {
      version: 1 as const,
      enabled: true,
      backgroundColor: "#204060",
      paddingFraction: 0.12,
      cornerRadiusFraction: 0.05,
      shadowStrength: 0.7,
    };
    await applyStudioAction((studio) => {
      studio.settingsForm.setFieldValue("backgroundFraming", backgroundFraming);
    });
    await applyStudioAction(async (studio) => studio.exportMutation.mutateAsync());

    expect(capturedExportParams).toMatchObject({ backgroundFraming });
  });

  test("project switches replace unsaved framing even when persisted values match", async () => {
    await waitFor(() =>
      expect(latestStudio?.settingsForm.state.values.backgroundFraming).toEqual(
        defaultBackgroundFramingSettings,
      ),
    );
    await applyStudioAction((studio) => {
      studio.settingsForm.setFieldValue("backgroundFraming", {
        ...defaultBackgroundFramingSettings,
        enabled: true,
      });
    });

    await act(async () => {
      queryClient?.setQueryData(studioQueryKeys.projectCurrent(), {
        projectPath: "/tmp/project-b.gglassproj",
        recordingURL: "/tmp/recording.mov",
        autoZoom: { isEnabled: true, intensity: 1, minimumKeyframeInterval: 1 / 30 },
        backgroundFraming: defaultBackgroundFramingSettings,
        timeline: initialTimeline,
      });
    });

    await waitFor(() =>
      expect(latestStudio?.settingsForm.state.values.backgroundFraming).toEqual(
        defaultBackgroundFramingSettings,
      ),
    );
  });

  test("drag-drop non-ripple move splits gaps and synchronizes selection and playhead", async () => {
    await waitFor(() =>
      expect(latestStudio?.timelineDocument.items).toEqual(initialTimeline.items),
    );
    await applyStudioAction((studio) => studio.splitTimelineClipAtSeconds(1));
    await waitFor(() => expect(latestStudio?.timelineDocument.items).toHaveLength(2));

    const liftedClip = currentTimelineClip(1);
    await applyStudioAction((studio) => {
      studio.selectTimelineClip({
        laneId: "video",
        clipId: liftedClip.id,
        startSeconds: 1,
        endSeconds: 4,
      });
    });
    await applyStudioAction((studio) => studio.liftSelectedTimelineClip());
    await waitFor(() =>
      expect(latestStudio?.timelineDocument.items.map((item) => item.kind)).toEqual([
        "clip",
        "gap",
      ]),
    );
    await applyStudioAction((studio) => studio.splitTimelineClipAtSeconds(0.5));
    await waitFor(() => expect(latestStudio?.timelineDocument.items).toHaveLength(3));

    const movedClip = currentTimelineClip(1);
    const destinationGap = currentTimelineGap(2);
    await applyStudioAction((studio) => {
      studio.selectTimelineClip({
        laneId: "video",
        clipId: movedClip.id,
        startSeconds: 0.5,
        endSeconds: 1,
      });
    });
    await applyStudioAction((studio) =>
      studio.moveTimelineClipByDrop({
        clipId: movedClip.id,
        destinationGapId: destinationGap.id,
        destinationOffsetSeconds: 1,
      }),
    );

    await waitFor(() => {
      expect(latestStudio?.timelineDocument.items.map((item) => item.kind)).toEqual([
        "clip",
        "gap",
        "clip",
        "gap",
      ]);
      expect(latestStudio?.inspectorSelection).toEqual({ kind: "none" });
      expect(latestStudio?.playbackStore.getSnapshot().playheadSeconds).toBe(2);
    });

    await applyStudioAction(async (studio) => studio.exportMutation.mutateAsync());
    expect(capturedExportTimeline()).toEqual(currentStudio().timelineDocument);
  });

  test("exports the timeline produced by split, lift, move, and delete controller actions", async () => {
    await waitFor(() => {
      expect(latestStudio?.timelineDocument.items).toEqual(initialTimeline.items);
      expect(latestStudio?.selectedPreset?.id).toBe("h264-1080p-30");
    });

    await applyStudioAction((studio) => studio.splitTimelineClipAtSeconds(1));
    await waitFor(() => expect(latestStudio?.timelineDocument.items).toHaveLength(2));

    const liftedClip = currentTimelineClip(1);
    await applyStudioAction((studio) => {
      studio.selectTimelineClip({
        laneId: "video",
        clipId: liftedClip.id,
        startSeconds: 1,
        endSeconds: 4,
      });
    });
    await waitFor(() => {
      expect(latestStudio?.inspectorSelection).toMatchObject({
        kind: "timelineClip",
        clipId: liftedClip.id,
      });
    });
    await applyStudioAction((studio) => studio.liftSelectedTimelineClip());
    await waitFor(() => {
      expect(latestStudio?.timelineDocument.items.map((item) => item.kind)).toEqual([
        "clip",
        "gap",
      ]);
    });

    await applyStudioAction((studio) => studio.splitTimelineClipAtSeconds(0.5));
    await waitFor(() => {
      expect(latestStudio?.timelineDocument.items.map((item) => item.kind)).toEqual([
        "clip",
        "clip",
        "gap",
      ]);
    });

    if (!currentStudio().timelineRippleEnabled) {
      await applyStudioAction((studio) => studio.toggleTimelineRipple());
      await waitFor(() => expect(latestStudio?.timelineRippleEnabled).toBe(true));
    }

    const movedClip = currentTimelineClip(1);
    await applyStudioAction((studio) => {
      studio.selectTimelineClip({
        laneId: "video",
        clipId: movedClip.id,
        startSeconds: 0.5,
        endSeconds: 1,
      });
    });
    await waitFor(() => {
      expect(latestStudio?.inspectorSelection).toMatchObject({
        kind: "timelineClip",
        clipId: movedClip.id,
      });
    });
    await applyStudioAction((studio) => studio.moveSelectedTimelineClipLater());
    await waitFor(() => {
      expect(latestStudio?.timelineDocument.items.map((item) => item.kind)).toEqual([
        "clip",
        "gap",
        "clip",
      ]);
    });

    const deletedClip = currentTimelineClip(2);
    await applyStudioAction((studio) => {
      studio.selectTimelineClip({
        laneId: "video",
        clipId: deletedClip.id,
        startSeconds: 3.5,
        endSeconds: 4,
      });
    });
    await waitFor(() => {
      expect(latestStudio?.inspectorSelection).toMatchObject({
        kind: "timelineClip",
        clipId: deletedClip.id,
      });
    });
    await applyStudioAction((studio) => studio.deleteSelectedTimelineClip());
    await waitFor(() => {
      expect(latestStudio?.timelineDocument.items.map((item) => item.kind)).toEqual([
        "clip",
        "gap",
      ]);
    });

    await applyStudioAction(async (studio) => {
      await studio.exportMutation.mutateAsync();
    });

    expect(capturedExportParams).toMatchObject({
      outputURL: "/tmp/guerillaglass-export.mp4",
      presetId: "h264-1080p-30",
      timeline: currentStudio().timelineDocument,
    });
    expect(capturedExportTimeline().items).toEqual([
      {
        kind: "clip",
        id: "segment-0",
        sourceAssetId: "recording",
        sourceStartSeconds: 0,
        sourceEndSeconds: 0.5,
      },
      expect.objectContaining({ kind: "gap", durationSeconds: 3 }),
    ]);
  });
});

test("proposal operations block native menu and shortcut saves until they settle", async () => {
  await waitFor(() => expect(currentStudio().isRunningAction).toBe(false));
  if (!queryClient) {
    throw new Error("Query client unavailable");
  }
  await applyStudioAction((studio) => studio.setLastRoute("/edit"));
  await applyStudioAction((studio) => studio.splitTimelineClipAtSeconds(1));
  const draftBeforeProposal = currentStudio().timelineDocument;
  const signal: { resolve?: () => void } = {};
  const suspended = new Promise<void>((resolve) => {
    signal.resolve = resolve;
  });
  const mutation = queryClient.getMutationCache().build(queryClient, {
    mutationKey: studioQueryKeys.agentProposal(),
    mutationFn: () => suspended,
  });
  if (!signal.resolve) {
    throw new Error("Proposal not started");
  }
  const release = signal.resolve;
  const running = mutation.execute(undefined);
  try {
    await waitFor(() => expect(currentStudio().isRunningAction).toBe(true));
    await applyStudioAction((studio) => studio.runHostCommand("file.saveProject"));
    expect(capturedSaveParams).toBeNull();
    await applyStudioAction((studio) => studio.undoTimeline());
    expect(currentStudio().timelineDocument).toEqual(draftBeforeProposal);
    const framingBeforeBlockedEdit = currentStudio().settingsForm.state.values.backgroundFraming;
    await applyStudioAction((studio) =>
      studio.settingsForm.setFieldValue("backgroundFraming", {
        ...framingBeforeBlockedEdit,
        enabled: !framingBeforeBlockedEdit.enabled,
      }),
    );
    expect(currentStudio().settingsForm.state.values.backgroundFraming).toEqual(
      framingBeforeBlockedEdit,
    );
    window.dispatchEvent(
      new CustomEvent("gg-host-menu-command", { detail: { command: "file.saveProject" } }),
    );
    expect(capturedSaveParams).toBeNull();
  } finally {
    release();
    await running;
  }
  await waitFor(() => expect(currentStudio().isRunningAction).toBe(false));
  await applyStudioAction((studio) => studio.runHostCommand("file.saveProject"));
  await waitFor(() => expect(capturedSaveParams).not.toBeNull());
});

test("settings-only edits immediately protect replacement without another input", async () => {
  await waitFor(() => expect(currentStudio().projectQuery.data?.projectPath).toBeTruthy());
  await applyStudioAction((studio) =>
    studio.settingsForm.setFieldValue("backgroundFraming", {
      ...defaultBackgroundFramingSettings,
      enabled: true,
    }),
  );
  await waitFor(() => expect(currentStudio().hasUnsavedProjectEdits).toBe(true));
  const originalDecision = replacementDecision;
  let opened = false;
  const bridge = window as unknown as Record<string, unknown>;
  bridge.ggEngineProjectOpen = async () => {
    opened = true;
    return currentStudio().projectQuery.data;
  };
  replacementDecision = "keep";
  try {
    await applyStudioAction(async (studio) => {
      await studio.openRecentProjectMutation.mutateAsync("/tmp/other.gglassproj");
    });
    expect(replacementPromptCount).toBe(1);
    expect(opened).toBe(false);
    expect(currentStudio().settingsForm.state.values.backgroundFraming.enabled).toBe(true);
  } finally {
    replacementDecision = originalDecision;
  }
});

test("a fresh unsaved recording requires a decision before replacement", async () => {
  await waitFor(() => expect(currentStudio().projectQuery.data).toBeTruthy());
  await act(async () =>
    queryClient?.setQueryData(studioQueryKeys.projectCurrent(), {
      ...currentStudio().projectQuery.data,
      projectPath: null,
    }),
  );
  await waitFor(() => expect(currentStudio().hasUnsavedProjectEdits).toBe(true));
  const originalDecision = replacementDecision;
  replacementDecision = "keep";
  try {
    await applyStudioAction(async (studio) => {
      await studio.openProjectMutation.mutateAsync();
    });
    await applyStudioAction(async (studio) => {
      await studio.toggleRecordingMutation.mutateAsync(undefined);
    });
    expect(replacementPromptCount).toBe(2);
    expect(currentStudio().recordingURL).toBe("/tmp/recording.mov");
  } finally {
    replacementDecision = originalDecision;
  }
});

test("an empty draft cannot be saved as an ambiguous full-source legacy project", async () => {
  await waitFor(() => expect(currentStudio().timelineDocument.items).toHaveLength(1));
  await applyStudioAction((studio) => {
    studio.toggleTimelineRipple();
    studio.selectTimelineClip({
      laneId: "video",
      clipId: initialTimeline.items[0]!.id,
      startSeconds: 0,
      endSeconds: 4,
    });
  });
  await applyStudioAction((studio) => studio.deleteSelectedTimelineClip());
  await waitFor(() => expect(currentStudio().timelineDocument.items).toHaveLength(0));
  await expect(
    applyStudioAction(async (studio) => {
      await studio.saveProjectMutation.mutateAsync(false);
    }),
  ).rejects.toThrow("timeline is empty");
  expect(capturedSaveParams).toBeNull();
  await applyStudioAction((studio) => studio.undoTimeline());
  expect(currentStudio().timelineDocument).toEqual(initialTimeline);
});

describe("media preview lease recovery", () => {
  for (const route of ["capture", "edit"] as const) {
    test(`${route} remounts source media after an expired lease refreshes`, async () => {
      await waitFor(() => expect(currentStudio().recordingURL).toBeTruthy());
      await waitFor(() =>
        expect(queryClient?.isFetching({ queryKey: ["studio", "timelineWaveform"] })).toBe(0),
      );
      let resolutions = 0;
      const bridge = window as unknown as Record<string, unknown>;
      bridge.ggResolveMediaSourceURL = async () =>
        ++resolutions === 1
          ? new URL("/expired-media-token.mov", window.location.href).href
          : new URL(healthyMediaSource, window.location.href).href;
      await act(async () => {
        updatePreviewRoute?.(route);
      });
      await waitFor(() => expect(resolutions).toBeGreaterThanOrEqual(2), 5000);
      await waitFor(() => {
        const video = document.querySelector("video");
        expect(video?.src).toBe(new URL(healthyMediaSource, window.location.href).href);
        expect(video?.readyState).toBeGreaterThanOrEqual(2);
        expect(document.querySelector('[role="alert"]')).toBeNull();
      }, 5000);
    });

    test(`${route} retains a working manual retry after a real media failure`, async () => {
      await waitFor(() => expect(currentStudio().recordingURL).toBeTruthy());
      await waitFor(() =>
        expect(queryClient?.isFetching({ queryKey: ["studio", "timelineWaveform"] })).toBe(0),
      );
      let healthy = false;
      const bridge = window as unknown as Record<string, unknown>;
      bridge.ggResolveMediaSourceURL = async () =>
        new URL(healthy ? healthyMediaSource : "/missing-media-source.mov", window.location.href)
          .href;
      await act(async () => {
        updatePreviewRoute?.(route);
      });
      await expect.element(page.getByRole("alert")).toBeVisible();
      await waitFor(() => {
        const stage = document.querySelector('[data-testid="background-framing-stage"]');
        const bounds = stage?.getBoundingClientRect();
        expect(bounds?.width).toBeGreaterThan(100);
        expect(bounds?.height).toBeGreaterThan(100);
      });
      healthy = true;
      await page.getByRole("button", { name: "Retry" }).click();
      await waitFor(() => {
        const video = document.querySelector("video");
        expect(video?.src).toBe(new URL(healthyMediaSource, window.location.href).href);
        expect(video?.readyState).toBeGreaterThanOrEqual(2);
        expect(document.querySelector('[role="alert"]')).toBeNull();
      }, 5000);
    });
  }
});

for (const openKind of ["open", "recent"] as const) {
  test(`discarding edits while reopening the same package through ${openKind} restores the saved document`, async () => {
    await waitFor(() => expect(currentStudio().timelineDocument).toEqual(initialTimeline));
    const saved = currentStudio().projectQuery.data!;
    await applyStudioAction((studio) => {
      studio.settingsForm.setFieldValue("backgroundFraming", {
        ...defaultBackgroundFramingSettings,
        enabled: true,
      });
      studio.selectTimelineClip({
        laneId: "video",
        clipId: "segment-0",
        startSeconds: 0,
        endSeconds: 4,
      });
      studio.setPlayheadSeconds(2);
      studio.splitSelectedTimelineClipAtPlayhead();
    });
    await waitFor(() => expect(currentStudio().hasUnsavedProjectEdits).toBe(true));
    expect(currentStudio().canUndoTimeline).toBe(true);
    const originalDecision = replacementDecision;
    const bridge = window as unknown as Record<string, unknown>;
    bridge.ggPickPath = async () => saved.projectPath;
    bridge.ggEngineProjectOpen = async () => saved;
    replacementDecision = "discard";
    try {
      await applyStudioAction(async (studio) => {
        if (openKind === "open") {
          await studio.openProjectMutation.mutateAsync();
        } else {
          await studio.openRecentProjectMutation.mutateAsync(saved.projectPath!);
        }
      });
      await waitFor(() => {
        expect(currentStudio().timelineDocument).toEqual(initialTimeline);
        expect(currentStudio().settingsForm.state.values.backgroundFraming).toEqual(
          saved.backgroundFraming,
        );
        expect(currentStudio().hasUnsavedProjectEdits).toBe(false);
        expect(currentStudio().canUndoTimeline).toBe(false);
        expect(currentStudio().canRedoTimeline).toBe(false);
        expect(currentStudio().playbackStore.getSnapshot().playheadSeconds).toBe(0);
      });
      await applyStudioAction(async (studio) => {
        await studio.saveProjectMutation.mutateAsync(false);
      });
      expect(capturedSaveParams).toMatchObject({
        timeline: initialTimeline,
        backgroundFraming: saved.backgroundFraming,
      });
    } finally {
      replacementDecision = originalDecision;
    }
  });
}

for (const outcome of ["picker-cancel", "native-failure"] as const) {
  test(`${outcome} while reopening keeps the draft and its undo history`, async () => {
    await waitFor(() => expect(currentStudio().timelineDocument).toEqual(initialTimeline));
    await applyStudioAction((studio) =>
      studio.settingsForm.setFieldValue("backgroundFraming", {
        ...defaultBackgroundFramingSettings,
        enabled: true,
      }),
    );
    const originalDecision = replacementDecision;
    const bridge = window as unknown as Record<string, unknown>;
    bridge.ggPickPath = async () =>
      outcome === "picker-cancel" ? null : "/tmp/project.gglassproj";
    bridge.ggEngineProjectOpen = async () => {
      throw new Error("Project could not open");
    };
    replacementDecision = "discard";
    try {
      await applyStudioAction(async (studio) => {
        const opening = studio.openProjectMutation.mutateAsync();
        if (outcome === "native-failure") {
          await expect(opening).rejects.toThrow();
        } else {
          await opening;
        }
      });
      expect(currentStudio().hasUnsavedProjectEdits).toBe(true);
      expect(currentStudio().canUndoTimeline).toBe(true);
      expect(currentStudio().settingsForm.state.values.backgroundFraming.enabled).toBe(true);
      await applyStudioAction((studio) => studio.undoTimeline());
      expect(currentStudio().settingsForm.state.values.backgroundFraming).toEqual(
        defaultBackgroundFramingSettings,
      );
    } finally {
      replacementDecision = originalDecision;
    }
  });
}

test("a successful project open adopts the saved document even when capture status refresh fails", async () => {
  await waitFor(() => expect(currentStudio().timelineDocument).toEqual(initialTimeline));
  const saved = currentStudio().projectQuery.data!;
  await applyStudioAction((studio) =>
    studio.settingsForm.setFieldValue("backgroundFraming", {
      ...defaultBackgroundFramingSettings,
      enabled: true,
    }),
  );
  const originalDecision = replacementDecision;
  const bridge = window as unknown as Record<string, unknown>;
  bridge.ggPickPath = async () => saved.projectPath;
  bridge.ggEngineProjectOpen = async () => saved;
  bridge.ggEngineCaptureStatus = async () => {
    throw new Error("Status refresh unavailable");
  };
  replacementDecision = "discard";
  try {
    await applyStudioAction(async (studio) => {
      await studio.openProjectMutation.mutateAsync();
    });
    await waitFor(() => {
      expect(currentStudio().hasUnsavedProjectEdits).toBe(false);
      expect(currentStudio().canUndoTimeline).toBe(false);
      expect(currentStudio().settingsForm.state.values.backgroundFraming).toEqual(
        saved.backgroundFraming,
      );
      expect(currentStudio().notice?.message).toContain(
        "Project opened. Capture status could not refresh.",
      );
    });
  } finally {
    replacementDecision = originalDecision;
  }
});

test("an explicit static scene camera exposes its values and can return to project settings", async () => {
  await waitFor(() => expect(currentStudio().timelineDocument).toEqual(initialTimeline));
  await setInspectorMode("edit");
  const first = initialTimeline.items[0]!;
  if (first.kind !== "clip") {
    throw new Error("Expected clip");
  }
  const staticTimeline: TimelineDocument = {
    ...initialTimeline,
    items: [{ ...first, camera: staticCamera }],
  };
  await act(async () => {
    queryClient?.setQueryData(studioQueryKeys.projectCurrent(), {
      ...currentStudio().projectQuery.data,
      timeline: staticTimeline,
    });
  });
  await applyStudioAction((studio) =>
    studio.selectTimelineClip({
      laneId: "video",
      clipId: first.id,
      startSeconds: 0,
      endSeconds: 4,
    }),
  );
  await expect
    .element(page.getByText(`${currentStudio().formatDecimal(1)}×`, { exact: true }))
    .toBeVisible();
  await expect
    .element(page.getByText("Uses project camera settings", { exact: true }))
    .not.toBeInTheDocument();
  await page.getByRole("button", { name: "Reset scene camera", exact: true }).click();
  await expect
    .element(page.getByText("Uses project camera settings", { exact: true }))
    .toBeVisible();
  await applyStudioAction((studio) => studio.undoTimeline());
  await expect
    .element(page.getByText(`${currentStudio().formatDecimal(1)}×`, { exact: true }))
    .toBeVisible();
});

async function prepareCapture() {
  await waitFor(() => expect(currentStudio().timelineDocument).toEqual(initialTimeline));
  await applyStudioAction((studio) => studio.splitTimelineClipAtSeconds(1));
  await applyStudioAction((studio) => studio.setTrimEndSeconds(2));
  await applyStudioAction((studio) => studio.setLastRoute("/capture"));
  await act(async () => {
    queryClient?.setQueryData(studioQueryKeys.captureStatus(), {
      ...currentStudio().captureStatusQuery.data,
      isRunning: true,
      isRecording: false,
    });
  });
}

describe("recording transition reconciliation", () => {
  test("Record replaces a running preview with the requested source, microphone and FPS", async () => {
    await waitFor(() => expect(currentStudio().timelineDocument).toEqual(initialTimeline));
    await setInspectorMode("capture");
    const bridge = window as unknown as Record<string, unknown>;
    const calls: string[] = [];
    const idle = {
      isRunning: false,
      isRecording: false,
      recordingDurationSeconds: 0,
      telemetry: {},
    };
    let status = idle;
    bridge.ggEngineStopCapture = async () => {
      calls.push("stop-preview");
      status = idle;
      return status;
    };
    bridge.ggEngineStartCurrentWindowCapture = async (enableMic: boolean, captureFps: number) => {
      calls.push("start-window");
      expect(enableMic).toBe(true);
      expect(captureFps).toBe(60);
      status = { ...idle, isRunning: true };
      return status;
    };
    bridge.ggEngineStartRecording = async () => {
      calls.push("record");
      status = { ...idle, isRunning: true, isRecording: true };
      return status;
    };
    bridge.ggEngineCaptureStatus = async () => status;
    await applyStudioAction((studio) => {
      studio.settingsForm.setFieldValue("micEnabled", true);
      studio.settingsForm.setFieldValue("captureFps", 60);
    });
    await act(async () => {
      queryClient?.setQueryData(studioQueryKeys.captureStatus(), { ...idle, isRunning: true });
    });
    await waitFor(() => expect(currentStudio().captureStatusQuery.data?.isRunning).toBe(true));
    await applyStudioAction(async (studio) => {
      await studio.toggleRecordingMutation.mutateAsync({
        captureSourceOverride: "window",
        preferCurrentWindow: true,
      });
    });
    expect(calls).toEqual(["stop-preview", "start-window", "record"]);
  });

  test.each([false, true])("active capture locks setup, recording=%s", async (isRecording) => {
    await waitFor(() => expect(currentStudio().timelineDocument).toEqual(initialTimeline));
    await setInspectorMode("capture");
    const idle = {
      ...currentStudio().captureStatusQuery.data!,
      isRunning: false,
      isRecording: false,
    };
    const bridge = window as unknown as Record<string, unknown>;
    bridge.ggEngineCaptureStatus = async () => idle;
    bridge.ggEngineStopCapture = async () => idle;
    await act(async () => {
      queryClient?.setQueryData(studioQueryKeys.captureStatus(), {
        ...idle,
        isRunning: true,
        isRecording,
      });
      updatePreviewRoute?.("capture");
    });
    await expect
      .element(page.getByRole("radio", { name: currentStudio().ui.labels.window, exact: true }))
      .toBeDisabled();
    await expect
      .element(
        page.getByRole("checkbox", { name: currentStudio().ui.labels.includeMic, exact: true }),
      )
      .toBeDisabled();
    await expect
      .element(
        page.getByRole("checkbox", { name: currentStudio().ui.labels.trackInput, exact: true }),
      )
      .toBeDisabled();
    await expect
      .element(
        page.getByRole("combobox", {
          name: currentStudio().ui.labels.captureFrameRate,
          exact: true,
        }),
      )
      .toBeDisabled();
    if (!isRecording) {
      await page
        .getByRole("button", { name: currentStudio().ui.actions.stopPreview, exact: true })
        .click();
      await expect
        .element(page.getByRole("radio", { name: currentStudio().ui.labels.window, exact: true }))
        .toBeEnabled();
      await expect
        .element(
          page.getByRole("checkbox", { name: currentStudio().ui.labels.includeMic, exact: true }),
        )
        .toBeEnabled();
    } else {
      await expect
        .element(
          page.getByRole("button", { name: currentStudio().ui.actions.stopPreview, exact: true }),
        )
        .not.toBeInTheDocument();
    }
  });

  test("successful native start retires the old project even if both follow-up queries fail", async () => {
    await prepareCapture();
    await applyStudioAction(async (studio) => studio.exportMutation.mutateAsync());
    expect(currentStudio().exportMutation.data?.status).toBe("succeeded");
    const bridge = window as unknown as Record<string, unknown>;
    bridge.ggEngineStartRecording = async () => ({
      isRunning: true,
      isRecording: true,
      recordingDurationSeconds: 0,
      recordingURL: "/tmp/refresh-failed.mov",
      telemetry: {},
    });
    bridge.ggEngineCaptureStatus = async () => {
      throw new Error("Status unavailable");
    };
    bridge.ggEngineProjectCurrent = async () => {
      throw new Error("Project refresh unavailable");
    };
    const originalDecision = replacementDecision;
    replacementDecision = "discard";
    try {
      await applyStudioAction(async (studio) => {
        await studio.toggleRecordingMutation.mutateAsync(undefined);
      });
      await waitFor(() => {
        expect(currentStudio().recordingURL).toBe("/tmp/refresh-failed.mov");
        expect(currentStudio().exportMutation.data).toBeUndefined();
        expect(currentStudio().projectQuery.data?.projectPath).toBeUndefined();
        expect(currentStudio().captureStatusQuery.data?.isRecording).toBe(true);
        expect(currentStudio().canUndoTimeline).toBe(false);
        expect(currentStudio().exportForm.state.values.rangeMode).toBe("full");
        expect(currentStudio().notice).toMatchObject({ kind: "info" });
      });
    } finally {
      replacementDecision = originalDecision;
    }
  });

  test("true native start failure preserves the saved project and its unsaved draft", async () => {
    await prepareCapture();
    const original = currentStudio().timelineDocument;
    const originalProject = currentStudio().projectQuery.data;
    const bridge = window as unknown as Record<string, unknown>;
    bridge.ggEngineStartRecording = async () => {
      throw new Error("Recorder failed to start");
    };
    const originalDecision = replacementDecision;
    replacementDecision = "discard";
    try {
      await expect(
        applyStudioAction(async (studio) => {
          await studio.toggleRecordingMutation.mutateAsync(undefined);
        }),
      ).rejects.toThrow();
      expect(currentStudio().timelineDocument).toEqual(original);
      expect(currentStudio().projectQuery.data).toEqual(originalProject);
      expect(currentStudio().canUndoTimeline).toBe(true);
    } finally {
      replacementDecision = originalDecision;
    }
  });

  test("duplicate recording commands during reconciliation do not start or stop another take", async () => {
    await prepareCapture();
    const bridge = window as unknown as Record<string, unknown>;
    const status = {
      isRunning: true,
      isRecording: true,
      recordingDurationSeconds: 0,
      recordingURL: "/tmp/one-take.mov",
      telemetry: {},
    };
    let starts = 0;
    let stops = 0;
    let release: ((value: unknown) => void) | undefined;
    bridge.ggEngineStartRecording = async () => {
      starts += 1;
      return status;
    };
    bridge.ggEngineStopRecording = async () => {
      stops += 1;
      return status;
    };
    bridge.ggEngineCaptureStatus = () =>
      new Promise((resolve) => {
        release = resolve;
      });
    bridge.ggEngineProjectCurrent = async () => ({
      recordingURL: "/tmp/one-take.mov",
      autoZoom: currentStudio().settingsForm.state.values.autoZoom,
      backgroundFraming: currentStudio().settingsForm.state.values.backgroundFraming,
      timeline: { version: 2, items: [] },
    });
    const originalDecision = replacementDecision;
    replacementDecision = "discard";
    try {
      let first: Promise<unknown> | undefined;
      await act(async () => {
        first = currentStudio().toggleRecordingMutation.mutateAsync(undefined);
      });
      await decideReplacement("discard");
      await waitFor(() => expect(currentStudio().recordingURL).toBe("/tmp/one-take.mov"));
      await applyStudioAction(async (studio) => {
        await studio.toggleRecordingMutation.mutateAsync(undefined);
      });
      expect(starts).toBe(1);
      expect(stops).toBe(0);
      if (!release || !first) {
        throw new Error("Recording reconciliation did not start");
      }
      await act(async () => {
        release?.(status);
        await first;
      });
    } finally {
      replacementDecision = originalDecision;
    }
  });
});

test("one visual slider gesture is one undo step and preserves earlier scene edits", async () => {
  await waitFor(() => expect(currentStudio().timelineDocument).toEqual(initialTimeline));
  const original = currentStudio().settingsForm.state.values.autoZoom;
  await applyStudioAction((studio) => {
    studio.selectTimelineClip({
      laneId: "video",
      clipId: "segment-0",
      startSeconds: 0,
      endSeconds: 4,
    });
    studio.setPlayheadSeconds(2);
    studio.splitSelectedTimelineClipAtPlayhead();
  });
  const splitTimeline = currentStudio().timelineDocument;
  await applyStudioAction((studio) => studio.beginVisualEdit());
  for (const intensity of [0.95, 0.9, 0.85, 0.8, 0.75]) {
    await applyStudioAction((studio) =>
      studio.settingsForm.setFieldValue("autoZoom", { ...original, intensity }),
    );
  }
  await applyStudioAction((studio) => studio.commitVisualEdit());
  expect(currentStudio().settingsForm.state.values.autoZoom.intensity).toBe(0.75);
  await applyStudioAction((studio) => studio.undoTimeline());
  expect(currentStudio().settingsForm.state.values.autoZoom).toEqual(original);
  expect(currentStudio().timelineDocument).toEqual(splitTimeline);
  await applyStudioAction((studio) => studio.undoTimeline());
  expect(currentStudio().timelineDocument).toEqual(initialTimeline);
  await applyStudioAction((studio) => studio.redoTimeline());
  await applyStudioAction((studio) => studio.redoTimeline());
  expect(currentStudio().settingsForm.state.values.autoZoom.intensity).toBe(0.75);
});

test("a finished recording remains authoritative when stopping the live preview fails", async () => {
  await waitFor(() => expect(currentStudio().timelineDocument).toEqual(initialTimeline));
  const saved = currentStudio().projectQuery.data!;
  const project = {
    recordingURL: saved.recordingURL,
    autoZoom: saved.autoZoom,
    backgroundFraming: saved.backgroundFraming,
    timeline: saved.timeline,
  };
  const stopped = {
    isRunning: true,
    isRecording: false,
    recordingDurationSeconds: 4,
    recordingURL: "/tmp/recording.mov",
    telemetry: {},
  };
  const bridge = window as unknown as Record<string, unknown>;
  bridge.ggEngineStopRecording = async () => stopped;
  bridge.ggEngineStopCapture = async () => {
    throw new Error("Preview cleanup unavailable");
  };
  bridge.ggEngineCaptureStatus = async () => stopped;
  bridge.ggEngineProjectCurrent = async () => project;
  await act(async () => {
    queryClient?.setQueryData(studioQueryKeys.projectCurrent(), project);
    queryClient?.setQueryData(studioQueryKeys.captureStatus(), { ...stopped, isRecording: true });
  });
  await applyStudioAction(async (studio) => {
    await studio.toggleRecordingMutation.mutateAsync(undefined);
  });
  await waitFor(() => {
    expect(currentStudio().captureStatusQuery.data?.isRecording).toBe(false);
    expect(currentStudio().recordingURL).toBe(stopped.recordingURL);
    expect(currentStudio().notice?.message).toContain(
      "Recording finished. The live preview could not stop.",
    );
  });
});

test("preview audio controls work by keyboard, survive Edit/Deliver remount and never edit export audio", async () => {
  await waitFor(() => expect(currentStudio().recordingURL).toBeTruthy());
  const bridge = window as unknown as Record<string, unknown>;
  bridge.ggResolveMediaSourceURL = async () =>
    new URL(healthyMediaSource, window.location.href).href;
  await act(async () => {
    currentStudio().setLastRoute("/edit");
    updatePreviewRoute?.("edit");
  });
  await waitFor(
    () => expect(document.querySelector("video")?.readyState).toBeGreaterThanOrEqual(2),
    5000,
  );
  const original = {
    timeline: currentStudio().timelineDocument,
    autoZoom: currentStudio().settingsForm.state.values.autoZoom,
    backgroundFraming: currentStudio().settingsForm.state.values.backgroundFraming,
  };
  const dirty = currentStudio().hasUnsavedProjectEdits;
  const volume = document.querySelector<HTMLInputElement>('input[aria-label="Preview volume"]')!;
  volume.focus();
  await userEvent.keyboard("{Home}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}");
  await waitFor(() => expect(document.querySelector("video")?.volume).toBeCloseTo(0.25));
  await page.getByRole("button", { name: "Mute preview", exact: true }).click();
  await waitFor(() => expect(document.querySelector("video")?.muted).toBe(true));
  await act(async () => {
    updatePreviewRoute?.(null);
  });
  await act(async () => {
    currentStudio().setLastRoute("/deliver");
    updatePreviewRoute?.("edit");
  });
  await waitFor(() => {
    const video = document.querySelector("video");
    expect(video?.readyState).toBeGreaterThanOrEqual(2);
    expect(video?.volume).toBeCloseTo(0.25);
    expect(video?.muted).toBe(true);
  }, 5000);
  expect(currentStudio().hasUnsavedProjectEdits).toBe(dirty);
  expect(currentStudio().timelineDocument).toEqual(original.timeline);
  expect(currentStudio().settingsForm.state.values.autoZoom).toEqual(original.autoZoom);
  expect(currentStudio().settingsForm.state.values.backgroundFraming).toEqual(
    original.backgroundFraming,
  );
  await applyStudioAction(async (studio) => {
    await studio.exportMutation.mutateAsync();
  });
  expect(capturedExportParams).toMatchObject(original);
  expect(capturedExportParams).not.toHaveProperty("previewAudio");
  expect(capturedExportParams).not.toHaveProperty("volume");
});

test("preview fullscreen targets the composed frame and transport, and reports a denied request", async () => {
  await waitFor(() => expect(currentStudio().recordingURL).toBeTruthy());
  const bridge = window as unknown as Record<string, unknown>;
  bridge.ggResolveMediaSourceURL = async () =>
    new URL(healthyMediaSource, window.location.href).href;
  await act(async () => {
    updatePreviewRoute?.("edit");
  });
  await waitFor(
    () => expect(document.querySelector("video")?.readyState).toBeGreaterThanOrEqual(2),
    5000,
  );
  const target = document.querySelector<HTMLDivElement>(
    '[data-testid="program-preview-fullscreen"]',
  )!;
  expect(target.querySelector('[data-testid="background-framing-stage"]')).not.toBeNull();
  expect(target.querySelector('input[aria-label="Preview volume"]')).not.toBeNull();
  try {
    await page.getByRole("button", { name: "Fullscreen preview", exact: true }).click();
    await waitFor(() => expect(document.fullscreenElement).toBe(target));
    await page.getByRole("button", { name: "Exit fullscreen", exact: true }).click();
    await waitFor(() => expect(document.fullscreenElement).toBeNull());
    Object.defineProperty(target, "requestFullscreen", {
      configurable: true,
      value: async () => {
        throw new DOMException("Denied", "NotAllowedError");
      },
    });
    await page.getByRole("button", { name: "Fullscreen preview", exact: true }).click();
    await expect
      .element(page.getByRole("alert"))
      .toHaveTextContent("Fullscreen is unavailable in this window.");
  } finally {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
  }
});

async function beginReplacement(action: (studio: StudioController) => Promise<unknown>) {
  let pending: Promise<unknown> = Promise.resolve();
  await act(async () => {
    pending = action(currentStudio());
    void pending.catch(() => {});
  });
  const dialog = page.getByTestId("replacement-confirmation");
  await expect.element(dialog).toBeVisible();
  return { pending, dialog };
}

describe("replacement confirmation interaction", () => {
  test("Escape keeps an edited project and selected export range without opening a picker", async () => {
    await waitFor(() => expect(currentStudio().timelineDocument).toEqual(initialTimeline));
    await applyStudioAction((studio) => {
      studio.settingsForm.setFieldValue("autoZoom", {
        ...studio.settingsForm.state.values.autoZoom,
        isEnabled: false,
      });
      studio.setTrimEndSeconds(2);
    });
    let picks = 0;
    (window as unknown as Record<string, unknown>).ggPickPath = async () => {
      picks += 1;
      return "/tmp/project.gglassproj";
    };
    const { pending, dialog } = await beginReplacement((studio) =>
      studio.openProjectMutation.mutateAsync(),
    );
    await expect
      .element(dialog.getByRole("button", { name: "Keep editing", exact: true }))
      .toHaveFocus();
    await act(() => {
      document.activeElement?.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          code: "Escape",
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    await pending;
    expect(picks).toBe(0);
    expect(currentStudio().settingsForm.state.values.autoZoom.isEnabled).toBe(false);
    expect(currentStudio().exportForm.state.values).toMatchObject({
      rangeMode: "selected",
      trimEndSeconds: 2,
    });
  });

  test("closing confirmation cancels, and another pending replacement cannot share approval", async () => {
    await waitFor(() => expect(currentStudio().timelineDocument).toEqual(initialTimeline));
    await applyStudioAction((studio) => studio.splitTimelineClipAtSeconds(1));
    const { pending, dialog } = await beginReplacement((studio) =>
      studio.openProjectMutation.mutateAsync(),
    );
    await applyStudioAction(async (studio) => {
      await studio.openRecentProjectMutation.mutateAsync("/tmp/other.gglassproj");
    });
    await expect.element(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await pending;
    expect(currentStudio().timelineDocument.items).toHaveLength(2);
    expect(currentStudio().canUndoTimeline).toBe(true);
  });

  test("confirmed same-package Open resets selected export range to Full program", async () => {
    await waitFor(() => expect(currentStudio().timelineDocument).toEqual(initialTimeline));
    const saved = currentStudio().projectQuery.data!;
    await applyStudioAction((studio) => {
      studio.splitTimelineClipAtSeconds(1);
      studio.setTrimEndSeconds(2);
    });
    const bridge = window as unknown as Record<string, unknown>;
    bridge.ggPickPath = async () => saved.projectPath;
    bridge.ggEngineProjectOpen = async () => saved;
    const { pending, dialog } = await beginReplacement((studio) =>
      studio.openProjectMutation.mutateAsync(),
    );
    await dialog.getByRole("button", { name: "Discard edits and open", exact: true }).click();
    await pending;
    await waitFor(() => expect(currentStudio().timelineDocument).toEqual(initialTimeline));
    expect(currentStudio().exportForm.state.values).toMatchObject({
      rangeMode: "full",
      trimStartSeconds: 0,
      trimEndSeconds: 0,
    });
    expect(currentStudio().canUndoTimeline).toBe(false);
  });

  test("bare pre-record appearance setup carries into the first take without a replacement prompt", async () => {
    await waitFor(() => expect(currentStudio().timelineDocument).toEqual(initialTimeline));
    const bridge = window as unknown as Record<string, unknown>;
    const empty = {
      autoZoom: currentStudio().settingsForm.state.values.autoZoom,
      backgroundFraming: defaultBackgroundFramingSettings,
      timeline: { version: 2, items: [] },
    };
    const ready = {
      isRunning: true,
      isRecording: false,
      recordingDurationSeconds: 0,
      telemetry: {},
    };
    await act(async () => {
      queryClient?.setQueryData(studioQueryKeys.projectCurrent(), empty);
      queryClient?.setQueryData(studioQueryKeys.captureStatus(), ready);
    });
    await applyStudioAction((studio) => studio.setLastRoute("/capture"));
    await waitFor(() => expect(currentStudio().recordingURL).toBeNull());
    await applyStudioAction((studio) =>
      studio.settingsForm.setFieldValue("autoZoom", {
        ...studio.settingsForm.state.values.autoZoom,
        isEnabled: false,
      }),
    );
    const recording = { ...ready, isRecording: true, recordingURL: "/tmp/first-take.mov" };
    bridge.ggEngineStartRecording = async () => recording;
    bridge.ggEngineCaptureStatus = async () => recording;
    bridge.ggEngineProjectCurrent = async () => ({ ...empty, recordingURL: "/tmp/first-take.mov" });
    await applyStudioAction(async (studio) => {
      await studio.toggleRecordingMutation.mutateAsync(undefined);
    });
    await expect.element(page.getByTestId("replacement-confirmation")).not.toBeInTheDocument();
    expect(currentStudio().recordingURL).toBe("/tmp/first-take.mov");
    expect(currentStudio().settingsForm.state.values.autoZoom.isEnabled).toBe(false);
  });
});

test("unmounting a pending replacement cancels before native project IO", async () => {
  await waitFor(() => expect(currentStudio().timelineDocument).toEqual(initialTimeline));
  await applyStudioAction((studio) => studio.splitTimelineClipAtSeconds(1));
  let picks = 0;
  (window as unknown as Record<string, unknown>).ggPickPath = async () => {
    picks += 1;
    return "/tmp/project.gglassproj";
  };
  const { pending } = await beginReplacement((studio) => studio.openProjectMutation.mutateAsync());
  await act(async () => {
    root?.unmount();
    root = undefined;
  });
  expect(await pending).toBeNull();
  expect(picks).toBe(0);
});

for (const openKind of ["open", "recent"] as const) {
  test(`export result remains on cancelled/failed open and clears after committed ${openKind}`, async () => {
    await waitFor(() => expect(currentStudio().recordingURL).toBeTruthy());
    await applyStudioAction(async (studio) => studio.exportMutation.mutateAsync());
    await act(async () => updatePreviewRoute?.("deliver"));
    await expect
      .element(page.getByRole("button", { name: "Open video", exact: true }))
      .toBeVisible();
    const saved = currentStudio().projectQuery.data!;
    const bridge = window as unknown as Record<string, unknown>;
    bridge.ggPickPath = async () => null;
    await applyStudioAction(async (studio) => studio.openProjectMutation.mutateAsync());
    expect(currentStudio().exportMutation.data?.status).toBe("succeeded");
    bridge.ggPickPath = async () => "/tmp/project-b.gglassproj";
    bridge.ggEngineProjectOpen = async () => {
      throw new Error("Open failed");
    };
    await expect(
      applyStudioAction(async (studio) => studio.openProjectMutation.mutateAsync()),
    ).rejects.toThrow();
    expect(currentStudio().exportMutation.data?.status).toBe("succeeded");
    bridge.ggEngineProjectOpen = async () => ({
      ...saved,
      projectPath: "/tmp/project-b.gglassproj",
    });
    await applyStudioAction(async (studio) =>
      openKind === "open"
        ? studio.openProjectMutation.mutateAsync()
        : studio.openRecentProjectMutation.mutateAsync("/tmp/project-b.gglassproj"),
    );
    await expect
      .element(page.getByRole("button", { name: "Open video", exact: true }))
      .not.toBeInTheDocument();
    expect(currentStudio().exportMutation.data).toBeUndefined();
  });
}

for (const target of [0.8, 0.5]) {
  test(`active preview scrubbing pauses and retains requested program position ${target}`, async () => {
    await waitFor(() => expect(currentStudio().recordingURL).toBeTruthy());
    const clip = initialTimeline.items[0]!;
    if (clip.kind !== "clip") {
      throw new Error("Expected clip");
    }
    const timeline: TimelineDocument = {
      version: 2,
      items: [
        { ...clip, sourceStartSeconds: 0.5, sourceEndSeconds: 0.9 },
        { kind: "gap", id: timelineSegmentIdSchema.make("scrub-gap"), durationSeconds: 0.2 },
        {
          ...clip,
          id: timelineSegmentIdSchema.make("scrub-second"),
          sourceStartSeconds: 0,
          sourceEndSeconds: 0.4,
        },
      ],
    };
    const bridge = window as unknown as Record<string, unknown>;
    bridge.ggResolveMediaSourceURL = async () =>
      new URL("../fixtures/timeline-seek.mp4", import.meta.url).href;
    await act(async () => {
      queryClient?.setQueryData(studioQueryKeys.projectCurrent(), {
        ...currentStudio().projectQuery.data,
        timeline,
      });
      updatePreviewRoute?.("edit");
    });
    await waitFor(
      () => expect(document.querySelector("video")?.readyState).toBeGreaterThanOrEqual(2),
      5000,
    );
    await page.getByRole("button", { name: "Play preview", exact: true }).click();
    await waitFor(() => {
      expect(currentStudio().playbackStore.getSnapshot().isPlaying).toBe(true);
      expect(document.querySelector("video")?.paused).toBe(false);
    });
    const slider = document.querySelector<HTMLInputElement>('input[aria-label="Playhead"]')!;
    slider.focus();
    await userEvent.keyboard("{Home}");
    await userEvent.keyboard("{ArrowRight}".repeat(target * 30));
    await waitFor(() => {
      expect(currentStudio().playbackStore.getSnapshot().isPlaying).toBe(false);
      expect(currentStudio().playbackStore.getSnapshot().playheadSeconds).toBeCloseTo(target, 4);
      if (target === 0.8) {
        expect(document.querySelector("video")?.currentTime).toBeCloseTo(0.2, 2);
      } else {
        expect(document.querySelector("video")?.style.visibility).toBe("hidden");
      }
    });
  });
}

for (const trailingGap of [false, true]) {
  test(`Play restarts a completed program with trailing gap ${trailingGap}`, async () => {
    await waitFor(() => expect(currentStudio().recordingURL).toBeTruthy());
    const clip = initialTimeline.items[0]!;
    if (clip.kind !== "clip") {
      throw new Error("Expected clip");
    }
    const timeline: TimelineDocument = {
      version: 2,
      items: [
        { ...clip, sourceStartSeconds: 0, sourceEndSeconds: 0.4 },
        ...(trailingGap
          ? [
              {
                kind: "gap" as const,
                id: timelineSegmentIdSchema.make("replay-gap"),
                durationSeconds: 0.2,
              },
            ]
          : []),
      ],
    };
    const bridge = window as unknown as Record<string, unknown>;
    bridge.ggResolveMediaSourceURL = async () =>
      new URL(healthyMediaSource, window.location.href).href;
    await act(async () => {
      queryClient?.setQueryData(studioQueryKeys.projectCurrent(), {
        ...currentStudio().projectQuery.data,
        timeline,
      });
      updatePreviewRoute?.("edit");
    });
    await waitFor(
      () => expect(document.querySelector("video")?.readyState).toBeGreaterThanOrEqual(2),
      5000,
    );
    for (const completion of ["seek", "natural"] as const) {
      if (completion === "seek") {
        await applyStudioAction((studio) => studio.setPlayheadSeconds(studio.timelineDuration));
      } else {
        await page.getByRole("button", { name: "Play preview", exact: true }).click();
        await waitFor(
          () => expect(currentStudio().playbackStore.getSnapshot().isPlaying).toBe(false),
          3000,
        );
      }
      expect(currentStudio().playbackStore.getSnapshot().playheadSeconds).toBeCloseTo(
        currentStudio().timelineDuration,
        4,
      );
      await page.getByRole("button", { name: "Play preview", exact: true }).click();
      await waitFor(() => {
        expect(currentStudio().playbackStore.getSnapshot().isPlaying).toBe(true);
        expect(currentStudio().playbackStore.getSnapshot().playheadSeconds).toBeLessThan(0.4);
        expect(document.querySelector("video")?.paused).toBe(false);
      });
      await page.getByRole("button", { name: "Pause preview", exact: true }).click();
    }
  });
}

test("refreshing native defaults before first Save preserves generated-source cuts and Undo", async () => {
  await prepareCapture();
  await applyStudioAction((studio) =>
    studio.settingsForm.setFieldValue("autoZoom", {
      ...studio.settingsForm.state.values.autoZoom,
      isEnabled: false,
    }),
  );
  const bridge = window as unknown as Record<string, unknown>;
  let recording = false;
  const status = () => ({
    isRunning: recording,
    isRecording: recording,
    recordingDurationSeconds: recording ? 0 : 8,
    recordingURL: "/tmp/fresh-history.mov",
    telemetry: {},
  });
  const native = {
    recordingURL: "/tmp/fresh-history.mov",
    autoZoom: { isEnabled: true, intensity: 1, minimumKeyframeInterval: 1 / 30 },
    backgroundFraming: defaultBackgroundFramingSettings,
    timeline: { version: 2, items: [] },
  };
  bridge.ggEngineStartRecording = async () => {
    recording = true;
    return status();
  };
  bridge.ggEngineStopRecording = async () => {
    recording = false;
    return status();
  };
  bridge.ggEngineStopCapture = async () => status();
  bridge.ggEngineCaptureStatus = async () => status();
  bridge.ggEngineProjectCurrent = async () => native;
  replacementDecision = "discard";
  await applyStudioAction(async (studio) => studio.toggleRecordingMutation.mutateAsync(undefined));
  await applyStudioAction(async (studio) => studio.toggleRecordingMutation.mutateAsync(undefined));
  await setInspectorMode("edit");
  await waitFor(() => expect(currentStudio().timelineDuration).toBe(8));
  await applyStudioAction((studio) => studio.splitTimelineClipAtSeconds(4));
  const first = currentTimelineClip(0);
  await applyStudioAction((studio) => {
    if (!studio.timelineRippleEnabled) {
      studio.toggleTimelineRipple();
    }
    studio.selectTimelineClip({
      laneId: "video",
      clipId: first.id,
      startSeconds: 0,
      endSeconds: 4,
    });
  });
  await applyStudioAction((studio) => studio.deleteSelectedTimelineClip());
  const edited = currentStudio().timelineDocument;
  expect(currentStudio().timelineDuration).toBe(4);
  await applyStudioAction(async (studio) => studio.refreshAll());
  expect(currentStudio().timelineDocument).toEqual(edited);
  expect(currentStudio().settingsForm.state.values.autoZoom.isEnabled).toBe(false);
  expect(currentStudio().canUndoTimeline).toBe(true);
  await applyStudioAction(async (studio) => studio.exportMutation.mutateAsync());
  expect(capturedExportTimeline()).toEqual(edited);
  await applyStudioAction((studio) => studio.undoTimeline());
  expect(currentStudio().timelineDuration).toBe(8);
  await applyStudioAction((studio) => studio.redoTimeline());
  expect(currentStudio().timelineDocument).toEqual(edited);
  await applyStudioAction(async (studio) => studio.saveProjectMutation.mutateAsync(true));
  expect(capturedSaveParams).toMatchObject({ timeline: edited, autoZoom: { isEnabled: false } });
});

function visibleInspectorRow(label: string) {
  return Array.from(document.querySelectorAll(".gg-inspector-detail-row")).find(
    (row) => row.firstElementChild?.textContent === label,
  )?.textContent;
}

test("Undo of a selected split scene returns to the project inspector", async () => {
  await waitFor(() => expect(currentStudio().timelineDocument).toEqual(initialTimeline));
  await setInspectorMode("edit");
  await applyStudioAction((studio) => studio.splitTimelineClipAtSeconds(2));
  const right = currentTimelineClip(1);
  await applyStudioAction((studio) =>
    studio.selectTimelineClip({
      laneId: "video",
      clipId: right.id,
      startSeconds: 2,
      endSeconds: 4,
    }),
  );
  await expect.element(page.getByRole("button", { name: "Scene 2", exact: true })).toBeVisible();
  await applyStudioAction((studio) => studio.undoTimeline());
  expect(currentStudio().inspectorSelection.kind).toBe("none");
  await expect.element(page.getByText("Project appearance", { exact: true })).toBeVisible();
  await expect
    .element(page.getByRole("button", { name: "Scene 2", exact: true }))
    .not.toBeInTheDocument();
});

test("Undo and Redo derive a surviving scene's visible inspector timing from the current timeline", async () => {
  await waitFor(() => expect(currentStudio().timelineDocument).toEqual(initialTimeline));
  const a = currentTimelineClip(0);
  const b = {
    ...a,
    id: timelineSegmentIdSchema.make("surviving-scene"),
    sourceStartSeconds: 4,
    sourceEndSeconds: 10,
  };
  await act(async () =>
    queryClient?.setQueryData(studioQueryKeys.projectCurrent(), {
      ...currentStudio().projectQuery.data,
      timeline: { version: 2, items: [a, b] },
    }),
  );
  await setInspectorMode("edit");
  await applyStudioAction((studio) => {
    if (!studio.timelineRippleEnabled) {
      studio.toggleTimelineRipple();
    }
    studio.selectTimelineClip({ laneId: "video", clipId: a.id, startSeconds: 0, endSeconds: 4 });
  });
  await applyStudioAction((studio) => studio.deleteSelectedTimelineClip());
  await applyStudioAction((studio) =>
    studio.selectTimelineClip({ laneId: "video", clipId: b.id, startSeconds: 0, endSeconds: 6 }),
  );
  await applyStudioAction((studio) => studio.undoTimeline());
  await waitFor(() => {
    expect(visibleInspectorRow("Start")).toBe("Start4.00s");
    expect(visibleInspectorRow("End")).toBe("End10.00s");
  });
  await applyStudioAction((studio) => studio.redoTimeline());
  await waitFor(() => {
    expect(visibleInspectorRow("Start")).toBe("Start0.00s");
    expect(visibleInspectorRow("End")).toBe("End6.00s");
  });
});
