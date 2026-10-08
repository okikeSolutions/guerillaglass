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
import { exportRunPayloadSchema } from "@guerillaglass/engine-contract/httpApi";
import { decodeUnknownWithSchemaSync } from "@guerillaglass/engine-client/schemaContracts";
import {
  useStudioController,
  type StudioController,
} from "../../src/mainview/app/studio/hooks/core/useStudioController";
import type { StudioMode } from "../../src/mainview/app/studio/domain/inspectorSelectionModel";
import { studioQueryKeys } from "../../src/mainview/app/studio/hooks/core/useStudioDataQueries";
import { StudioProvider } from "../../src/mainview/app/studio/state/StudioProvider";
import { InspectorPanel } from "../../src/mainview/app/studio/panels/InspectorPanel";

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
let capturedExportParams: unknown = null;
let capturedSaveParams: unknown = null;

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
    inputMonitoring: "authorized",
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
    eventsURL: null,
    telemetry: null,
  });
  bridgeWindow.ggEngineCapturePreviewFrame = async () => ({ previewFrameURL: null });
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
    return {
      projectPath: "/tmp/project.gglassproj",
      recordingURL: "/tmp/recording.mov",
      autoZoom: { isEnabled: true, intensity: 1, minimumKeyframeInterval: 1 / 30 },
      backgroundFraming: defaultBackgroundFramingSettings,
      timeline: initialTimeline,
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
      <InspectorPanel mode={mode} />
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
    updateInspectorMode(mode);
  });
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
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
  queryClient?.clear();
  root = undefined;
  queryClient = undefined;
  latestStudio = null;
  updateInspectorMode = null;
  document.body.innerHTML = "";
});

describe("editor timeline export integration", () => {
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
    await expect.element(page.getByText("Selected Clip")).toBeVisible();
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
    await page.getByRole("button", { name: "CAPTURE" }).click();
    const captureFps = page.getByRole("combobox", { name: "Capture FPS" });
    await expect.element(captureFps).toBeVisible();
    await waitFor(() => expect(latestStudio?.settingsForm.state.values.captureFps).toBe(30));
    const microphone = page.getByRole("checkbox", { name: "Include microphone" });
    await microphone.click();
    await waitFor(() => expect(latestStudio?.settingsForm.state.values.micEnabled).toBe(true));
    await expect.element(microphone).toBeChecked();
  });

  test("records and resets a shortcut override from the advanced inspector", async () => {
    await waitFor(() =>
      expect(latestStudio?.timelineDocument.items).toEqual(initialTimeline.items),
    );
    await setInspectorMode("capture");
    await page.getByRole("button", { name: "ADVANCED" }).click();

    const saveShortcutRecordButton = page.getByRole("button", { name: "Record" }).nth(4);
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
    const resetSaveShortcut = page.getByRole("button", { name: "Reset" }).nth(4);
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
