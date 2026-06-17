import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import type { TimelineLane } from "../../src/mainview/app/studio/domain/timelineDomainModel";
import { createPlaybackTransportStore } from "../../src/mainview/app/studio/hooks/timeline/usePlaybackTransport";
import type { StudioController } from "../../src/mainview/app/studio/hooks/core/useStudioController";
import { StudioProvider } from "../../src/mainview/app/studio/state/StudioProvider";
import { TimelineSurface } from "../../src/mainview/app/studio/panels/TimelineSurface";

type MoveDropParams = Parameters<
  NonNullable<Parameters<typeof TimelineSurface>[0]["onMoveClipDrop"]>
>[0];

const labels = {
  playhead: "Playhead",
  trimInSeconds: "Trim in",
  trimOutSeconds: "Trim out",
  timelineTools: "Timeline tools",
  timelineSnap: "Snap",
  timelineRipple: "Ripple",
  timelineZoom: "Zoom",
  timelineLaneLock: "Lock lane",
  timelineLaneMute: "Mute lane",
  timelineLaneSolo: "Solo lane",
  timelineMarkerMove: "Move",
  timelineMarkerClick: "Click",
  timelineMarkerMixed: "Mixed",
  timelineClipAria: (laneLabel: string, startSeconds: number, endSeconds: number) =>
    `${laneLabel} clip ${startSeconds}-${endSeconds}`,
  timelineMarkerAria: (markerKindLabel: string, timestampSeconds: number) =>
    `${markerKindLabel} marker ${timestampSeconds}`,
};

function makeLanes(): TimelineLane[] {
  const clips = [
    {
      id: "clip-a",
      startSeconds: 0,
      endSeconds: 1,
      sourceStartSeconds: 0,
      sourceEndSeconds: 1,
      semantic: "screen" as const,
      waveform: null,
    },
    {
      id: "gap-a",
      startSeconds: 1,
      endSeconds: 2,
      sourceStartSeconds: 0,
      sourceEndSeconds: 0,
      semantic: "gap" as const,
      waveform: null,
    },
    {
      id: "clip-b",
      startSeconds: 2,
      endSeconds: 3,
      sourceStartSeconds: 2,
      sourceEndSeconds: 3,
      semantic: "screen" as const,
      waveform: null,
    },
  ];
  return [
    { id: "video", label: "Video", clips, markers: [] },
    {
      id: "audio",
      label: "Audio",
      clips: clips.map((clip) => ({ ...clip, semantic: clip.semantic === "gap" ? "gap" : "mix" })),
      markers: [],
    },
    { id: "events", label: "Events", clips: [], markers: [] },
  ];
}

function pointer(type: string, clientX: number): PointerEvent {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX,
    pointerId: 1,
    pointerType: "mouse",
  });
}

let root: Root | undefined;
let receivedDrop: MoveDropParams | null = null;
let originalGetBoundingClientRect: typeof Element.prototype.getBoundingClientRect;

function renderSurface(
  timelineRippleEnabled: boolean,
  options?: {
    laneLocked?: boolean;
    timelineTool?: "select" | "trim" | "blade";
    onSelectClip?: () => void;
  },
) {
  const playbackStore = createPlaybackTransportStore({ durationSeconds: 3, frameRate: 30 });
  const studio = { playbackStore } as unknown as StudioController;
  act(() => {
    root?.render(
      <StudioProvider value={studio}>
        <TimelineSurface
          durationSeconds={3}
          zoomPercent={100}
          timelineTool={options?.timelineTool ?? "select"}
          timelineSnapEnabled={true}
          timelineRippleEnabled={timelineRippleEnabled}
          lanes={makeLanes()}
          laneControls={{
            video: { locked: options?.laneLocked ?? false, muted: false, solo: false },
            audio: { locked: false, muted: false, solo: false },
          }}
          labels={labels}
          onSetPlayheadSeconds={() => {}}
          onNudgePlayheadSeconds={() => {}}
          onToggleLaneLocked={() => {}}
          onToggleLaneMuted={() => {}}
          onToggleLaneSolo={() => {}}
          onClearSelection={() => {}}
          onMoveClipDrop={(params) => {
            receivedDrop = params;
          }}
          selectedClip={null}
          selectedMarkerId={null}
          onSelectClip={options?.onSelectClip ?? (() => {})}
          onSelectMarker={() => {}}
        />
      </StudioProvider>,
    );
  });
}

