import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { useTimelineWaveform } from "../../src/mainview/app/studio/hooks/timeline/useTimelineWaveform";
import {
  buildTimelineLanes,
  createSingleSegmentTimelineDocument,
} from "../../src/mainview/app/studio/domain/timelineDomainModel";
import {
  readEmbeddedAudioTrackCount,
  type SourceAudioPresentation,
} from "../../src/mainview/app/studio/domain/sourceAudioPresentation";
import { TimelineSurface } from "../../src/mainview/app/studio/panels/TimelineSurface";

const tone = new URL("../fixtures/source-tone.wav", import.meta.url).href;
const silence = new URL("../fixtures/source-silence.wav", import.meta.url).href;
const noAudio = new URL("../fixtures/timeline-red.mp4", import.meta.url).href;
let root: Root | undefined;
let queryClient: QueryClient;
let latest: SourceAudioPresentation | null = null;
let resolveSource: () => Promise<string>;

function Probe({ trackCount = null }: { trackCount?: number | null }) {
  const audio = useTimelineWaveform({
    recordingURL: "/fixture/audio.mov",
    recordingDurationSeconds: 0.4,
    timelineEvents: [],
    embeddedAudioTrackCount: trackCount,
  });
  useEffect(() => {
    latest = audio;
  }, [audio]);
  const lanes = buildTimelineLanes({
    timeline: createSingleSegmentTimelineDocument(0.4),
    events: [],
    audioWaveform: audio.waveform,
    audioStatus: audio.status,
  });
  return (
    <TimelineSurface
      durationSeconds={0.4}
      playheadSeconds={0}
      zoomPercent={100}
      timelineTool="select"
      timelineSnapEnabled={true}
      timelineRippleEnabled={false}
      lanes={lanes}
      audioStatusText={audio.status}
      audioScopeText="Embedded source audio only"
      laneControls={{
        video: { locked: false, muted: false, solo: false },
        audio: { locked: false, muted: false, solo: false },
      }}
      labels={{
        playhead: "Playhead",
        trimInSeconds: "In",
        trimOutSeconds: "Out",
        timelineTools: "Tools",
        timelineSnap: "Snap",
        timelineRipple: "Ripple",
        timelineZoom: "Zoom",
        timelineLaneLock: "Lock",
        timelineMarkerMove: "Move",
        timelineMarkerClick: "Click",
        timelineMarkerMixed: "Mixed",
        timelineClipAria: (lane, start, end) => `${lane} ${start}-${end}`,
        timelineGapAria: (lane, start, end) => `${lane} gap ${start}-${end}`,
        timelineMarkerAria: (kind, time) => `${kind} ${time}`,
      }}
      onSetPlayheadSeconds={() => {}}
      onNudgePlayheadSeconds={() => {}}
      onToggleLaneLocked={() => {}}
      onClearSelection={() => {}}
      selectedClip={null}
      selectedMarkerId={null}
      onSelectClip={() => {}}
      onSelectMarker={() => {}}
    />
  );
}

async function mount(trackCount: number | null = null) {
  await act(async () =>
    root?.render(
      <QueryClientProvider client={queryClient}>
        <Probe trackCount={trackCount} />
      </QueryClientProvider>,
    ),
  );
}

beforeEach(() => {
  latest = null;
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const bridge = window as unknown as Record<string, unknown>;
  bridge.ggGrantMediaSourceCapability = async () => "audio-fixture-capability";
  bridge.ggResolveMediaSourceURL = async () => await resolveSource();
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root?.unmount());
  queryClient.clear();
  root = undefined;
  document.body.replaceChildren();
  const bridge = window as unknown as Record<string, unknown>;
  delete bridge.ggGrantMediaSourceCapability;
  delete bridge.ggResolveMediaSourceURL;
});

test("loading remains distinct until actual audio decodes into an audible waveform", async () => {
  const pending: { release?: (source: string) => void } = {};
  resolveSource = () =>
    new Promise((resolve) => {
      pending.release = resolve;
    });
  await mount();
  await vi.waitFor(() => expect(latest?.status).toBe("loading"));
  expect(document.querySelector(".gg-timeline-clip-audio")).toBeNull();
  expect(document.querySelector('[role="status"]')?.textContent).toBe("loading");
  await vi.waitFor(() => expect(pending.release).toBeTypeOf("function"));
  pending.release?.(tone);
  await vi.waitFor(() => expect(latest?.status).toBe("decoded"), { timeout: 5000 });
  expect(document.querySelector(".gg-timeline-clip-audio")).not.toBeNull();
  expect(document.querySelectorAll(".gg-timeline-waveform-bar").length).toBeGreaterThan(0);
});

test("digital silence is identified from real PCM rather than an invented waveform", async () => {
  resolveSource = async () => silence;
  await mount();
  await vi.waitFor(() => expect(latest?.status).toBe("silent"), { timeout: 5000 });
  expect(document.querySelector(".gg-timeline-clip-audio")).toBeNull();
  expect(document.querySelector('[role="status"]')?.textContent).toBe("silent");
});

test("a video without embedded audio stays unavailable when track metadata is unsupported", async () => {
  const media = document.createElement("video");
  Object.defineProperty(media, "audioTracks", { value: undefined });
  expect(readEmbeddedAudioTrackCount(media)).toBeNull();
  resolveSource = async () => noAudio;
  await mount();
  await vi.waitFor(() => expect(latest?.status).toBe("unavailable"), { timeout: 5000 });
  expect(document.querySelector(".gg-timeline-clip-audio")).toBeNull();
  expect(document.querySelector('[role="status"]')?.textContent).toBe("unavailable");
});

test("known zero embedded tracks remains distinct from decode failure", async () => {
  const resolve = vi.fn(async () => tone);
  resolveSource = resolve;
  const media = document.createElement("video");
  Object.defineProperty(media, "audioTracks", { value: { length: 0 } });
  await mount(readEmbeddedAudioTrackCount(media));
  await vi.waitFor(() => expect(latest?.status).toBe("no-audio"));
  expect(resolve).not.toHaveBeenCalled();
  expect(document.querySelector(".gg-timeline-clip-audio")).toBeNull();
  expect(document.querySelector('[role="status"]')?.textContent).toBe("no-audio");
});
