import { HardDriveDownload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useStudio } from "../studio/context";
import { EditorWorkspace } from "./EditorWorkspace";
import { InspectorPanel } from "./InspectorPanel";

export function DeliverRoute() {
  const studio = useStudio();
  const exportDisabledReason = studio.recordingURL ? undefined : studio.recordingRequiredNotice;

  return (
    <EditorWorkspace
      leftPane={
        <aside className="gg-pane gg-pane-left">
          <div className="gg-pane-header">
            <h2 className="text-sm font-semibold tracking-wide uppercase">
              {studio.ui.workspace.deliverSummaryTitle}
            </h2>
            <p className="gg-pane-subtitle">{studio.ui.workspace.deliverSummarySubtitle}</p>
          </div>
          <div className="gg-pane-body space-y-3 text-sm">
            <div className="truncate">{`${studio.ui.labels.projectPath}: ${studio.projectQuery.data?.projectPath ?? studio.ui.labels.notSaved}`}</div>
            <div className="truncate">{`${studio.ui.labels.recordingURL}: ${studio.recordingURL ?? "-"}`}</div>
            <div>{`${studio.ui.labels.duration}: ${studio.formatDuration(studio.captureStatusQuery.data?.recordingDurationSeconds ?? 0)}`}</div>
            <div>{`${studio.ui.labels.trimInSeconds}: ${studio.formatDecimal(studio.exportForm.state.values.trimStartSeconds)}`}</div>
            <div>{`${studio.ui.labels.trimOutSeconds}: ${studio.formatDecimal(studio.exportForm.state.values.trimEndSeconds)}`}</div>
            <div>{`${studio.ui.labels.preset}: ${studio.selectedPreset?.name ?? "-"}`}</div>
          </div>
        </aside>
      }
      centerPane={
        <section className="gg-pane gg-pane-center">
          <div className="gg-pane-header">
            <h2 className="text-sm font-semibold tracking-wide uppercase">
              {studio.ui.workspace.exportTitle}
            </h2>
            <p className="gg-pane-subtitle">{studio.ui.workspace.exportSubtitle}</p>
          </div>
          <div className="gg-pane-body space-y-3 text-sm">
            <studio.exportForm.Field name="presetId">
              {(field) => (
                <Label className="grid gap-1">
                  {studio.ui.labels.preset}
                  <NativeSelect
                    value={studio.selectedPresetId}
                    onChange={(event) => {
                      field.handleChange(event.target.value);
                      studio.selectExportPreset(event.target.value);
                    }}
                  >
                    {studio.exportPresets.map((preset) => (
                      <NativeSelectOption
                        key={preset.id}
                        value={preset.id}
                      >{`${preset.name} · ${studio.formatAspectRatio(
                        preset.width,
                        preset.height,
                      )}`}</NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Label>
              )}
            </studio.exportForm.Field>

            <studio.exportForm.Field name="fileName">
              {(field) => (
                <Label className="grid gap-1">
                  {studio.ui.labels.fileName}
                  <Input
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                </Label>
              )}
            </studio.exportForm.Field>

            <studio.exportForm.Field name="trimStartSeconds">
              {(field) => (
                <Label className="grid gap-1">
                  {studio.ui.labels.trimInSeconds}
                  <Input
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
                </Label>
              )}
            </studio.exportForm.Field>

            <studio.exportForm.Field name="trimEndSeconds">
              {(field) => (
                <Label className="grid gap-1">
                  {studio.ui.labels.trimOutSeconds}
                  <Input
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
                </Label>
              )}
            </studio.exportForm.Field>

            <Button
              onClick={() => void studio.exportMutation.mutateAsync()}
              disabled={studio.isRunningAction || !studio.recordingURL}
              title={exportDisabledReason}
            >
              <HardDriveDownload className="mr-2 h-4 w-4" /> {studio.ui.actions.exportNow}
            </Button>
            {!studio.recordingURL ? (
              <p className="text-xs text-muted-foreground">{studio.recordingRequiredNotice}</p>
            ) : null}
          </div>
        </section>
      }
      rightPane={<InspectorPanel mode="deliver" />}
    />
  );
}
