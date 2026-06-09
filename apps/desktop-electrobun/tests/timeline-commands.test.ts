import { describe, expect, test } from "bun:test";
import type { TimelineDocument } from "@guerillaglass/engine-contract/shared/valueObjects";
import {
  deleteTimelineItems,
  liftTimelineItems,
  moveTimelineItems,
  normalizeTimelineDocument,
  splitTimelineClipAtProgramTime,
} from "@studio/domain/timelineCommands";

function makeTimeline(items: TimelineDocument["items"]): TimelineDocument {
  return {
    version: 2,
    items,
  };
}

function makeIdFactory(ids: string[]): () => string {
  let index = 0;
  return () => {
    const next = ids[index];
    index += 1;
    if (!next) {
      throw new Error("Ran out of deterministic ids");
    }
    return next;
  };
}

describe("timeline commands", () => {
  test("normalizes adjacent gaps and removes zero-duration items", () => {
    const timeline = makeTimeline([
      {
        kind: "gap",
        id: "gap-a",
        durationSeconds: 1,
      },
      {
        kind: "gap",
        id: "gap-b",
        durationSeconds: 2,
      },
      {
        kind: "clip",
        id: "clip-a",
        sourceAssetId: "recording",
        sourceStartSeconds: 0,
        sourceEndSeconds: 0,
      },
      {
        kind: "clip",
        id: "clip-b",
        sourceAssetId: "recording",
        sourceStartSeconds: 4,
        sourceEndSeconds: 6,
      },
    ]);

    expect(normalizeTimelineDocument(timeline)).toEqual(
      makeTimeline([
        {
          kind: "gap",
          id: "gap-a",
          durationSeconds: 3,
        },
        {
          kind: "clip",
          id: "clip-b",
          sourceAssetId: "recording",
          sourceStartSeconds: 4,
          sourceEndSeconds: 6,
        },
      ]),
    );
  });

  test("splits a clip at a program-time playhead", () => {
    const timeline = makeTimeline([
      {
        kind: "clip",
        id: "clip-a",
        sourceAssetId: "recording",
        sourceStartSeconds: 2,
        sourceEndSeconds: 6,
      },
    ]);

    const result = splitTimelineClipAtProgramTime(timeline, 1.5, makeIdFactory(["clip-b"]));

    expect(result.changed).toBe(true);
    expect(result.timeline.items).toEqual([
      {
        kind: "clip",
        id: "clip-a",
        sourceAssetId: "recording",
        sourceStartSeconds: 2,
        sourceEndSeconds: 3.5,
      },
      {
        kind: "clip",
        id: "clip-b",
        sourceAssetId: "recording",
        sourceStartSeconds: 3.5,
        sourceEndSeconds: 6,
      },
    ]);
  });

  test("lifts selected items into a gap with matching duration", () => {
    const timeline = makeTimeline([
      {
        kind: "clip",
        id: "clip-a",
        sourceAssetId: "recording",
        sourceStartSeconds: 0,
        sourceEndSeconds: 2,
      },
      {
        kind: "clip",
        id: "clip-b",
        sourceAssetId: "recording",
        sourceStartSeconds: 3,
        sourceEndSeconds: 5.5,
      },
    ]);

    const result = liftTimelineItems(timeline, ["clip-b"], makeIdFactory(["gap-lift"]));

    expect(result.changed).toBe(true);
    expect(result.timeline.items).toEqual([
      timeline.items[0],
      {
        kind: "gap",
        id: "gap-lift",
        durationSeconds: 2.5,
      },
    ]);
  });

  test("delete with ripple removes items and compacts the timeline", () => {
    const timeline = makeTimeline([
      {
        kind: "clip",
        id: "clip-a",
        sourceAssetId: "recording",
        sourceStartSeconds: 0,
        sourceEndSeconds: 2,
      },
      {
        kind: "gap",
        id: "gap-a",
        durationSeconds: 1,
      },
      {
        kind: "clip",
        id: "clip-b",
        sourceAssetId: "recording",
        sourceStartSeconds: 5,
        sourceEndSeconds: 6,
      },
    ]);

    const result = deleteTimelineItems(timeline, ["gap-a"], { ripple: true });

    expect(result.changed).toBe(true);
    expect(result.timeline.items).toEqual([timeline.items[0], timeline.items[2]]);
  });

  test("ripple move reorders items without changing duration", () => {
    const timeline = makeTimeline([
      {
        kind: "clip",
        id: "clip-a",
        sourceAssetId: "recording",
        sourceStartSeconds: 0,
        sourceEndSeconds: 2,
      },
      {
        kind: "clip",
        id: "clip-b",
        sourceAssetId: "recording",
        sourceStartSeconds: 4,
        sourceEndSeconds: 5,
      },
      {
        kind: "clip",
        id: "clip-c",
        sourceAssetId: "recording",
        sourceStartSeconds: 6,
        sourceEndSeconds: 8,
      },
    ]);

    const result = moveTimelineItems(timeline, ["clip-a"], {
      ripple: true,
      destinationIndex: 3,
    });

    expect(result.changed).toBe(true);
    expect(result.timeline.items.map((item) => item.id)).toEqual(["clip-b", "clip-c", "clip-a"]);
  });

  test("non-ripple move consumes destination gap and leaves source timing behind", () => {
    const timeline = makeTimeline([
      {
        kind: "clip",
        id: "clip-a",
        sourceAssetId: "recording",
        sourceStartSeconds: 0,
        sourceEndSeconds: 2,
      },
      {
        kind: "clip",
        id: "clip-mid",
        sourceAssetId: "recording",
        sourceStartSeconds: 2,
        sourceEndSeconds: 3,
      },
      {
        kind: "gap",
        id: "gap-target",
        durationSeconds: 3,
      },
    ]);

    const result = moveTimelineItems(
      timeline,
      ["clip-a"],
      {
        ripple: false,
        destinationGapId: "gap-target",
      },
      makeIdFactory(["gap-source"]),
    );

    expect(result.changed).toBe(true);
    expect(result.timeline.items).toEqual([
      {
        kind: "gap",
        id: "gap-source",
        durationSeconds: 2,
      },
      timeline.items[1],
      timeline.items[0],
      {
        kind: "gap",
        id: "gap-target",
        durationSeconds: 1,
      },
    ]);
  });
});