function getTimelineDragElements() {
  const rootElement = document.getElementById("root");
  const surface = rootElement?.querySelector(".gg-timeline-surface");
  const clip = rootElement?.querySelector(
    ".gg-timeline-clip-video.gg-timeline-clip-semantic-screen",
  );
  if (!surface || !clip) {
    throw new Error("Timeline drag fixture did not render");
  }
  return { clip, surface };
}

function dragFirstVideoClip(fromClientX: number, toClientX: number) {
  const { clip, surface } = getTimelineDragElements();

  act(() => {
    clip.dispatchEvent(pointer("pointerdown", fromClientX));
    surface.dispatchEvent(pointer("pointermove", toClientX));
    surface.dispatchEvent(pointer("pointerup", toClientX));
  });
}

function moveFirstVideoClipWithoutRelease(fromClientX: number, toClientX: number) {
  const { clip, surface } = getTimelineDragElements();

  act(() => {
    clip.dispatchEvent(pointer("pointerdown", fromClientX));
    surface.dispatchEvent(pointer("pointermove", toClientX));
  });
}

beforeEach(() => {
  receivedDrop = null;
  document.body.innerHTML = '<div id="root"></div>';
  root = createRoot(document.getElementById("root")!);
  originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function () {
    if ((this as Element).classList.contains("gg-timeline-track-overlay")) {
      return DOMRect.fromRect({ x: 100, y: 0, width: 900, height: 120 });
    }
    if ((this as Element).classList.contains("gg-timeline-clip")) {
      return DOMRect.fromRect({ x: 100, y: 0, width: 300, height: 48 });
    }
    return originalGetBoundingClientRect.call(this);
  };
});

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  document.body.innerHTML = "";
});

describe("timeline clip drag move", () => {
  test("ripple drag resolves an insertion destination index", () => {
    renderSurface(true);

    dragFirstVideoClip(120, 980);

    expect(receivedDrop).toEqual({ clipId: "clip-a", destinationIndex: 3 });
  });

  test("non-ripple drag resolves a destination gap", () => {
    renderSurface(false);

    dragFirstVideoClip(120, 520);

    expect(receivedDrop).toEqual({ clipId: "clip-a", destinationGapId: "gap-a" });
  });

  test("non-ripple drag resolves a nearby gap boundary", () => {
    renderSurface(false);

    dragFirstVideoClip(120, 402);

    expect(receivedDrop).toEqual({ clipId: "clip-a", destinationGapId: "gap-a" });
  });

  test("non-ripple drag outside gaps is invalid and does not move", () => {
    renderSurface(false);

    moveFirstVideoClipWithoutRelease(120, 850);

    expect(document.querySelector(".gg-timeline-drop-invalid")).not.toBeNull();
    act(() => {
      document.querySelector(".gg-timeline-surface")?.dispatchEvent(pointer("pointerup", 850));
    });
    expect(receivedDrop).toBeNull();
  });

  test("locked lanes block clip drag", () => {
    renderSurface(true, { laneLocked: true });

    dragFirstVideoClip(120, 980);

    expect(receivedDrop).toBeNull();
  });

  test("gap items are not draggable", () => {
    renderSurface(true);
    const surface = document.querySelector(".gg-timeline-surface");
    const gap = document.querySelector(".gg-timeline-clip-video.gg-timeline-clip-semantic-gap");
    if (!surface || !gap) {
      throw new Error("Timeline gap drag fixture did not render");
    }

    act(() => {
      gap.dispatchEvent(pointer("pointerdown", 420));
      surface.dispatchEvent(pointer("pointermove", 980));
      surface.dispatchEvent(pointer("pointerup", 980));
    });

    expect(receivedDrop).toBeNull();
  });

  test("dragging suppresses the follow-up clip click", () => {
    let selectedCount = 0;
    renderSurface(true, {
      onSelectClip: () => {
        selectedCount += 1;
      },
    });
    const { clip } = getTimelineDragElements();

    dragFirstVideoClip(120, 980);
    act(() => {
      clip.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });

    expect(receivedDrop).toEqual({ clipId: "clip-a", destinationIndex: 3 });
    expect(selectedCount).toBe(0);
  });

  test("dragging renders drop affordances at the resolved insert boundary", () => {
    renderSurface(true);

    moveFirstVideoClipWithoutRelease(120, 980);

    const insertAffordance = document.querySelector<HTMLElement>(
      "[data-testid='timeline-drop-insert']",
    );
    expect(insertAffordance).not.toBeNull();
    expect(insertAffordance?.style.left).toBe("100%");
  });
});
