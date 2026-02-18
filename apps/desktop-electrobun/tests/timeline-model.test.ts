import { describe, expect, test } from "bun:test";
import type { InputEvent } from "@guerillaglass/engine-protocol";
import {
  buildEventMarkers,
  buildTimelineLanes,
  clampSeconds,
  pixelsToSeconds,
  secondsToPixels,
} from "../src/mainview/app/studio/timelineModel";

describe("timeline model", () => {
  test("converts between seconds and pixels with clamping", () => {
    expect(secondsToPixels(5, 10, 200)).toBe(100);
    expect(secondsToPixels(20, 10, 200)).toBe(200);
    expect(pixelsToSeconds(50, 10, 200)).toBe(2.5);
    expect(pixelsToSeconds(300, 10, 200)).toBe(10);
    expect(clampSeconds(-1, 0, 5)).toBe(0);
  });

  test("coalesces dense events into markers", () => {
    const events: InputEvent[] = [
      { type: "cursorMoved", timestamp: 0.01, position: { x: 10, y: 20 } },
      { type: "mouseDown", timestamp: 0.02, position: { x: 10, y: 20 }, button: "left" },
      { type: "mouseUp", timestamp: 0.025, position: { x: 10, y: 20 }, button: "left" },
      { type: "cursorMoved", timestamp: 0.7, position: { x: 30, y: 40 } },
    ];

    const markers = buildEventMarkers(events, 2, {
      minimumBucketSeconds: 0.05,
      maximumMarkers: 100,
    });

    expect(markers.length).toBe(2);
    expect(markers[0]?.kind).toBe("mixed");
    expect(markers[0]?.density).toBe(3);
    expect(markers[1]?.kind).toBe("move");
  });

  test("builds video/audio/events lanes", () => {
    const events: InputEvent[] = [
      { type: "cursorMoved", timestamp: 0.2, position: { x: 8, y: 8 } },
    ];
    const lanes = buildTimelineLanes({ recordingDurationSeconds: 5, events });

    expect(lanes.map((lane) => lane.id)).toEqual(["video", "audio", "events"]);
    expect(lanes[0]?.clips[0]).toEqual({
      id: "clip-0",
      startSeconds: 0,
      endSeconds: 5,
    });
    expect(lanes[2]?.markers.length).toBe(1);
  });
});
