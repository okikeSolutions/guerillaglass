import { HardDriveDownload } from "lucide-react";
import { Button } from "@guerillaglass/ui/components/button";
import { Field, FieldContent, FieldLabel } from "@guerillaglass/ui/components/field";
import { Input } from "@guerillaglass/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@guerillaglass/ui/components/native-select";
import { useStudio } from "../state/StudioProvider";
import { EditorWorkspace } from "../layout/EditorWorkspace";
import { ProgramPreview } from "./ProgramPreview";
import { ProjectUtilityPanel } from "../panels/ProjectUtilityPanel";
import * as m from "../../../../paraglide/messages.js";
import { TimelineDock } from "../panels/TimelineDock";
import {
  StudioPane,
  StudioPaneBody,
  StudioPaneHeader,
  StudioPaneTitle,
} from "@guerillaglass/ui/desktop/studio-pane";

export function DeliverRoute() {
  const studio = useStudio();
  const duration = studio.timelineItems.slice(-1)[0]?.programEndSeconds ?? 0;
  const selectedRange = studio.exportForm.state.values.rangeMode === "selected";
  const start = selectedRange ? studio.exportForm.state.values.trimStartSeconds : 0;
  const end = selectedRange ? studio.exportForm.state.values.trimEndSeconds : duration;
  const invalidRange =
    !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > duration;
  const exportDisabledReason = studio.recordingURL ? undefined : studio.recordingRequiredNotice;

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
            <StudioPaneTitle>{studio.ui.workspace.exportTitle}</StudioPaneTitle>
          </StudioPaneHeader>
          <ProgramPreview />
        </StudioPane>
      }
      rightPane={
        <StudioPane side="right">
          <StudioPaneHeader>
            <StudioPaneTitle>
              {m.ui_workflow_export_settings(undefined, { locale: studio.locale })}
            </StudioPaneTitle>
            <p className="text-xs text-muted-foreground">{studio.ui.workspace.exportSubtitle}</p>
          </StudioPaneHeader>
          <StudioPaneBody className="gg-copy-compact space-y-4">
            <p className="text-xs text-muted-foreground">
              {m.ui_workflow_export_draft(undefined, { locale: studio.locale })}
            </p>
            <Field>
              <FieldLabel htmlFor="export-range">
                {m.ui_workflow_export_range(undefined, { locale: studio.locale })}
              </FieldLabel>
              <NativeSelect
                id="export-range"
                value={studio.exportForm.state.values.rangeMode}
                onChange={(event) =>
                  studio.setExportRangeMode(event.target.value === "selected" ? "selected" : "full")
                }
              >
                <NativeSelectOption value="full">
                  {m.ui_workflow_full_program(undefined, { locale: studio.locale })}
                </NativeSelectOption>
                <NativeSelectOption value="selected">
                  {m.ui_workflow_selected_range(undefined, { locale: studio.locale })}
                </NativeSelectOption>
              </NativeSelect>
            </Field>
            <p className="gg-numeric">
              {studio.ui.labels.duration}: {studio.formatDuration(Math.max(0, end - start))}
            </p>
            {invalidRange && studio.recordingURL ? (
              <p role="alert" className="text-xs text-destructive">
                {m.ui_workflow_invalid_range(undefined, { locale: studio.locale })}
              </p>
            ) : null}
            <studio.exportForm.Field name="presetId">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor="export-preset">{studio.ui.labels.preset}</FieldLabel>
                  <FieldContent>
                    <NativeSelect
                      id="export-preset"
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
                  </FieldContent>
                </Field>
              )}
            </studio.exportForm.Field>

            <studio.exportForm.Field name="fileName">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor="export-filename">{studio.ui.labels.fileName}</FieldLabel>
                  <FieldContent>
                    <Input
                      id="export-filename"
                      value={field.state.value}
                      onChange={(event) => field.handleChange(event.target.value)}
                    />
                  </FieldContent>
                </Field>
              )}
            </studio.exportForm.Field>

            <studio.exportForm.Field name="trimStartSeconds">
              {() => (
                <Field>
                  <FieldLabel htmlFor="export-start">{studio.ui.labels.trimInSeconds}</FieldLabel>
                  <FieldContent>
                    <Input
                      id="export-start"
                      type="number"
                      step="any"
                      max={duration}
                      min={0}
                      value={start}
                      disabled={!selectedRange}
                      onChange={(event) => studio.setTrimStartSeconds(Number(event.target.value))}
                    />
                  </FieldContent>
                </Field>
              )}
            </studio.exportForm.Field>

            <studio.exportForm.Field name="trimEndSeconds">
              {() => (
                <Field>
                  <FieldLabel htmlFor="export-end">{studio.ui.labels.trimOutSeconds}</FieldLabel>
                  <FieldContent>
                    <Input
                      id="export-end"
                      type="number"
                      step="any"
                      max={duration}
                      min={0}
                      value={end}
                      disabled={!selectedRange}
                      onChange={(event) => studio.setTrimEndSeconds(Number(event.target.value))}
                    />
                  </FieldContent>
                </Field>
              )}
            </studio.exportForm.Field>

            <Button
              onClick={() => void studio.exportMutation.mutateAsync()}
              disabled={studio.isRunningAction || !studio.recordingURL || invalidRange}
              title={exportDisabledReason}
            >
              <HardDriveDownload className="mr-2 h-4 w-4" /> {studio.ui.actions.exportNow}
            </Button>
            {studio.exportMutation.isPending ? (
              <p role="status">{m.ui_io_export_pending(undefined, { locale: studio.locale })}</p>
            ) : studio.exportMutation.data ? (
              <div className="space-y-3" role="status">
                <p>
                  {studio.exportMutation.data.status === "succeeded"
                    ? m.ui_io_export_complete(undefined, { locale: studio.locale })
                    : studio.exportMutation.data.status === "queued"
                      ? m.ui_io_export_queued(undefined, { locale: studio.locale })
                      : studio.exportMutation.data.status === "running"
                        ? m.ui_io_export_running(undefined, { locale: studio.locale })
                        : m.ui_io_export_failed(undefined, { locale: studio.locale })}
                </p>
                {studio.exportMutation.data.status === "succeeded" ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={studio.isRunningAction || studio.exportResultAction.isPending}
                      onClick={() => studio.exportResultAction.mutate("open")}
                    >
                      {m.ui_io_open_video(undefined, { locale: studio.locale })}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={studio.isRunningAction || studio.exportResultAction.isPending}
                      onClick={() => studio.exportResultAction.mutate("reveal")}
                    >
                      {m.ui_io_reveal_file(undefined, { locale: studio.locale })}
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
            {!studio.recordingURL ? (
              <p className="text-xs text-muted-foreground">{studio.recordingRequiredNotice}</p>
            ) : null}
          </StudioPaneBody>
        </StudioPane>
      }
      bottomPane={<TimelineDock />}
    />
  );
}
