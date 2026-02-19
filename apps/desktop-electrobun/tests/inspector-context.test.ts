import { describe, expect, test } from "bun:test";
import {
  emptyInspectorSelection,
  normalizeInspectorSelection,
  resolveInspectorView,
  selectionFromPreset,
} from "../src/mainview/app/studio/inspectorContext";

describe("inspector context", () => {
  test("resolves default inspector labels by mode", () => {
    expect(resolveInspectorView("capture", emptyInspectorSelection).id).toBe("captureDefault");
    expect(resolveInspectorView("edit", emptyInspectorSelection).id).toBe("editDefault");
    expect(resolveInspectorView("deliver", emptyInspectorSelection).id).toBe("deliverDefault");
  });

  test("keeps timeline selections across modes", () => {
    const clipSelection = {
      kind: "timelineClip" as const,
      laneId: "video" as const,
      clipId: "clip-0",
      startSeconds: 0,
      endSeconds: 5,
    };
    expect(normalizeInspectorSelection("capture", clipSelection)).toEqual(clipSelection);
    expect(normalizeInspectorSelection("edit", clipSelection)).toEqual(clipSelection);
    expect(normalizeInspectorSelection("deliver", clipSelection)).toEqual(clipSelection);
  });

  test("drops mode-incompatible selections", () => {
    const captureWindowSelection = {
      kind: "captureWindow" as const,
      windowId: 1,
      appName: "Safari",
      title: "Example",
    };
    const presetSelection = {
      kind: "exportPreset" as const,
      presetId: "h264_1080p",
      name: "1080p",
      width: 1920,
      height: 1080,
      fileType: "mp4",
    };

    expect(normalizeInspectorSelection("edit", captureWindowSelection)).toEqual(
      emptyInspectorSelection,
    );
    expect(normalizeInspectorSelection("capture", presetSelection)).toEqual(
      emptyInspectorSelection,
    );
  });

  test("resolves timeline selection views regardless of mode", () => {
    const clipSelection = {
      kind: "timelineClip" as const,
      laneId: "audio" as const,
      clipId: "clip-1",
      startSeconds: 3,
      endSeconds: 8,
    };
    const markerSelection = {
      kind: "timelineMarker" as const,
      markerId: "event-7",
      markerKind: "click" as const,
      density: 2,
      timestampSeconds: 6.3,
    };

    expect(resolveInspectorView("capture", clipSelection).id).toBe("timelineClipAudio");
    expect(resolveInspectorView("deliver", markerSelection).id).toBe("timelineMarker");
  });

  test("builds export preset selection from preset data", () => {
    const selection = selectionFromPreset({
      id: "preset-id",
      name: "1080p",
      width: 1920,
      height: 1080,
      fileType: "mp4",
      fps: 60,
    });
    expect(selection).toEqual({
      kind: "exportPreset",
      presetId: "preset-id",
      name: "1080p",
      width: 1920,
      height: 1080,
      fileType: "mp4",
    });
  });
});
