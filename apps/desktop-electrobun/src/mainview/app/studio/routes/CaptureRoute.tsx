import { ScreenShare, ShieldCheck } from "lucide-react";
import { AspectRatio } from "@guerillaglass/ui/components/aspect-ratio";
import { Button } from "@guerillaglass/ui/components/button";
import { DesktopPanelDetailRows } from "@guerillaglass/ui/desktop/panel-detail";
import { DesktopPanelSection } from "@guerillaglass/ui/desktop/panel-section";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@guerillaglass/ui/components/empty";
import { Field, FieldContent, FieldLabel } from "@guerillaglass/ui/components/field";
import { Label } from "@guerillaglass/ui/components/label";
import { NativeSelect, NativeSelectOption } from "@guerillaglass/ui/components/native-select";
import { RadioGroup, RadioGroupItem } from "@guerillaglass/ui/components/radio-group";
import { engineApi } from "@lib/engine";
import { cn } from "@guerillaglass/ui";
import { useStudio } from "../state/StudioProvider";
import { EditorWorkspace } from "../layout/EditorWorkspace";
import { InspectorPanel } from "../panels/InspectorPanel";
import { useLiveCapturePreview } from "../hooks/useLiveCapturePreview";
import {
  useRecordingMediaSourceErrorRecovery,
  useRecordingMediaSourceLease,
} from "../hooks/useRecordingMediaSource";
import {
  StudioPane,
  StudioPaneBody,
  StudioPaneHeader,
  StudioPaneSubtitle,
  StudioPaneTitle,
} from "@guerillaglass/ui/desktop/studio-pane";

function displayOptionLabel(
  displayItem: ReturnType<typeof useStudio>["displayChoices"][number],
  ui: ReturnType<typeof useStudio>["ui"],
): string {
  const primarySuffix = displayItem.isPrimary ? ` (${ui.values.primary})` : "";
  return `${displayItem.displayName}${primarySuffix} - ${displayItem.width}x${displayItem.height}`;
}

export function CaptureRoute() {
  const studio = useStudio();
  const settingsValues = studio.settingsForm.state.values;
  const { source: recordingMediaSource, refresh: refreshRecordingMediaSource } =
    useRecordingMediaSourceLease(studio.recordingURL);
  const handleMediaError = useRecordingMediaSourceErrorRecovery(
    recordingMediaSource,
    refreshRecordingMediaSource,
  );
  const isCaptureRunning = Boolean(studio.captureStatusQuery.data?.isRunning);
  const captureSessionId = isCaptureRunning
    ? (studio.captureStatusQuery.data?.captureSessionId ?? null)
    : null;
  const { hasFrame: liveCapturePreviewHasFrame, imageRef: liveCapturePreviewImageRef } =
    useLiveCapturePreview(captureSessionId);

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
            <DesktopPanelSection title={studio.ui.labels.inputMonitoring}>
              <DesktopPanelDetailRows
                rows={[
                  {
                    label: studio.ui.labels.screen,
                    value: studio.permissionsQuery.data?.screenRecordingGranted
                      ? studio.ui.values.granted
                      : studio.ui.values.notGranted,
                  },
                  {
                    label: studio.ui.labels.microphone,
                    value: studio.permissionsQuery.data?.microphoneGranted
                      ? studio.ui.values.granted
                      : studio.ui.values.notGranted,
                  },
                  {
                    label: studio.ui.labels.inputMonitoring,
                    value:
                      studio.permissionsQuery.data?.inputMonitoring ?? studio.ui.values.unknown,
                  },
                ]}
              />

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
            </DesktopPanelSection>

            <DesktopPanelSection title={studio.ui.labels.captureSource}>
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

              {settingsValues.captureSource === "display" ? (
                <studio.settingsForm.Field name="selectedDisplayId">
                  {(field) => (
                    <Field>
                      <FieldLabel>{studio.ui.labels.display}</FieldLabel>
                      <FieldContent>
                        <NativeSelect
                          value={String(studio.selectedDisplayId)}
                          disabled={studio.displayChoices.length <= 1}
                          onChange={(event) => {
                            field.handleChange(Number(event.target.value));
                          }}
                        >
                          {studio.displayChoices.length === 0 ? (
                            <NativeSelectOption value="0">
                              {studio.ui.labels.noDisplays}
                            </NativeSelectOption>
                          ) : null}
                          {studio.displayChoices.map((displayItem) => (
                            <NativeSelectOption key={displayItem.id} value={String(displayItem.id)}>
                              {displayOptionLabel(displayItem, studio.ui)}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                      </FieldContent>
                    </Field>
                  )}
                </studio.settingsForm.Field>
              ) : null}
            </DesktopPanelSection>
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
                    {isCaptureRunning ? (
                      <div className="relative h-full w-full overflow-hidden rounded-md">
                        <img
                          ref={liveCapturePreviewImageRef}
                          alt={studio.ui.helper.activePreviewTitle}
                          className={cn(
                            "h-full w-full object-contain",
                            liveCapturePreviewHasFrame ? "block" : "hidden",
                          )}
                        />
                        {!liveCapturePreviewHasFrame ? (
                          <div className="flex h-full w-full items-center justify-center text-center">
                            <p className="text-sm font-medium">
                              {studio.ui.helper.activePreviewTitle}
                            </p>
                          </div>
                        ) : null}

                        {studio.captureStatusQuery.data?.isRecording ? (
                          <div className="pointer-events-none absolute top-4 left-4 flex items-center gap-2 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white shadow-lg ring-1 ring-white/15 backdrop-blur-sm">
                            <span className="h-2 w-2 rounded-full bg-red-500" />
                            {studio.ui.labels.recording}
                          </div>
                        ) : null}
                      </div>
                    ) : recordingMediaSource ? (
                      <video
                        key={recordingMediaSource}
                        src={recordingMediaSource}
                        className="h-full w-full rounded-md object-contain"
                        preload="metadata"
                        controls
                        playsInline
                        onError={handleMediaError}
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
      bottomPane={null}
    />
  );
}
