import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
const source = new URL("../fixtures/timeline-red.mp4", import.meta.url).href;
import { useTimelineThumbnails } from "../../src/mainview/app/studio/hooks/timeline/useTimelineThumbnails";
import type { TimelineClip } from "../../src/mainview/app/studio/domain/timelineDomainModel";

let root: Root | undefined;
let frames: ReadonlyMap<string, string> = new Map();
const clips: TimelineClip[] = Array.from({ length: 40 }, (_, index) => ({
  id: `scene-${index}`,
  startSeconds: index * 0.4,
  endSeconds: (index + 1) * 0.4,
  sourceStartSeconds: 0,
  sourceEndSeconds: 0.4,
  semantic: "screen",
  waveform: null,
}));

function Harness({ mediaSource }: { mediaSource: string | null }) {
  const result = useTimelineThumbnails(mediaSource, clips);
  useEffect(() => {
    frames = result;
  }, [result]);
  return null;
}

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
  frames = new Map();
  vi.restoreAllMocks();
});

test("scene thumbnails decode real source pixels with one decoder and bounded work", async () => {
  const createElement = vi.spyOn(document, "createElement");
  const append = vi.spyOn(document.body, "append");
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root?.render(<Harness mediaSource={source} />));
  await vi.waitFor(() => expect(frames.size).toBe(32), { timeout: 5000 });
  expect(createElement.mock.calls.filter(([tag]) => tag === "video")).toHaveLength(1);
  const decoderIndex = createElement.mock.calls.findIndex(([tag]) => tag === "video");
  const decoder = createElement.mock.results[decoderIndex]?.value;
  expect(decoder).toBeInstanceOf(HTMLVideoElement);
  expect(decoder.muted).toBe(true);
  expect(decoder.defaultMuted).toBe(true);
  expect(decoder.volume).toBe(0);
  expect(frames.has("scene-32")).toBe(false);
  expect(append.mock.calls.some((nodes) => nodes.some((node) => node === decoder))).toBe(true);
  await vi.waitFor(() => expect(document.querySelector("[data-gg-thumbnail-decoder]")).toBeNull());
  const image = new Image();
  image.src = frames.get("scene-0")!;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d")!;
  context.drawImage(image, 0, 0);
  const pixel = context.getImageData(10, 10, 1, 1).data;
  expect(pixel[0]).toBeGreaterThan(230);
  expect(pixel[1]).toBeLessThan(20);
  expect(pixel[2]).toBeLessThan(20);
  await act(async () => root?.render(<Harness mediaSource={null} />));
  expect(frames.size).toBe(0);
});
