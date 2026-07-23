import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HotkeysProvider } from "@tanstack/react-hotkeys";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import type { TimelineDocument } from "@guerillaglass/engine-contract/shared/valueObjects";
import {
  useStudioController,
  type StudioController,
} from "../../src/mainview/app/studio/hooks/core/useStudioController";

const initialTimeline: TimelineDocument = {
  version: 2,
  items: [
    {
      kind: "clip",
      id: "segment-0",
      sourceAssetId: "recording",
      sourceStartSeconds: 0,
      sourceEndSeconds: 4,
    },
  ],
};

let root: Root | undefined;
let queryClient: QueryClient | undefined;
let latestStudio: StudioController | null = null;
let capturedExportParams: unknown = null;

function installMockBridge() {
  const bridgeWindow = window as unknown as Record<string, unknown>;
  bridgeWindow.ggEnginePing = async () => ({
    app: "guerillaglass-engine",
    engineVersion: "0.1.0",
    protocolVersion: "1.0.0",
    platform: "darwin",
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
    timeline: initialTimeline,
  });
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

function StudioHarness({ onStudio }: { onStudio: (studio: StudioController) => void }) {
  const studio = useStudioController();
  useEffect(() => {
    onStudio(studio);
  }, [onStudio, studio]);
  return null;
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

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  capturedExportParams = null;
  latestStudio = null;
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
  document.body.innerHTML = "";
});

describe("editor timeline export integration", () => {
  test("drag-drop ripple move commits order, clears selection, moves playhead, and exports", async () => {
    await waitFor(() =>
      expect(latestStudio?.timelineDocument.items).toEqual(initialTimeline.items),
    );
    await applyStudioAction((studio) => studio.splitTimelineClipAtSeconds(1));
    await waitFor(() => expect(latestStudio?.timelineDocument.items).toHaveLength(2));

    const movedClip = latestStudio!.timelineDocument.items[0];
    expect(movedClip?.kind).toBe("clip");
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

    await applyStudioAction(async (studio) => studio.exportMutation.mutateAsync());
    expect((capturedExportParams as { timeline: TimelineDocument }).timeline).toEqual(
      latestStudio!.timelineDocument,
    );
  });

  test("drag-drop non-ripple move splits gaps and synchronizes selection and playhead", async () => {
    await waitFor(() =>
      expect(latestStudio?.timelineDocument.items).toEqual(initialTimeline.items),
    );
    await applyStudioAction((studio) => studio.splitTimelineClipAtSeconds(1));
    await waitFor(() => expect(latestStudio?.timelineDocument.items).toHaveLength(2));

    const liftedClip = latestStudio!.timelineDocument.items[1];
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

    const movedClip = latestStudio!.timelineDocument.items[1];
    const destinationGap = latestStudio!.timelineDocument.items[2];
    expect(movedClip?.kind).toBe("clip");
    expect(destinationGap?.kind).toBe("gap");
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
    expect((capturedExportParams as { timeline: TimelineDocument }).timeline).toEqual(
      latestStudio!.timelineDocument,
    );
  });

  test("exports the timeline produced by split, lift, move, and delete controller actions", async () => {
    await waitFor(() => {
      expect(latestStudio?.timelineDocument.items).toEqual(initialTimeline.items);
      expect(latestStudio?.selectedPreset?.id).toBe("h264-1080p-30");
    });

    await applyStudioAction((studio) => studio.splitTimelineClipAtSeconds(1));
    await waitFor(() => expect(latestStudio?.timelineDocument.items).toHaveLength(2));

    const liftedClip = latestStudio!.timelineDocument.items[1];
    expect(liftedClip?.kind).toBe("clip");
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

    if (!latestStudio!.timelineRippleEnabled) {
      await applyStudioAction((studio) => studio.toggleTimelineRipple());
      await waitFor(() => expect(latestStudio?.timelineRippleEnabled).toBe(true));
    }

    const movedClip = latestStudio!.timelineDocument.items[1];
    expect(movedClip?.kind).toBe("clip");
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

    const deletedClip = latestStudio!.timelineDocument.items[2];
    expect(deletedClip?.kind).toBe("clip");
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
      timeline: latestStudio!.timelineDocument,
    });
    expect((capturedExportParams as { timeline: TimelineDocument }).timeline.items).toEqual([
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
