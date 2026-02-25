import { MonitorCog } from "lucide-react";
import { useMemo } from "react";
import { useStudio } from "../state/StudioProvider";
import {
  resolveInspectorView,
  type InspectorView,
  type StudioMode,
} from "../model/inspectorSelectionModel";
import {
  CaptureInspectorContent,
  DeliverInspectorContent,
  EditInspectorContent,
} from "./inspector/InspectorModeContent";
import {
  SelectionDetailsCaptureWindow,
  SelectionDetailsExportPreset,
  SelectionDetailsTimelineClip,
  SelectionDetailsTimelineMarker,
} from "./inspector/SelectionDetails";
import {
  StudioPane,
  StudioPaneBody,
  StudioPaneHeader,
  StudioPaneSubtitle,
  StudioPaneTitle,
} from "../layout/StudioPanePrimitives";

type InspectorPanelProps = {
  mode: StudioMode;
};

function renderInspectorContent(params: {
  view: InspectorView;
  selection: ReturnType<typeof useStudio>["inspectorSelection"];
  studio: ReturnType<typeof useStudio>;
}) {
  const { view, selection, studio } = params;

  switch (view.id) {
    case "captureDefault":
      return <CaptureInspectorContent studio={studio} />;
    case "editDefault":
      return <EditInspectorContent studio={studio} />;
    case "deliverDefault":
      return <DeliverInspectorContent studio={studio} />;
    case "timelineClipVideo":
    case "timelineClipAudio":
      return selection.kind === "timelineClip" ? (
        <SelectionDetailsTimelineClip selection={selection} studio={studio} />
      ) : null;
    case "timelineMarker":
      return selection.kind === "timelineMarker" ? (
        <SelectionDetailsTimelineMarker selection={selection} studio={studio} />
      ) : null;
    case "captureWindow":
      return selection.kind === "captureWindow" ? (
        <>
          <SelectionDetailsCaptureWindow selection={selection} studio={studio} />
          <CaptureInspectorContent studio={studio} />
        </>
      ) : null;
    case "exportPreset":
      return selection.kind === "exportPreset" ? (
        <>
          <SelectionDetailsExportPreset selection={selection} studio={studio} />
          <DeliverInspectorContent studio={studio} />
        </>
      ) : null;
    default: {
      const _exhaustiveCheck: never = view.id;
      void _exhaustiveCheck;
      return null;
    }
  }
}

export function InspectorPanel({ mode }: InspectorPanelProps) {
  const studio = useStudio();
  const selection = studio.inspectorSelection;
  const view = useMemo(() => resolveInspectorView(mode, selection), [mode, selection]);
  const viewText = studio.ui.inspector.views[view.id];

  return (
    <StudioPane side="right">
      <StudioPaneHeader>
        <StudioPaneTitle className="flex items-center gap-2">
          <MonitorCog className="h-4 w-4" /> {viewText.title}
        </StudioPaneTitle>
        <StudioPaneSubtitle>{viewText.subtitle}</StudioPaneSubtitle>
      </StudioPaneHeader>
      <StudioPaneBody className="gg-inspector-pane-body gg-copy-compact">
        {renderInspectorContent({ view, selection, studio })}
      </StudioPaneBody>
    </StudioPane>
  );
}
