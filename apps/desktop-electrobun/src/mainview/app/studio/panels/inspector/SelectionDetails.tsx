import type { StudioController } from "../../hooks/core/useStudioController";
import type { InspectorSelection } from "../../model/inspectorSelectionModel";
import { Button } from "@/components/ui/button";
import { InspectorDetailRows, InspectorSection } from "./InspectorPrimitives";

type SelectionDetailsStudio = Pick<
  StudioController,
  "formatDecimal" | "setPlayheadSeconds" | "setTrimEndSeconds" | "setTrimStartSeconds" | "ui"
>;

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
      <div className="space-y-2">
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
        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => studio.setTrimStartSeconds(selection.startSeconds)}
          >
            {studio.ui.inspector.actions.setTrimInToClipStart}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => studio.setTrimEndSeconds(selection.endSeconds)}
          >
            {studio.ui.inspector.actions.setTrimOutToClipEnd}
          </Button>
        </div>
      </div>
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
              value: `${studio.ui.inspector.fields.type}: ${localizeTimelineMarkerKind(selection.markerKind, studio)}`,
            },
            {
              value: `${studio.ui.inspector.fields.time}: ${studio.formatDecimal(selection.timestampSeconds)}s`,
            },
            { value: `${studio.ui.inspector.fields.density}: ${selection.density}` },
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
          { value: selection.name },
          { value: `${selection.width}:${selection.height}`, className: "text-muted-foreground" },
          { value: `${studio.ui.inspector.fields.fileType}: ${selection.fileType}` },
        ]}
      />
    </InspectorSection>
  );
}
