import { capturePermissionState } from "../view-model/capturePermissionState";
import * as m from "../../../../paraglide/messages.js";
import { useState } from "react";
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
import { readEmbeddedAudioTrackCount } from "../domain/sourceAudioPresentation";
import { BackgroundFramingPreview } from "../panels/BackgroundFramingPreview";
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
  const permissionState = capturePermissionState(studio.permissionsQuery);
  const permissionChecking = permissionState === "checking";
  const permissionFailed = permissionState === "failed";
  const retryPermission = (
    <Button
      size="sm"
      variant="outline"
      disabled={studio.permissionsQuery.isFetching}
      onClick={() => void studio.permissionsQuery.refetch()}
    >
      {m.ui_capture_retry_permission(undefined, { locale: studio.locale })}
    </Button>
  );
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const {
    source: recordingMediaSource,
    refresh: refreshRecordingMediaSource,
    error: mediaError,
    isPending: mediaPending,
  } = useRecordingMediaSourceLease(studio.recordingURL);
  const handleMediaError = useRecordingMediaSourceErrorRecovery(
    recordingMediaSource,
    refreshRecordingMediaSource,
  );
  const [sourceSize, setSourceSize] = useState({ width: 1920, height: 1080 });
  const outputSize = studio.selectedPreset
    ? { width: studio.selectedPreset.width, height: studio.selectedPreset.height }
    : { width: 1920, height: 1080 };
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
            <StudioPaneSubtitle>{studio.ui.helper.captureSetup}</StudioPaneSubtitle>
          </StudioPaneHeader>
          <StudioPaneBody className="gg-copy-compact gg-inspector-pane-body">
            <DesktopPanelSection defaultOpen title={studio.ui.labels.permissions}>
              {permissionChecking ? (
                <p role="status">
                  {m.ui_capture_permission_checking(undefined, { locale: studio.locale })}
                </p>
              ) : permissionFailed ? (
                <div role="alert" className="space-y-2">
                  <p>
                    {m.ui_capture_permission_check_failed(undefined, { locale: studio.locale })}
                  </p>
                  {retryPermission}
                </div>
              ) : (
                <>
                  <DesktopPanelDetailRows
                    rows={[
                      {
                        label: studio.ui.labels.screen,
                        value: !studio.permissionsQuery.data
                          ? studio.ui.values.unknown
                          : studio.permissionsQuery.data.screenRecordingGranted
                            ? studio.ui.values.granted
                            : studio.ui.values.notGranted,
                      },
                      {
                        label: studio.ui.labels.microphone,
                        value: !studio.permissionsQuery.data
                          ? studio.ui.values.unknown
                          : studio.permissionsQuery.data.microphoneGranted
                            ? studio.ui.values.granted
                            : studio.ui.values.notGranted,
                      },
                      {
                        label: studio.ui.labels.inputMonitoring,
                        value:
                          studio.permissionsQuery.data?.inputMonitoring === "granted"
                            ? studio.ui.values.granted
                            : studio.permissionsQuery.data?.inputMonitoring === "denied"
                              ? studio.ui.values.notGranted
                              : studio.ui.values.unknown,
                      },
                    ]}
                  />
                  <p className="text-xs text-muted-foreground">
                    {m.ui_permission_recovery_help(undefined, { locale: studio.locale })}
                  </p>
                </>
              )}
              {studio.permissionsQuery.isSuccess ? (
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
                    style={{
                      height: "auto",
                      minHeight: "2rem",
                      whiteSpace: "normal",
                      textAlign: "left",
                    }}
                    onClick={() => void engineApi.openInputMonitoringSettings()}
                  >
                    {studio.ui.actions.openSettings}
                  </Button>
                </div>
              ) : null}
            </DesktopPanelSection>

            <DesktopPanelSection defaultOpen title={studio.ui.labels.captureSource}>
              <studio.settingsForm.Field name="captureSource">
                {(field) => (
                  <Field>
                    <FieldLabel>{studio.ui.labels.captureSource}</FieldLabel>
                    <FieldContent>
                      <RadioGroup
                        aria-label={studio.ui.labels.captureSource}
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
                          aria-label={studio.ui.labels.window}
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
                          aria-label={studio.ui.labels.display}
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
                <AspectRatio
                  ratio={outputSize.width / outputSize.height}
                  className={cn(
                    "max-h-full max-w-[1000px]",
                    outputSize.width >= outputSize.height ? "w-full" : "h-full w-auto",
                  )}
                >
                  <div className="gg-preview-stage">
                    <studio.settingsForm.Field name="backgroundFraming">
                      {(field) => (
                        <studio.settingsForm.Field name="autoZoom">
                          {(autoZoomField) => (
                            <BackgroundFramingPreview
                              settings={
                                studio.backgroundFramingSupported
                                  ? field.state.value
                                  : { ...field.state.value, enabled: false }
                              }
                              outputSize={outputSize}
                              sourceSize={sourceSize}
                              cameraReframeEnabled={autoZoomField.state.value.isEnabled}
                            >
                              {isCaptureRunning ? (
                                <div className="relative h-full w-full overflow-hidden">
                                  <img
                                    ref={liveCapturePreviewImageRef}
                                    alt={studio.ui.helper.activePreviewTitle}
                                    className={cn(
                                      "h-full w-full object-contain",
                                      liveCapturePreviewHasFrame ? "block" : "hidden",
                                    )}
                                    onLoad={(event) => {
                                      const image = event.currentTarget;
                                      if (image.naturalWidth > 0 && image.naturalHeight > 0) {
                                        setSourceSize((current) =>
                                          current.width === image.naturalWidth &&
                                          current.height === image.naturalHeight
                                            ? current
                                            : {
                                                width: image.naturalWidth,
                                                height: image.naturalHeight,
                                              },
                                        );
                                      }
                                    }}
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
                              ) : studio.recordingURL &&
                                (mediaError ||
                                  (failedSource !== null &&
                                    failedSource === recordingMediaSource)) ? (
                                <div className="flex flex-col gap-3 p-6 text-center" role="alert">
                                  <p>
                                    {m.ui_workflow_media_failed(undefined, {
                                      locale: studio.locale,
                                    })}
                                  </p>
                                  <Button
                                    variant="outline"
                                    onClick={() => {
                                      setFailedSource(null);
                                      void refreshRecordingMediaSource().catch(() =>
                                        setFailedSource(recordingMediaSource),
                                      );
                                    }}
                                  >
                                    {m.ui_workflow_retry(undefined, { locale: studio.locale })}
                                  </Button>
                                </div>
                              ) : studio.recordingURL && mediaPending ? (
                                <p role="status">
                                  {m.ui_workflow_loading_media(undefined, {
                                    locale: studio.locale,
                                  })}
                                </p>
                              ) : recordingMediaSource ? (
                                <video
                                  key={recordingMediaSource}
                                  src={recordingMediaSource}
                                  className="h-full w-full object-contain"
                                  preload="metadata"
                                  controls
                                  playsInline
                                  onLoadedMetadata={(event) => {
                                    setFailedSource(null);
                                    const video = event.currentTarget;
                                    studio.setRecordingMediaDurationSeconds(
                                      video.duration,
                                      {
                                        width: video.videoWidth,
                                        height: video.videoHeight,
                                      },
                                      readEmbeddedAudioTrackCount(video),
                                    );
                                    if (video.videoWidth > 0 && video.videoHeight > 0) {
                                      setSourceSize({
                                        width: video.videoWidth,
                                        height: video.videoHeight,
                                      });
                                    }
                                  }}
                                  onError={() => {
                                    setFailedSource(recordingMediaSource);
                                    handleMediaError();
                                  }}
                                />
                              ) : (
                                <Empty className="h-full border-0 bg-transparent p-6">
                                  <EmptyHeader>
                                    <EmptyTitle className="text-sm">
                                      {permissionChecking
                                        ? m.ui_capture_permission_checking(undefined, {
                                            locale: studio.locale,
                                          })
                                        : permissionFailed
                                          ? m.ui_capture_permission_check_failed(undefined, {
                                              locale: studio.locale,
                                            })
                                          : permissionState === "granted"
                                            ? studio.ui.helper.emptyPreviewTitle
                                            : permissionState === "denied"
                                              ? studio.ui.helper.capturePermissionTitle
                                              : m.ui_capture_permission_unknown(undefined, {
                                                  locale: studio.locale,
                                                })}
                                    </EmptyTitle>
                                    <EmptyDescription>
                                      {permissionState === "granted"
                                        ? studio.ui.helper.emptyPreviewBody
                                        : permissionState === "denied"
                                          ? studio.ui.helper.capturePermissionBody
                                          : studio.ui.helper.captureSetup}
                                    </EmptyDescription>
                                  </EmptyHeader>
                                  {permissionFailed || permissionState === "unknown"
                                    ? retryPermission
                                    : null}
                                </Empty>
                              )}
                            </BackgroundFramingPreview>
                          )}
                        </studio.settingsForm.Field>
                      )}
                    </studio.settingsForm.Field>
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
