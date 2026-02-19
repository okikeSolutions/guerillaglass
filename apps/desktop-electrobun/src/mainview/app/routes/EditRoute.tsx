import { InspectorPanel } from "./InspectorPanel";
import { ProjectUtilityPanel } from "./ProjectUtilityPanel";
import { useStudio } from "../studio/context";

export function EditRoute() {
  const studio = useStudio();

  return (
    <section className="gg-editor-shell">
      <aside className="gg-pane gg-pane-left">
        <ProjectUtilityPanel />
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
