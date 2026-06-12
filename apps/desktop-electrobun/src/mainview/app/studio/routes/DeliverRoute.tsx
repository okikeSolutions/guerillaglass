import { HardDriveDownload } from "lucide-react";
import { Button } from "@guerillaglass/ui/components/button";
import { DesktopPanelDetailRows } from "@guerillaglass/ui/desktop/panel-detail";
import { DesktopPanelSection } from "@guerillaglass/ui/desktop/panel-section";
import { Field, FieldContent, FieldLabel } from "@guerillaglass/ui/components/field";
import { Input } from "@guerillaglass/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@guerillaglass/ui/components/native-select";
import { useStudio } from "../state/StudioProvider";
import { EditorWorkspace } from "../layout/EditorWorkspace";
import { InspectorPanel } from "../panels/InspectorPanel";
import { TimelineDock } from "../panels/TimelineDock";
import {
  StudioPane,
  StudioPaneBody,
  StudioPaneHeader,
  StudioPaneSubtitle,
  StudioPaneTitle,
} from "@guerillaglass/ui/desktop/studio-pane";

export function DeliverRoute() {
  const studio = useStudio();
  const exportDisabledReason = studio.recordingURL ? undefined : studio.recordingRequiredNotice;

  return (
    <EditorWorkspace
      leftPane={
        <StudioPane side="left">
          <StudioPaneHeader>
            <StudioPaneTitle>{studio.ui.workspace.deliverSummaryTitle}</StudioPaneTitle>
            <StudioPaneSubtitle>{studio.ui.workspace.deliverSummarySubtitle}</StudioPaneSubtitle>
          </StudioPaneHeader>
          <StudioPaneBody className="gg-copy-compact gg-inspector-pane-body">
            <DesktopPanelSection title={studio.ui.inspectorTabs.project}>
              <DesktopPanelDetailRows
                rows={[
                  {
                    label: studio.ui.labels.projectPath,
                    value: studio.projectQuery.data?.projectPath ?? studio.ui.labels.notSaved,
                    valueClassName: "truncate",
                  },
                  { label: studio.ui.labels.recordingURL, value: studio.recordingURL ?? "-" },
                  {
                    label: studio.ui.labels.duration,
                    value: studio.formatDuration(
                      studio.captureStatusQuery.data?.recordingDurationSeconds ?? 0,
                    ),
                  },
                ]}
              />
            </DesktopPanelSection>

            <DesktopPanelSection title={studio.ui.inspectorTabs.export}>
              <DesktopPanelDetailRows
                rows={[
                  {
                    label: studio.ui.labels.trimInSeconds,
                    value: studio.formatDecimal(studio.exportForm.state.values.trimStartSeconds),
                  },
                  {
                    label: studio.ui.labels.trimOutSeconds,
                    value: studio.formatDecimal(studio.exportForm.state.values.trimEndSeconds),
                  },
                  { label: studio.ui.labels.preset, value: studio.selectedPreset?.name ?? "-" },
                ]}
              />
            </DesktopPanelSection>
          </StudioPaneBody>
        </StudioPane>
      }
      centerPane={
        <StudioPane as="section" side="center">
          <StudioPaneHeader>
            <StudioPaneTitle>{studio.ui.workspace.exportTitle}</StudioPaneTitle>
            <StudioPaneSubtitle>{studio.ui.workspace.exportSubtitle}</StudioPaneSubtitle>
          </StudioPaneHeader>
          <StudioPaneBody className="gg-copy-compact space-y-3">
            <studio.exportForm.Field name="presetId">
              {(field) => (
                <Field>
                  <FieldLabel>{studio.ui.labels.preset}</FieldLabel>
                  <FieldContent>
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
                  </FieldContent>
                </Field>
              )}
            </studio.exportForm.Field>

            <studio.exportForm.Field name="fileName">
              {(field) => (
                <Field>
                  <FieldLabel>{studio.ui.labels.fileName}</FieldLabel>
                  <FieldContent>
                    <Input
                      value={field.state.value}
                      onChange={(event) => field.handleChange(event.target.value)}
                    />
                  </FieldContent>
                </Field>
              )}
            </studio.exportForm.Field>

            <studio.exportForm.Field name="trimStartSeconds">
              {(field) => (
                <Field>
                  <FieldLabel>{studio.ui.labels.trimInSeconds}</FieldLabel>
                  <FieldContent>
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
                  </FieldContent>
                </Field>
              )}
            </studio.exportForm.Field>

            <studio.exportForm.Field name="trimEndSeconds">
              {(field) => (
                <Field>
                  <FieldLabel>{studio.ui.labels.trimOutSeconds}</FieldLabel>
                  <FieldContent>
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
                  </FieldContent>
                </Field>
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
          </StudioPaneBody>
        </StudioPane>
      }
      rightPane={<InspectorPanel mode="deliver" />}
      bottomPane={<TimelineDock />}
    />
  );
}
