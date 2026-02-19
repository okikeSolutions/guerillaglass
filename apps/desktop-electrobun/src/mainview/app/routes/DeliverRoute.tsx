import { HardDriveDownload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InspectorPanel } from "./InspectorPanel";
import { useStudio } from "../studio/context";

export function DeliverRoute() {
  const studio = useStudio();

  return (
    <section className="gg-editor-shell">
      <aside className="gg-pane gg-pane-left">
        <div className="gg-pane-header">
          <h2 className="text-sm font-semibold tracking-wide uppercase">Delivery Summary</h2>
          <p className="gg-pane-subtitle">Final output settings and project metadata</p>
        </div>
        <div className="gg-pane-body space-y-3 text-sm">
          <div className="truncate">{`${studio.ui.labels.projectPath}: ${studio.projectQuery.data?.projectPath ?? studio.ui.labels.notSaved}`}</div>
          <div className="truncate">{`${studio.ui.labels.recordingURL}: ${studio.recordingURL ?? "-"}`}</div>
          <div>{`${studio.ui.labels.duration}: ${studio.formatDuration(studio.captureStatusQuery.data?.recordingDurationSeconds ?? 0)}`}</div>
          <div>{`${studio.ui.labels.trimInSeconds}: ${studio.exportForm.state.values.trimStartSeconds.toFixed(2)}`}</div>
          <div>{`${studio.ui.labels.trimOutSeconds}: ${studio.exportForm.state.values.trimEndSeconds.toFixed(2)}`}</div>
          <div>{`${studio.ui.labels.preset}: ${studio.selectedPreset?.name ?? "-"}`}</div>
        </div>
      </aside>

      <section className="gg-pane gg-pane-center">
        <div className="gg-pane-header">
          <h2 className="text-sm font-semibold tracking-wide uppercase">Export</h2>
          <p className="gg-pane-subtitle">Type-safe delivery form with validation-ready shape</p>
        </div>
        <div className="gg-pane-body space-y-3 text-sm">
          <studio.exportForm.Field name="presetId">
            {(field) => (
              <label className="grid gap-1">
                {studio.ui.labels.preset}
                <select
                  className="gg-input"
                  value={field.state.value}
                  onChange={(event) => {
                    field.handleChange(event.target.value);
                    studio.selectExportPreset(event.target.value);
                  }}
                >
                  {studio.exportPresets.map((preset) => (
                    <option
                      key={preset.id}
                      value={preset.id}
                    >{`${preset.name} · ${studio.formatAspectRatio(
                      preset.width,
                      preset.height,
                    )}`}</option>
                  ))}
                </select>
              </label>
            )}
          </studio.exportForm.Field>

          <studio.exportForm.Field name="fileName">
            {(field) => (
              <label className="grid gap-1">
                {studio.ui.labels.fileName}
                <input
                  className="gg-input"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </label>
            )}
          </studio.exportForm.Field>

          <studio.exportForm.Field name="trimStartSeconds">
            {(field) => (
              <label className="grid gap-1">
                {studio.ui.labels.trimInSeconds}
                <input
                  className="gg-input"
                  type="number"
                  min={0}
                  value={field.state.value}
                  onChange={(event) =>
                    field.handleChange(
                      Math.min(
                        studio.timelineDuration,
                        Math.max(0, Number(event.target.value) || 0),
                      ),
                    )
                  }
                />
              </label>
            )}
          </studio.exportForm.Field>

          <studio.exportForm.Field name="trimEndSeconds">
            {(field) => (
              <label className="grid gap-1">
                {studio.ui.labels.trimOutSeconds}
                <input
                  className="gg-input"
                  type="number"
                  min={0}
                  value={field.state.value}
                  onChange={(event) =>
                    field.handleChange(
                      Math.min(
                        studio.timelineDuration,
                        Math.max(0, Number(event.target.value) || 0),
                      ),
                    )
                  }
                />
              </label>
            )}
          </studio.exportForm.Field>

          <Button
            onClick={() => void studio.exportMutation.mutateAsync()}
            disabled={studio.isRunningAction || !studio.recordingURL}
          >
            <HardDriveDownload className="mr-2 h-4 w-4" /> {studio.ui.actions.exportNow}
          </Button>
        </div>
      </section>

      <InspectorPanel mode="deliver" />
    </section>
  );
}
