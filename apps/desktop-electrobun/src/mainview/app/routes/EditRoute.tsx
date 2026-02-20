import { useStudio } from "../studio/context";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { EditorWorkspace } from "./EditorWorkspace";
import { InspectorPanel } from "./InspectorPanel";
import { TimelineDock } from "./TimelineDock";
import { ProjectUtilityPanel } from "./ProjectUtilityPanel";
import {
  StudioPane,
  StudioPaneBody,
  StudioPaneHeader,
  StudioPaneSubtitle,
  StudioPaneTitle,
} from "./StudioPane";

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
        <StudioPane as="section" side="center">
          <StudioPaneHeader>
            <StudioPaneTitle>{studio.ui.workspace.editStageTitle}</StudioPaneTitle>
            <StudioPaneSubtitle>{studio.ui.helper.activePreviewBody}</StudioPaneSubtitle>
          </StudioPaneHeader>
          <StudioPaneBody className="flex min-h-0 flex-col gap-4">
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
              <AspectRatio ratio={16 / 9} className="h-full w-auto max-h-full max-w-[1000px]">
                <div className="gg-preview-stage">
                  {studio.captureStatusQuery.data?.isRunning ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">{studio.ui.helper.activePreviewTitle}</p>
                      <p className="text-xs text-muted-foreground">
                        {studio.ui.helper.activePreviewBody}
                      </p>
                    </div>
                  ) : (
                    <Empty className="max-w-md border-border/70 bg-background/70 p-6">
                      <EmptyHeader>
                        <EmptyTitle className="text-sm">
                          {studio.ui.helper.emptyPreviewTitle}
                        </EmptyTitle>
                        <EmptyDescription>{studio.ui.helper.emptyPreviewBody}</EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  )}
                </div>
              </AspectRatio>
            </div>

            <div className="gg-copy-compact shrink-0 grid grid-cols-3 gap-2">
              <div>{`${studio.ui.labels.status}: ${studio.captureStatusLabel}`}</div>
              <div>{`${studio.ui.labels.duration}: ${studio.formatDuration(studio.captureStatusQuery.data?.recordingDurationSeconds ?? 0)}`}</div>
              <div className="truncate">{`${studio.ui.labels.eventsURL}: ${studio.projectQuery.data?.eventsURL ?? studio.captureStatusQuery.data?.eventsURL ?? "-"}`}</div>
            </div>
          </StudioPaneBody>
        </StudioPane>
      }
      rightPane={<InspectorPanel mode="edit" />}
      bottomPane={<TimelineDock />}
    />
  );
}
