import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import { timelineSegmentIdSchema } from "@guerillaglass/engine-contract/schema-primitives";
import {
  defaultBackgroundFramingSettings,
  type TimelineClipItem,
} from "@guerillaglass/engine-contract/shared/valueObjects";
const source = new URL("../fixtures/timeline-red.mp4", import.meta.url).href;
import { ProposalScenePreview } from "../../src/mainview/app/studio/panels/ProposalScenePreview";

vi.mock("../../src/mainview/app/studio/hooks/useRecordingMediaSource", () => ({
  useRecordingMediaSourceLease: (recordingURL: string) => ({
    source: recordingURL,
    error: null,
    isPending: false,
    refresh: async () => {},
  }),
}));

const scene: TimelineClipItem = {
  kind: "clip",
  id: timelineSegmentIdSchema.make("moving-scene"),
  sourceAssetId: "recording",
  sourceStartSeconds: 0.1,
  sourceEndSeconds: 0.2,
  camera: [
    { timeSeconds: 0.1, centerX: 0.5, centerY: 0.5, zoom: 1 },
    { timeSeconds: 0.2, centerX: 0.4, centerY: 0.5, zoom: 2 },
  ],
};
let root: Root | undefined;

async function renderScene(item: TimelineClipItem) {
  await act(async () =>
    root?.render(
      <ProposalScenePreview
        item={item}
        locale="en-US"
        recordingURL={source}
        framing={defaultBackgroundFramingSettings}
        outputSize={{ width: 320, height: 180 }}
        cameraReframeEnabled={true}
      />,
    ),
  );
}

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

test("isolated scene playback follows its camera, stops at its endpoint and replays from its source start", async () => {
  const host = document.createElement("div");
  host.style.width = "320px";
  document.body.append(host);
  root = createRoot(host);
  await renderScene(scene);
  const video = host.querySelector("video")!;
  await vi.waitFor(() => {
    expect(video.readyState).toBeGreaterThanOrEqual(2);
    expect(video.currentTime).toBeCloseTo(0.1, 2);
    expect(video.style.transform).toContain("matrix(");
  });
  const initialCamera = new DOMMatrixReadOnly(video.style.transform);
  expect(initialCamera.a).toBeCloseTo(1, 2);
  const starts: number[] = [];
  let furthestTime = 0;
  let sampling = true;
  let frame = 0;
  const sample = () => {
    furthestTime = Math.max(furthestTime, video.currentTime);
    if (sampling) {
      frame = requestAnimationFrame(sample);
    }
  };
  const playSource = video.play.bind(video);
  vi.spyOn(video, "play").mockImplementation(() => {
    starts.push(video.currentTime);
    return playSource();
  });
  frame = requestAnimationFrame(sample);
  try {
    await page.getByRole("button", { name: "Play scene" }).click();
    await vi.waitFor(() => {
      expect(starts).toHaveLength(1);
      expect(video.paused).toBe(true);
      expect(video.currentTime).toBeCloseTo(0.2, 2);
    });
    // The fixture has 10fps. A coarse timeupdate-only guard runs past this bound.
    expect(furthestTime).toBeLessThanOrEqual(scene.sourceEndSeconds + 0.1);
    // The final affine camera must reach zoom 2 even though this short scene
    // contains only one 10fps decoded source frame. Compare geometry, not strings.
    await vi.waitFor(() => {
      const finalCamera = new DOMMatrixReadOnly(video.style.transform);
      expect(finalCamera.a).toBeCloseTo(2, 2);
      expect(finalCamera.e).toBeGreaterThan(initialCamera.e);
    });
    expect(starts[0]).toBeLessThanOrEqual(scene.sourceStartSeconds + 0.02);
    await page.getByRole("button", { name: "Play scene" }).click();
    await vi.waitFor(() => expect(starts).toHaveLength(2));
    expect(starts[1]).toBeLessThanOrEqual(scene.sourceStartSeconds + 0.02);
  } finally {
    sampling = false;
    cancelAnimationFrame(frame);
  }
});

test("choosing another scene resets a previous media failure and playback position", async () => {
  const host = document.createElement("div");
  host.style.width = "320px";
  document.body.append(host);
  root = createRoot(host);
  await renderScene(scene);
  const previous = host.querySelector("video")!;
  await vi.waitFor(() => expect(previous.readyState).toBeGreaterThanOrEqual(2));
  await act(async () => {
    previous.dispatchEvent(new Event("error"));
  });
  await expect.element(page.getByRole("alert")).toBeVisible();
  await renderScene({
    ...scene,
    id: timelineSegmentIdSchema.make("next-scene"),
    sourceStartSeconds: 0.2,
    sourceEndSeconds: 0.3,
  });
  const next = host.querySelector("video")!;
  expect(next).not.toBe(previous);
  await vi.waitFor(() => expect(next.currentTime).toBeCloseTo(0.2, 2));
  await expect.element(page.getByRole("alert")).not.toBeInTheDocument();
  await expect.element(page.getByRole("button", { name: "Play scene" })).toBeVisible();
  expect(previous.paused).toBe(true);
});
