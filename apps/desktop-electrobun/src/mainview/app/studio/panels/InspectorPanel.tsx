import { MonitorCog } from "lucide-react";
import { useMemo } from "react";
import { useStudio } from "../state/StudioProvider";
import { resolveInspectorView, type StudioMode } from "../model/inspectorSelectionModel";
import {
  CaptureInspectorContent,
  DeliverInspectorContent,
  EditInspectorContent,
} from "./inspector/InspectorModeContent";
import { SelectionDetails } from "./inspector/SelectionDetails";
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
        {selection.kind !== "none" ? (
          <SelectionDetails selection={selection} studio={studio} />
        ) : null}

        {mode === "capture" ? <CaptureInspectorContent studio={studio} /> : null}
        {mode === "edit" ? <EditInspectorContent selection={selection} studio={studio} /> : null}
        {mode === "deliver" ? <DeliverInspectorContent studio={studio} /> : null}
      </StudioPaneBody>
    </StudioPane>
  );
}
