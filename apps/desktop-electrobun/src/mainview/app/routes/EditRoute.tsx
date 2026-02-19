import { Button } from "@/components/ui/button";
import { InspectorPanel } from "./InspectorPanel";
import { useStudio } from "../studio/context";

export function EditRoute() {
  const studio = useStudio();

  return (
    <section className="gg-editor-shell">
      <aside className="gg-pane gg-pane-left">
        <div className="gg-pane-header">
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            {studio.ui.sections.leftRail}
          </h2>
          <p className="gg-pane-subtitle">Project utility and quick actions</p>
        </div>
        <div className="gg-pane-body space-y-3 text-sm">
          <div className="rounded-md border border-border/70 bg-background/70 p-3">
            <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Project
            </p>
            <div className="truncate">{`${studio.ui.labels.projectPath}: ${studio.projectQuery.data?.projectPath ?? studio.ui.labels.notSaved}`}</div>
            <div className="truncate">{`${studio.ui.labels.recordingURL}: ${studio.recordingURL ?? "-"}`}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void studio.saveProjectMutation.mutateAsync(false)}
              disabled={studio.isRunningAction || !studio.recordingURL}
            >
              {studio.ui.actions.saveProject}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void studio.saveProjectMutation.mutateAsync(true)}
              disabled={studio.isRunningAction || !studio.recordingURL}
            >
              {studio.ui.actions.saveProjectAs}
            </Button>
          </div>
        </div>
      </aside>

      <section className="gg-pane gg-pane-center">
        <div className="gg-pane-header">
          <h2 className="text-sm font-semibold tracking-wide uppercase">Editor Stage</h2>
          <p className="gg-pane-subtitle">{studio.ui.helper.activePreviewBody}</p>
        </div>
        <div className="gg-pane-body space-y-4">
          <div className="gg-preview-stage">
            {studio.captureStatusQuery.data?.isRunning ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">{studio.ui.helper.activePreviewTitle}</p>
                <p className="text-xs text-muted-foreground">
                  {studio.ui.helper.activePreviewBody}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium">{studio.ui.helper.emptyPreviewTitle}</p>
                <p className="text-xs text-muted-foreground">{studio.ui.helper.emptyPreviewBody}</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>{`${studio.ui.labels.status}: ${studio.captureStatusLabel}`}</div>
            <div>{`${studio.ui.labels.duration}: ${studio.formatDuration(studio.captureStatusQuery.data?.recordingDurationSeconds ?? 0)}`}</div>
            <div className="truncate">{`${studio.ui.labels.eventsURL}: ${studio.projectQuery.data?.eventsURL ?? studio.captureStatusQuery.data?.eventsURL ?? "-"}`}</div>
          </div>
        </div>
      </section>

      <InspectorPanel mode="edit" />
    </section>
  );
}
