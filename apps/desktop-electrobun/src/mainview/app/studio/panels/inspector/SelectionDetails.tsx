import * as m from "../../../../../paraglide/messages.js";
import type { StudioController } from "../../hooks/core/useStudioController";
import type { InspectorSelection } from "../../domain/inspectorSelectionModel";
import { Button } from "@guerillaglass/ui/components/button";
import { InspectorDetailRows, InspectorSection } from "./InspectorPrimitives";

type SelectionDetailsStudio = Pick<
  StudioController,
  | "deleteSelectedTimelineClip"
  | "formatDecimal"
  | "liftSelectedTimelineClip"
  | "moveSelectedTimelineClipEarlier"
  | "moveSelectedTimelineClipLater"
  | "setPlayheadSeconds"
  | "splitSelectedTimelineClipAtPlayhead"
  | "timelineRippleEnabled"
  | "timelineDocument"
  | "resetSelectedSceneCamera"
  | "locale"
  | "ui"
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
  const clip = studio.timelineDocument.items.find((item) => item.id === selection.clipId);
  const camera = clip?.kind === "clip" ? clip.camera : undefined;
  const sceneIndex = studio.timelineDocument.items
    .filter((item) => item.kind === "clip")
    .findIndex((item) => item.id === selection.clipId);
  return (
    <InspectorSection
      title={
        sceneIndex >= 0
          ? m.ui_timeline_scene({ index: sceneIndex + 1 }, { locale: studio.locale })
          : studio.ui.inspector.cards.selectedClip
      }
      defaultOpen
    >
      <div className="space-y-2">
        {clip?.kind === "clip" ? (
          <p className="text-muted-foreground gg-numeric">
            {m.ui_timeline_source_range(
              {
                start: studio.formatDecimal(clip.sourceStartSeconds),
                end: studio.formatDecimal(clip.sourceEndSeconds),
              },
              { locale: studio.locale },
            )}
          </p>
        ) : null}
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
        <section
          className="space-y-2"
          aria-label={m.ui_workflow_camera(undefined, { locale: studio.locale })}
        >
          <h4 className="font-medium">
            {m.ui_workflow_camera(undefined, { locale: studio.locale })}
          </h4>
          {camera?.length ? (
            <ul className="space-y-2">
              {camera.map((key) => (
                <li key={key.timeSeconds} className="border-b pb-2">
                  <InspectorDetailRows
                    rows={[
                      {
                        label: m.ui_workflow_camera_time(undefined, { locale: studio.locale }),
                        value: `${studio.formatDecimal(key.timeSeconds)}s`,
                      },
                      {
                        label: m.ui_workflow_camera_zoom(undefined, { locale: studio.locale }),
                        value: `${studio.formatDecimal(key.zoom)}×`,
                      },
                      {
                        label: m.ui_workflow_camera_center(undefined, { locale: studio.locale }),
                        value: `${studio.formatDecimal(key.centerX)} / ${studio.formatDecimal(key.centerY)}`,
                      },
                    ]}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">
              {camera !== undefined
                ? m.ui_workflow_camera_static(undefined, { locale: studio.locale })
                : m.ui_workflow_camera_none(undefined, { locale: studio.locale })}
            </p>
          )}
          {camera !== undefined ? (
            <Button size="sm" variant="outline" onClick={() => studio.resetSelectedSceneCamera()}>
              {m.ui_workflow_reset_scene_camera(undefined, { locale: studio.locale })}
            </Button>
          ) : null}
        </section>
        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => studio.splitSelectedTimelineClipAtPlayhead()}
          >
            {studio.ui.inspector.actions.splitClipAtPlayhead}
          </Button>
          <Button size="sm" variant="outline" onClick={() => studio.liftSelectedTimelineClip()}>
            {studio.ui.inspector.actions.liftClip}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => studio.moveSelectedTimelineClipEarlier()}
          >
            {studio.ui.inspector.actions.moveClipEarlier}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => studio.moveSelectedTimelineClipLater()}
          >
            {studio.ui.inspector.actions.moveClipLater}
          </Button>
          <Button size="sm" variant="outline" onClick={() => studio.deleteSelectedTimelineClip()}>
            {studio.ui.inspector.actions.deleteClip(studio.timelineRippleEnabled)}
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
