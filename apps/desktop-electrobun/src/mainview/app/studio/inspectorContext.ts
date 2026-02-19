import type { ExportPreset } from "@guerillaglass/engine-protocol";
import type { TimelineEventMarkerKind } from "./timelineModel";

export type StudioMode = "capture" | "edit" | "deliver";

export type InspectorSelection =
  | { kind: "none" }
  | {
      kind: "timelineClip";
      laneId: "video" | "audio";
      clipId: string;
      startSeconds: number;
      endSeconds: number;
    }
  | {
      kind: "timelineMarker";
      markerId: string;
      markerKind: TimelineEventMarkerKind;
      density: number;
      timestampSeconds: number;
    }
  | {
      kind: "captureWindow";
      windowId: number;
      appName: string;
      title: string;
    }
  | {
      kind: "exportPreset";
      presetId: string;
      name: string;
      width: number;
      height: number;
      fileType: string;
    };

export type InspectorView = {
  id:
    | "timelineClipVideo"
    | "timelineClipAudio"
    | "timelineMarker"
    | "captureWindow"
    | "exportPreset"
    | "captureDefault"
    | "editDefault"
    | "deliverDefault";
};

export const emptyInspectorSelection: InspectorSelection = { kind: "none" };

export function normalizeInspectorSelection(
  mode: StudioMode,
  selection: InspectorSelection,
): InspectorSelection {
  if (selection.kind === "captureWindow" && mode !== "capture") {
    return emptyInspectorSelection;
  }
  if (selection.kind === "exportPreset" && mode !== "deliver") {
    return emptyInspectorSelection;
  }
  return selection;
}

export function resolveInspectorView(
  mode: StudioMode,
  selection: InspectorSelection,
): InspectorView {
  if (selection.kind === "timelineClip") {
    return {
      id: selection.laneId === "video" ? "timelineClipVideo" : "timelineClipAudio",
    };
  }

  if (selection.kind === "timelineMarker") {
    return {
      id: "timelineMarker",
    };
  }

  if (selection.kind === "captureWindow") {
    return {
      id: "captureWindow",
    };
  }

  if (selection.kind === "exportPreset") {
    return {
      id: "exportPreset",
    };
  }

  switch (mode) {
    case "capture":
      return {
        id: "captureDefault",
      };
    case "edit":
      return {
        id: "editDefault",
      };
    case "deliver":
      return {
        id: "deliverDefault",
      };
    default: {
      const _exhaustiveCheck: never = mode;
      void _exhaustiveCheck;
      return {
        id: "editDefault",
      };
    }
  }
}

export function selectionFromPreset(preset: ExportPreset): InspectorSelection {
  return {
    kind: "exportPreset",
    presetId: preset.id,
    name: preset.name,
    width: preset.width,
    height: preset.height,
    fileType: preset.fileType,
  };
}
