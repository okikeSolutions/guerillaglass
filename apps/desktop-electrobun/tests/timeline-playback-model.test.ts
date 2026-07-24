import { describe, expect, test } from "vitest";
import { timelineSegmentIdSchema } from "@guerillaglass/engine-contract/schema-primitives";
import type {
  TimelineClipItem,
  TimelineGapItem,
} from "@guerillaglass/engine-contract/shared/valueObjects";
import { compileTimelineItems } from "@studio/domain/timelineDomainModel";
import {
  findNextPlayableClipAfterProgramTime,
  resolveTimelinePlaybackAtProgramTime,
} from "@studio/domain/timelinePlaybackModel";

type TimelineItemInput =
  | (Omit<TimelineClipItem, "id"> & { id: string })
  | (Omit<TimelineGapItem, "id"> & { id: string });

function compile(timeline: { version: 2; items: TimelineItemInput[] }) {
  return compileTimelineItems({
    ...timeline,
    items: timeline.items.map((item) => ({
      ...item,
      id: timelineSegmentIdSchema.make(item.id),
    })),
  });
}

describe("timeline playback model", () => {
  test("maps clip program time to source time", () => {
    const items = compile({
      version: 2,
      items: [
        {
          kind: "clip",
          id: "clip-a",
          sourceAssetId: "recording",
          sourceStartSeconds: 2,
          sourceEndSeconds: 4,
        },
      ],
    });

    expect(resolveTimelinePlaybackAtProgramTime(items, 0.75)).toMatchObject({
      kind: "clip",
      item: expect.objectContaining({ id: "clip-a" }),
      sourceSeconds: 2.75,
    });
  });

  test("returns gap resolution instead of remapping gap time to a later clip", () => {
    const items = compile({
      version: 2,
      items: [
        {
          kind: "clip",
          id: "clip-a",
          sourceAssetId: "recording",
          sourceStartSeconds: 0,
          sourceEndSeconds: 1,
        },
        { kind: "gap", id: "gap-a", durationSeconds: 1 },
        {
          kind: "clip",
          id: "clip-b",
          sourceAssetId: "recording",
          sourceStartSeconds: 3,
          sourceEndSeconds: 4,
        },
      ],
    });

    expect(resolveTimelinePlaybackAtProgramTime(items, 1.25)).toMatchObject({
      kind: "gap",
      item: expect.objectContaining({ id: "gap-a" }),
    });
  });

  test("finds the next clip after an interstitial gap without relying on item indexes", () => {
    const items = compile({
      version: 2,
      items: [
        {
          kind: "clip",
          id: "clip-a",
          sourceAssetId: "recording",
          sourceStartSeconds: 0,
          sourceEndSeconds: 1,
        },
        { kind: "gap", id: "gap-a", durationSeconds: 1 },
        {
          kind: "clip",
          id: "clip-b",
          sourceAssetId: "recording",
          sourceStartSeconds: 3,
          sourceEndSeconds: 4,
        },
      ],
    });

    expect(findNextPlayableClipAfterProgramTime(items, 1)?.id).toBe("clip-b");
    expect(findNextPlayableClipAfterProgramTime(items, 2)?.id).toBe("clip-b");
  });

  test("distinguishes leading gaps, trailing gaps, and ended state", () => {
    const items = compile({
      version: 2,
      items: [
        { kind: "gap", id: "leader", durationSeconds: 0.5 },
        {
          kind: "clip",
          id: "clip-a",
          sourceAssetId: "recording",
          sourceStartSeconds: 2,
          sourceEndSeconds: 3,
        },
        { kind: "gap", id: "tail", durationSeconds: 0.5 },
      ],
    });

    expect(resolveTimelinePlaybackAtProgramTime(items, 0.25)).toMatchObject({
      kind: "gap",
      item: expect.objectContaining({ id: "leader" }),
    });
    expect(resolveTimelinePlaybackAtProgramTime(items, 1.75)).toMatchObject({
      kind: "gap",
      item: expect.objectContaining({ id: "tail" }),
    });
    expect(resolveTimelinePlaybackAtProgramTime(items, 2)).toMatchObject({
      kind: "ended",
      durationSeconds: 2,
    });
  });
});
