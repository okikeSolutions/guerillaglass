import { ChevronRight, ScreenShare, ShieldCheck } from "lucide-react";
import { type ReactNode } from "react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldContent, FieldLabel } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { engineApi } from "@/lib/engine";
import { cn } from "@/lib/utils";
import { useStudio } from "../state/StudioProvider";
import { EditorWorkspace } from "../layout/EditorWorkspace";
import { InspectorPanel } from "../panels/InspectorPanel";
import { TimelineDock } from "../panels/TimelineDock";
import { useRecordingMediaSource } from "../hooks/useRecordingMediaSource";
import {
  StudioPane,
  StudioPaneBody,
  StudioPaneHeader,
  StudioPaneSubtitle,
  StudioPaneTitle,
} from "../layout/StudioPanePrimitives";

export function CaptureRoute() {
  const studio = useStudio();
  const settingsValues = studio.settingsForm.state.values;
  const recordingMediaSource = useRecordingMediaSource(studio.recordingURL);

  return (
    <EditorWorkspace
      leftPane={
        <StudioPane side="left">
          <StudioPaneHeader>
            <StudioPaneTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> {studio.ui.sections.leftRail}
            </StudioPaneTitle>
            <StudioPaneSubtitle>{studio.ui.labels.inputMonitoring}</StudioPaneSubtitle>
          </StudioPaneHeader>
          <StudioPaneBody className="gg-copy-compact gg-inspector-pane-body">
            <CaptureLeftSection title={studio.ui.labels.inputMonitoring}>
              <div className="gg-inspector-detail-list">
                <div className="gg-inspector-detail-row">{`${studio.ui.labels.screen}: ${studio.permissionsQuery.data?.screenRecordingGranted ? studio.ui.values.granted : studio.ui.values.notGranted}`}</div>
                <div className="gg-inspector-detail-row">{`${studio.ui.labels.microphone}: ${studio.permissionsQuery.data?.microphoneGranted ? studio.ui.values.granted : studio.ui.values.notGranted}`}</div>
                <div className="gg-inspector-detail-row">{`${studio.ui.labels.inputMonitoring}: ${studio.permissionsQuery.data?.inputMonitoring ?? studio.ui.values.unknown}`}</div>
              </div>

              <div className="gg-left-rail-actions pt-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="gg-left-rail-action"
                  onClick={() => void studio.requestPermissionMutation.mutateAsync("screen")}
                >
                  {studio.ui.actions.requestScreen}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="gg-left-rail-action"
                  onClick={() => void studio.requestPermissionMutation.mutateAsync("mic")}
                >
                  {studio.ui.actions.requestMic}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="gg-left-rail-action"
                  onClick={() => void studio.requestPermissionMutation.mutateAsync("input")}
                >
                  {studio.ui.actions.requestInput}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="gg-left-rail-action"
                  onClick={() => void engineApi.openInputMonitoringSettings()}
                >
                  {studio.ui.actions.openSettings}
                </Button>
              </div>
            </CaptureLeftSection>

            <CaptureLeftSection title={studio.ui.labels.captureSource}>
              <studio.settingsForm.Field name="captureSource">
                {(field) => (
                  <Field>
                    <FieldLabel>{studio.ui.labels.captureSource}</FieldLabel>
                    <FieldContent>
                      <RadioGroup
                        className="flex gap-3"
                        value={field.state.value}
                        onValueChange={(nextValue) => {
                          if (nextValue === "display") {
                            field.handleChange("display");
                            if (studio.inspectorSelection.kind === "captureWindow") {
                              studio.clearInspectorSelection();
                            }
                            return;
                          }

                          if (nextValue === "window") {
                            field.handleChange("window");
                            const selectedWindow = studio.windowChoices.find(
                              (windowItem) => windowItem.id === studio.selectedWindowId,
                            );
                            if (!selectedWindow) {
                              return;
                            }
                            studio.selectCaptureWindow({
                              windowId: selectedWindow.id,
                              appName: selectedWindow.appName,
                              title: selectedWindow.title,
                            });
                          }
                        }}
                      >
                        <Label>
                          <RadioGroupItem value="display" />
                          {studio.ui.labels.display}
                        </Label>
                        <Label>
                          <RadioGroupItem value="window" />
                          {studio.ui.labels.window}
                        </Label>
                      </RadioGroup>
                    </FieldContent>
                  </Field>
                )}
              </studio.settingsForm.Field>

              {settingsValues.captureSource === "window" ? (
                <studio.settingsForm.Field name="selectedWindowId">
                  {(field) => (
                    <Field>
                      <FieldLabel>{studio.ui.labels.window}</FieldLabel>
                      <FieldContent>
                        <NativeSelect
                          value={String(studio.selectedWindowId)}
                          onChange={(event) => {
                            const windowId = Number(event.target.value);
                            field.handleChange(windowId);
                            const selectedWindow = studio.windowChoices.find(
                              (windowItem) => windowItem.id === windowId,
                            );
                            if (!selectedWindow) {
                              studio.clearInspectorSelection();
                              return;
                            }
                            studio.selectCaptureWindow({
                              windowId: selectedWindow.id,
                              appName: selectedWindow.appName,
                              title: selectedWindow.title,
                            });
                          }}
                        >
                          {studio.windowChoices.length === 0 ? (
                            <NativeSelectOption value="0">
                              {studio.ui.labels.noWindows}
                            </NativeSelectOption>
                          ) : null}
                          {studio.windowChoices.map((windowItem) => (
                            <NativeSelectOption key={windowItem.id} value={String(windowItem.id)}>
                              {windowItem.appName} - {windowItem.title || studio.ui.values.untitled}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                      </FieldContent>
                    </Field>
                  )}
                </studio.settingsForm.Field>
              ) : null}
            </CaptureLeftSection>
          </StudioPaneBody>
        </StudioPane>
      }
      centerPane={
        <StudioPane as="section" side="center">
          <StudioPaneHeader>
            <StudioPaneTitle className="flex items-center gap-2">
              <ScreenShare className="h-4 w-4" /> {studio.ui.sections.center}
            </StudioPaneTitle>
          </StudioPaneHeader>
          <StudioPaneBody className="gg-preview-pane-body">
            <div className="gg-preview-workspace">
              <div className="gg-preview-stage-wrap">
                <AspectRatio ratio={16 / 9} className="h-auto w-auto">
                  <div className="gg-preview-stage">
                    {studio.captureStatusQuery.data?.isRecording ? (
                      <div className="text-center">
                        <p className="text-sm font-medium">{studio.ui.helper.activePreviewTitle}</p>
                      </div>
                    ) : recordingMediaSource ? (
                      <video
                        key={recordingMediaSource}
                        src={recordingMediaSource}
                        className="h-full w-full rounded-md object-contain"
                        preload="metadata"
                        controls
                        playsInline
                      />
                    ) : (
                      <Empty className="max-w-lg border-0 bg-transparent p-6">
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
            </div>

            {studio.inputMonitoringDenied && settingsValues.trackInputEvents ? (
              <p className="px-5 pb-3 text-xs text-destructive/90">
                {studio.ui.helper.degradedModeTitle}
              </p>
            ) : null}
          </StudioPaneBody>
        </StudioPane>
      }
      rightPane={<InspectorPanel mode="capture" />}
      bottomPane={<TimelineDock />}
    />
  );
}

function CaptureLeftSection({
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
