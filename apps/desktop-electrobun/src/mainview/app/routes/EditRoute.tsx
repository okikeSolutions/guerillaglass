import { MonitorCog, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
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

      <aside className="gg-pane gg-pane-right">
        <div className="gg-pane-header">
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide uppercase">
            <MonitorCog className="h-4 w-4" /> Inspector
          </h2>
          <p className="gg-pane-subtitle">Selection-aware editing controls</p>
        </div>
        <div className="gg-pane-body space-y-3 text-sm">
          <studio.settingsForm.Field name="autoZoom">
            {(field) => (
              <div className="rounded-md border border-border/70 bg-background/70 p-3">
                <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                  <span className="inline-flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5" /> Effects
                  </span>
                </p>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={field.state.value.isEnabled}
                    onChange={(event) =>
                      field.handleChange({
                        ...field.state.value,
                        isEnabled: event.target.checked,
                      })
                    }
                  />
                  {studio.ui.labels.autoZoomEnabled}
                </label>
                <label className="mt-2 grid gap-1">
                  {studio.ui.labels.autoZoomIntensity(
                    Math.round(field.state.value.intensity * 100),
                  )}
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={field.state.value.intensity}
                    onChange={(event) =>
                      field.handleChange({
                        ...field.state.value,
                        intensity: Number(event.target.value),
                      })
                    }
                  />
                </label>
              </div>
            )}
          </studio.settingsForm.Field>
        </div>
      </aside>
    </section>
  );
}
