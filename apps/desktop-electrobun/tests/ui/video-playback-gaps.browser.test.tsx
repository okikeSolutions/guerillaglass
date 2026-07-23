import { act, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { compileTimelineItems } from "../../src/mainview/app/studio/domain/timelineDomainModel";
import { useVideoPlaybackSync } from "../../src/mainview/app/studio/hooks/useVideoPlaybackSync";
import { createPlaybackTransportStore } from "../../src/mainview/app/studio/hooks/timeline/usePlaybackTransport";

const timelineItems = compileTimelineItems({
  version: 2,
  items: [
    { kind: "gap", id: "leading", durationSeconds: 0.5 },
    {
      kind: "clip",
      id: "clip-a",
      sourceAssetId: "recording",
      sourceStartSeconds: 0,
      sourceEndSeconds: 1,
    },
    { kind: "gap", id: "middle", durationSeconds: 1 },
    {
      kind: "clip",
      id: "clip-b",
      sourceAssetId: "recording",
      sourceStartSeconds: 1,
      sourceEndSeconds: 2,
    },
    { kind: "gap", id: "trailing", durationSeconds: 0.5 },
  ],
});
const timelineDuration = 4;

let root: Root | undefined;
let now = 0;
let nextFrame: FrameRequestCallback | null = null;
const playbackStore = createPlaybackTransportStore({
  durationSeconds: timelineDuration,
  frameRate: 30,
});

function Harness({
  items = timelineItems,
  duration = timelineDuration,
}: {
  items?: typeof timelineItems;
  duration?: number;
}) {
  const mediaRef = useRef<HTMLVideoElement>(null);
  useVideoPlaybackSync({
    mediaRef,
    playbackStore,
    recordingMediaSource: "recording",
    timelineItems: items,
    timelineDuration: duration,
    setTimelinePlaybackActive: (active) => (active ? playbackStore.play() : playbackStore.pause()),
    setDisplayPlayheadSecondsFromMedia: playbackStore.setDisplayTimeSeconds,
    setPlayheadSecondsFromMedia: playbackStore.seek,
  });
  return <video ref={mediaRef} />;
}

function runFrame(atMs: number) {
  const frame = nextFrame;
  if (!frame) {
    throw new Error("Playback frame was not scheduled");
  }
  nextFrame = null;
  now = atMs;
  act(() => frame(atMs));
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  now = 0;
  nextFrame = null;
  playbackStore.pause();
  playbackStore.updateConfig({ durationSeconds: timelineDuration, frameRate: 30 });
  playbackStore.seek(0);
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    nextFrame = callback;
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {
    nextFrame = null;
  });
  document.body.innerHTML = '<div id="root"></div>';
  root = createRoot(document.getElementById("root")!);
  act(() => root?.render(<Harness />));
  const media = document.querySelector("video")!;
  vi.spyOn(media, "play").mockResolvedValue(undefined);
  vi.spyOn(media, "pause").mockImplementation(() => {});
});

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("timeline preview across gaps", () => {
  test("paused seeks into a gap hide the media without remapping source time", () => {
    const media = document.querySelector("video")!;
    media.currentTime = 0.25;

    act(() => playbackStore.seek(2));

    expect(media.style.visibility).toBe("hidden");
    expect(media.currentTime).toBe(0.25);
  });

  test("leading gap advances into a clip, seeks its source, and resumes preview", () => {
    const media = document.querySelector("video")!;
    act(() => playbackStore.play());

    runFrame(600);
    runFrame(600);

    expect(playbackStore.getSnapshot().playheadSeconds).toBeCloseTo(0.6);
    expect(media.currentTime).toBeCloseTo(0.1);
    expect(media.style.visibility).toBe("");
    expect(media.play).toHaveBeenCalled();
  });

  test("clip to interstitial gap hides media, then gap to clip seeks and resumes", () => {
    const media = document.querySelector("video")!;
    media.currentTime = 0.99;
    act(() => {
      playbackStore.seek(1.49);
      playbackStore.play();
    });

    runFrame(20);
    expect(playbackStore.getSnapshot().playheadSeconds).toBeCloseTo(1.5);
    expect(media.style.visibility).toBe("hidden");

    runFrame(1020);
    runFrame(1020);
    expect(playbackStore.getSnapshot().playheadSeconds).toBeCloseTo(2.5);
    expect(media.currentTime).toBeCloseTo(1);
    expect(media.style.visibility).toBe("");
    expect(media.play).toHaveBeenCalled();
  });

  test("native source ended enters a remaining gap instead of ending the program", () => {
    const media = document.querySelector("video")!;
    act(() => playbackStore.seek(1.49));

    act(() => media.dispatchEvent(new Event("ended")));

    expect(playbackStore.getSnapshot().playheadSeconds).toBeCloseTo(1.5);
    expect(playbackStore.getSnapshot().playheadSeconds).not.toBe(timelineDuration);
    expect(media.style.visibility).toBe("hidden");
  });

  test("a queued native ended event at an exact gap boundary does not end the program", () => {
    const media = document.querySelector("video")!;
    act(() => playbackStore.seek(1.5));

    act(() => media.dispatchEvent(new Event("ended")));

    expect(playbackStore.getSnapshot().playheadSeconds).toBe(1.5);
    expect(media.style.visibility).toBe("hidden");
  });

  test("native source ended seeks a following clip when no gap separates it", () => {
    const directItems = compileTimelineItems({
      version: 2,
      items: [
        {
          kind: "clip",
          id: "source-ending",
          sourceAssetId: "recording",
          sourceStartSeconds: 1,
          sourceEndSeconds: 2,
        },
        {
          kind: "clip",
          id: "following",
          sourceAssetId: "recording",
          sourceStartSeconds: 0,
          sourceEndSeconds: 1,
        },
      ],
    });
    playbackStore.updateConfig({ durationSeconds: 2, frameRate: 30 });
    act(() => root?.render(<Harness items={directItems} duration={2} />));
    const media = document.querySelector("video")!;
    media.currentTime = 2;
    act(() => playbackStore.seek(1));

    act(() => media.dispatchEvent(new Event("ended")));

    expect(playbackStore.getSnapshot().playheadSeconds).toBe(1);
    expect(media.currentTime).toBe(0);
    expect(media.play).toHaveBeenCalled();
  });

  test("a reordered timeline seeks paused preview through the recompiled source mapping", () => {
    const reorderedItems = compileTimelineItems({
      version: 2,
      items: [
        {
          kind: "clip",
          id: "second-source-first",
          sourceAssetId: "recording",
          sourceStartSeconds: 1,
          sourceEndSeconds: 2,
        },
        {
          kind: "clip",
          id: "first-source-second",
          sourceAssetId: "recording",
          sourceStartSeconds: 0,
          sourceEndSeconds: 1,
        },
      ],
    });
    playbackStore.updateConfig({ durationSeconds: 2, frameRate: 30 });
    act(() => root?.render(<Harness items={reorderedItems} duration={2} />));
    const media = document.querySelector("video")!;

    act(() => playbackStore.seek(0.25));

    expect(media.currentTime).toBeCloseTo(1.25);
    expect(media.style.visibility).toBe("");
  });

  test("trailing gap advances for its full duration before playback stops", () => {
    const media = document.querySelector("video")!;
    media.currentTime = 1.99;
    act(() => {
      playbackStore.seek(3.49);
      playbackStore.play();
    });

    runFrame(20);
    expect(playbackStore.getSnapshot().playheadSeconds).toBeCloseTo(3.5);
    expect(media.style.visibility).toBe("hidden");

    runFrame(520);
    expect(playbackStore.getSnapshot().playheadSeconds).toBe(4);
    expect(playbackStore.getSnapshot().isPlaying).toBe(false);
  });
});
