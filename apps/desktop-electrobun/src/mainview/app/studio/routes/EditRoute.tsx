import { AgentProposalPanel } from "../panels/AgentProposalPanel";
import { EditorWorkspace } from "../layout/EditorWorkspace";
import { InspectorPanel } from "../panels/InspectorPanel";
import { TimelineDock } from "../panels/TimelineDock";
import { ProjectUtilityPanel } from "../panels/ProjectUtilityPanel";
import { ProgramPreview } from "./ProgramPreview";
import { useStudio } from "../state/StudioProvider";
import {
  StudioPane,
  StudioPaneHeader,
  StudioPaneTitle,
} from "@guerillaglass/ui/desktop/studio-pane";

export function EditRoute() {
  const studio = useStudio();
  return (
    <EditorWorkspace
      leftPane={
        <StudioPane side="left">
          <ProjectUtilityPanel />
        </StudioPane>
      }
      centerPane={
        <StudioPane side="center">
          <StudioPaneHeader>
            <StudioPaneTitle>{studio.ui.workspace.editStageTitle}</StudioPaneTitle>
            <AgentProposalPanel />
          </StudioPaneHeader>
          <ProgramPreview />
        </StudioPane>
      }
      rightPane={<InspectorPanel mode="edit" />}
      bottomPane={<TimelineDock />}
    />
  );
}
