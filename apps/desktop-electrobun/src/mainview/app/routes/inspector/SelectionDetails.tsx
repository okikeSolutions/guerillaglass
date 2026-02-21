import type { StudioController } from "../../studio/useStudioController";
import type { InspectorSelection } from "../../studio/inspectorContext";
import { InspectorDetailRows, InspectorSection } from "./InspectorPrimitives";

type SelectionDetailsStudio = Pick<StudioController, "ui" | "formatDecimal">;

type TimelineClipSelection = Extract<InspectorSelection, { kind: "timelineClip" }>;
type TimelineMarkerSelection = Extract<InspectorSelection, { kind: "timelineMarker" }>;
type CaptureWindowSelection = Extract<InspectorSelection, { kind: "captureWindow" }>;
type ExportPresetSelection = Extract<InspectorSelection, { kind: "exportPreset" }>;

function localizeTimelineLaneId(laneId: "video" | "audio", studio: SelectionDetailsStudio): string {
  if (laneId === "audio") {
    return studio.ui.labels.timelineLaneAudio;
  }
  return studio.ui.labels.timelineLaneVideo;
}

function localizeTimelineMarkerKind(
  markerKind: "move" | "click" | "mixed",
  studio: SelectionDetailsStudio,
): string {
  if (markerKind === "click") {
    return studio.ui.labels.timelineMarkerClick;
  }
  if (markerKind === "mixed") {
    return studio.ui.labels.timelineMarkerMixed;
  }
  return studio.ui.labels.timelineMarkerMove;
}

function SelectionDetailsTimelineClip({
  selection,
  studio,
}: {
  selection: TimelineClipSelection;
  studio: SelectionDetailsStudio;
}) {
  return (
    <InspectorSection title={studio.ui.inspector.cards.selectedClip}>
      <InspectorDetailRows
        rows={[
          {
            value: `${studio.ui.inspector.fields.lane}: ${localizeTimelineLaneId(selection.laneId, studio)}`,
          },
          {
            value: `${studio.ui.inspector.fields.start}: ${studio.formatDecimal(selection.startSeconds)}s`,
          },
          {
            value: `${studio.ui.inspector.fields.end}: ${studio.formatDecimal(selection.endSeconds)}s`,
          },
          {
            value: `${studio.ui.inspector.fields.duration}: ${studio.formatDecimal(
              Math.max(0, selection.endSeconds - selection.startSeconds),
            )}s`,
          },
        ]}
      />
    </InspectorSection>
  );
}

function SelectionDetailsTimelineMarker({
  selection,
  studio,
}: {
  selection: TimelineMarkerSelection;
  studio: SelectionDetailsStudio;
}) {
  return (
    <InspectorSection title={studio.ui.inspector.cards.selectedEventMarker}>
      <InspectorDetailRows
        rows={[
          {
            value: `${studio.ui.inspector.fields.type}: ${localizeTimelineMarkerKind(selection.markerKind, studio)}`,
          },
          {
            value: `${studio.ui.inspector.fields.time}: ${studio.formatDecimal(selection.timestampSeconds)}s`,
          },
          { value: `${studio.ui.inspector.fields.density}: ${selection.density}` },
        ]}
      />
    </InspectorSection>
  );
}

function SelectionDetailsCaptureWindow({
  selection,
  studio,
}: {
  selection: CaptureWindowSelection;
  studio: SelectionDetailsStudio;
}) {
  return (
    <InspectorSection title={studio.ui.inspector.cards.selectedWindow}>
      <InspectorDetailRows
        rows={[
          { value: `${studio.ui.inspector.fields.app}: ${selection.appName}` },
          {
            value: `${studio.ui.inspector.fields.title}: ${selection.title || studio.ui.values.untitled}`,
            className: "truncate",
          },
          { value: `${studio.ui.inspector.fields.windowId}: ${selection.windowId}` },
        ]}
      />
    </InspectorSection>
  );
}

function SelectionDetailsExportPreset({
  selection,
  studio,
}: {
  selection: ExportPresetSelection;
  studio: SelectionDetailsStudio;
}) {
  return (
    <InspectorSection title={studio.ui.inspector.cards.selectedPreset}>
      <InspectorDetailRows
        rows={[
          { value: selection.name },
          { value: `${selection.width}:${selection.height}`, className: "text-muted-foreground" },
          { value: `${studio.ui.inspector.fields.fileType}: ${selection.fileType}` },
        ]}
      />
    </InspectorSection>
  );
}

export function SelectionDetails({
  selection,
  studio,
}: {
  selection: InspectorSelection;
  studio: SelectionDetailsStudio;
}) {
  if (selection.kind === "none") {
    return null;
  }

  switch (selection.kind) {
    case "timelineClip":
      return <SelectionDetailsTimelineClip selection={selection} studio={studio} />;
    case "timelineMarker":
      return <SelectionDetailsTimelineMarker selection={selection} studio={studio} />;
    case "captureWindow":
      return <SelectionDetailsCaptureWindow selection={selection} studio={studio} />;
    case "exportPreset":
      return <SelectionDetailsExportPreset selection={selection} studio={studio} />;
    default: {
      const _exhaustiveCheck: never = selection;
      void _exhaustiveCheck;
      return null;
    }
  }
}
