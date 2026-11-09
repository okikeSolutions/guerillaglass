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
import { page } from "vitest/browser";
import { timelineSegmentIdSchema } from "@guerillaglass/engine-contract/schema-primitives";
import {
  defaultBackgroundFramingSettings,
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
import { ProgramPreview } from "../../src/mainview/app/studio/routes/ProgramPreview";
const healthyMediaSource = new URL("../fixtures/timeline-red.mp4", import.meta.url).href;

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
let updatePreviewRoute: ((route: "capture" | "edit" | null) => void) | null = null;
let capturedExportParams: unknown = null;
let capturedSaveParams: unknown = null;
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
  bridgeWindow.ggEngineCaptureStatus = async () => ({
    isRunning: false,
    isRecording: false,
    recordingDurationSeconds: 4,
    recordingURL: "/tmp/recording.mov",
    telemetry: {},
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
  const [previewRoute, setPreviewRoute] = useState<"capture" | "edit" | null>(null);
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
      <div style={{ height: 800, display: "flex", flexDirection: "column" }}>
        <StudioPreferences />
        {previewRoute === "capture" ? (
          <CaptureRoute />
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

async function applyStudioAction(action: (studio: StudioController) => void | Promise<void>) {
  await act(async () => {
    if (!latestStudio) {
      throw new Error("Studio controller has not rendered.");
    }
    await action(latestStudio);
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
      items: [{ ...first, camera: [] }],
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
      autoZoom: currentStudio().settingsForm.state.values.autoZoom,
      backgroundFraming: currentStudio().settingsForm.state.values.backgroundFraming,
      timeline: { version: 2, items: [] },
    });
    await act(async () => {
      queryClient?.setQueryData(studioQueryKeys.captureStatus(), {
        ...currentStudio().captureStatusQuery.data,
        isRunning: true,
        isRecording: false,
      });
    });
    const originalConfirm = window.confirm;
    window.confirm = () => true;
    try {
      await applyStudioAction(async (studio) => {
        await studio.toggleRecordingMutation.mutateAsync(undefined);
      });
      await waitFor(() => {
        expect(currentStudio().recordingURL).toBe("/tmp/new-take.mov");
        expect(currentStudio().projectQuery.data?.projectPath).toBeUndefined();
        expect(currentStudio().timelineDocument.items).toHaveLength(0);
        expect(currentStudio().canUndoTimeline).toBe(false);
      });
    } finally {
      window.confirm = originalConfirm;
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
  const originalConfirm = window.confirm;
  let prompts = 0;
  let opened = false;
  const bridge = window as unknown as Record<string, unknown>;
  bridge.ggEngineProjectOpen = async () => {
    opened = true;
    return currentStudio().projectQuery.data;
  };
  window.confirm = () => {
    prompts += 1;
    return false;
  };
  try {
    await applyStudioAction(async (studio) => {
      await studio.openRecentProjectMutation.mutateAsync("/tmp/other.gglassproj");
    });
    expect(prompts).toBe(1);
    expect(opened).toBe(false);
    expect(currentStudio().settingsForm.state.values.backgroundFraming.enabled).toBe(true);
  } finally {
    window.confirm = originalConfirm;
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
  const originalConfirm = window.confirm;
  let prompts = 0;
  window.confirm = () => {
    prompts += 1;
    return false;
  };
  try {
    await applyStudioAction(async (studio) => {
      await studio.openProjectMutation.mutateAsync();
    });
    await applyStudioAction(async (studio) => {
      await studio.toggleRecordingMutation.mutateAsync(undefined);
    });
    expect(prompts).toBe(2);
    expect(currentStudio().recordingURL).toBe("/tmp/recording.mov");
  } finally {
    window.confirm = originalConfirm;
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
