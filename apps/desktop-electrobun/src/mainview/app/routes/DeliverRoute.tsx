import { ChevronRight, HardDriveDownload } from "lucide-react";
import { type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldContent, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import { useStudio } from "../studio/context";
import { EditorWorkspace } from "./EditorWorkspace";
import { InspectorPanel } from "./InspectorPanel";
import { TimelineDock } from "./TimelineDock";
import {
  StudioPane,
  StudioPaneBody,
  StudioPaneHeader,
  StudioPaneSubtitle,
  StudioPaneTitle,
} from "./StudioPane";

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
            <DeliverLeftSection title={studio.ui.inspectorTabs.project}>
              <div className="gg-inspector-detail-list gg-numeric">
                <div className="gg-inspector-detail-row truncate">{`${studio.ui.labels.projectPath}: ${studio.projectQuery.data?.projectPath ?? studio.ui.labels.notSaved}`}</div>
                <div className="gg-inspector-detail-row truncate">{`${studio.ui.labels.recordingURL}: ${studio.recordingURL ?? "-"}`}</div>
                <div className="gg-inspector-detail-row">{`${studio.ui.labels.duration}: ${studio.formatDuration(studio.captureStatusQuery.data?.recordingDurationSeconds ?? 0)}`}</div>
              </div>
            </DeliverLeftSection>

            <DeliverLeftSection title={studio.ui.inspectorTabs.export}>
              <div className="gg-inspector-detail-list gg-numeric">
                <div className="gg-inspector-detail-row">{`${studio.ui.labels.trimInSeconds}: ${studio.formatDecimal(studio.exportForm.state.values.trimStartSeconds)}`}</div>
                <div className="gg-inspector-detail-row">{`${studio.ui.labels.trimOutSeconds}: ${studio.formatDecimal(studio.exportForm.state.values.trimEndSeconds)}`}</div>
                <div className="gg-inspector-detail-row">{`${studio.ui.labels.preset}: ${studio.selectedPreset?.name ?? "-"}`}</div>
              </div>
            </DeliverLeftSection>
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

function DeliverLeftSection({
  title,
  children,
  className,
}: {
  title: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Collapsible defaultOpen={false} className={cn("gg-inspector-section", className)}>
      <CollapsibleTrigger className="gg-inspector-section-trigger">
        <ChevronRight className="gg-inspector-section-chevron" />
        <h3 className="gg-inspector-section-header border-0 pb-0">{title}</h3>
      </CollapsibleTrigger>
      <CollapsibleContent className="gg-inspector-section-content">
        <div className="gg-inspector-section-body">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
