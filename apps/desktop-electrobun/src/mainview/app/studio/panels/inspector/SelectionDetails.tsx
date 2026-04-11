import type { StudioController } from "../../hooks/core/useStudioController";
import type { InspectorSelection } from "../../domain/inspectorSelectionModel";
import { Button } from "@guerillaglass/ui/components/button";
import { InspectorDetailRows, InspectorSection } from "./InspectorPrimitives";

type SelectionDetailsStudio = Pick<StudioController, "formatDecimal" | "setPlayheadSeconds" | "ui">;

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

export function SelectionDetailsTimelineClip({
  selection,
  studio,
}: {
  selection: TimelineClipSelection;
  studio: SelectionDetailsStudio;
}) {
  return (
    <InspectorSection title={studio.ui.inspector.cards.selectedClip} defaultOpen>
      <InspectorDetailRows
        rows={[
          {
            label: studio.ui.inspector.fields.lane,
            value: localizeTimelineLaneId(selection.laneId, studio),
          },
          {
            label: studio.ui.inspector.fields.start,
            value: `${studio.formatDecimal(selection.startSeconds)}s`,
          },
          {
            label: studio.ui.inspector.fields.end,
            value: `${studio.formatDecimal(selection.endSeconds)}s`,
          },
          {
            label: studio.ui.inspector.fields.duration,
            value: `${studio.formatDecimal(Math.max(0, selection.endSeconds - selection.startSeconds))}s`,
          },
        ]}
      />
    </InspectorSection>
  );
}

export function SelectionDetailsTimelineMarker({
  selection,
  studio,
}: {
  selection: TimelineMarkerSelection;
  studio: SelectionDetailsStudio;
}) {
  return (
    <InspectorSection title={studio.ui.inspector.cards.selectedEventMarker} defaultOpen>
      <div className="space-y-2">
        <InspectorDetailRows
          rows={[
            {
              label: studio.ui.inspector.fields.type,
              value: localizeTimelineMarkerKind(selection.markerKind, studio),
            },
            {
              label: studio.ui.inspector.fields.time,
              value: `${studio.formatDecimal(selection.timestampSeconds)}s`,
            },
            { label: studio.ui.inspector.fields.density, value: String(selection.density) },
          ]}
        />
        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => studio.setPlayheadSeconds(selection.timestampSeconds)}
          >
            {studio.ui.inspector.actions.jumpPlayheadToMarker}
          </Button>
        </div>
      </div>
    </InspectorSection>
  );
}

export function SelectionDetailsCaptureWindow({
  selection,
  studio,
}: {
  selection: CaptureWindowSelection;
  studio: SelectionDetailsStudio;
}) {
  return (
    <InspectorSection title={studio.ui.inspector.cards.selectedWindow} defaultOpen>
      <InspectorDetailRows
        rows={[
          { label: studio.ui.inspector.fields.app, value: selection.appName },
          {
            label: studio.ui.inspector.fields.title,
            value: selection.title || studio.ui.values.untitled,
            valueClassName: "truncate",
          },
          { label: studio.ui.inspector.fields.windowId, value: String(selection.windowId) },
        ]}
      />
    </InspectorSection>
  );
}

export function SelectionDetailsExportPreset({
  selection,
  studio,
}: {
  selection: ExportPresetSelection;
  studio: SelectionDetailsStudio;
}) {
  return (
    <InspectorSection title={studio.ui.inspector.cards.selectedPreset} defaultOpen>
      <InspectorDetailRows
        rows={[
          { label: studio.ui.labels.preset, value: selection.name },
          {
            label: studio.ui.labels.captureResolution,
            value: `${selection.width}:${selection.height}`,
            valueClassName: "text-muted-foreground",
          },
          { label: studio.ui.inspector.fields.fileType, value: selection.fileType },
        ]}
      />
    </InspectorSection>
  );
}
