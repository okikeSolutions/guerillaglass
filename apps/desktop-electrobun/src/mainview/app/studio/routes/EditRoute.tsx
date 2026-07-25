import { useRef, useState } from "react";
import { AspectRatio } from "@guerillaglass/ui/components/aspect-ratio";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@guerillaglass/ui/components/empty";
import { useStudio } from "../state/StudioProvider";
import { EditorWorkspace } from "../layout/EditorWorkspace";
import { InspectorPanel } from "../panels/InspectorPanel";
import { TimelineDock } from "../panels/TimelineDock";
import { ProjectUtilityPanel } from "../panels/ProjectUtilityPanel";
import { BackgroundFramingPreview } from "../panels/BackgroundFramingPreview";
import { formatCaptureTargetLabelFromMetadata } from "../view-model/captureTargetLabelFormatter";
import {
  useRecordingMediaSourceErrorRecovery,
  useRecordingMediaSourceLease,
} from "../hooks/useRecordingMediaSource";
import { useVideoPlaybackSync } from "../hooks/useVideoPlaybackSync";
import {
  StudioPane,
  StudioPaneBody,
  StudioPaneHeader,
  StudioPaneSubtitle,
  StudioPaneTitle,
} from "@guerillaglass/ui/desktop/studio-pane";

export function EditRoute() {
  const studio = useStudio();
  const {
    captureStatusQuery,
    formatDuration,
    formatInteger,
    playbackStore,
    setDisplayPlayheadSecondsFromMedia,
    projectQuery,
    recordingURL,
    selectedPreset,
    setPlayheadSecondsFromMedia,
    setTimelinePlaybackActive,
    timelineDuration,
    timelineItems,
    ui,
  } = studio;
  const mediaRef = useRef<HTMLVideoElement | null>(null);
  const sourceCardRef = useRef<HTMLDivElement | null>(null);
  const [sourceSize, setSourceSize] = useState({ width: 1920, height: 1080 });
  const outputSize = selectedPreset
    ? { width: selectedPreset.width, height: selectedPreset.height }
    : { width: 1920, height: 1080 };
  const { source: recordingMediaSource, refresh: refreshRecordingMediaSource } =
    useRecordingMediaSourceLease(recordingURL);
  const handleMediaError = useRecordingMediaSourceErrorRecovery(
    recordingMediaSource,
    refreshRecordingMediaSource,
  );
  const activeCaptureMetadata =
    captureStatusQuery.data?.captureMetadata ?? projectQuery.data?.captureMetadata;
  const activeCaptureTarget = formatCaptureTargetLabelFromMetadata({
    metadata: activeCaptureMetadata,
    displayLabel: ui.labels.display,
    windowLabel: ui.labels.window,
    untitledLabel: ui.values.untitled,
    formatInteger,
  });

  useVideoPlaybackSync({
    mediaRef,
    sourceCardRef,
    playbackStore,
    recordingMediaSource,
    timelineItems,
    timelineDuration,
    setTimelinePlaybackActive,
    setDisplayPlayheadSecondsFromMedia,
    setPlayheadSecondsFromMedia,
  });

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
            <StudioPaneTitle>{ui.workspace.editStageTitle}</StudioPaneTitle>
            <StudioPaneSubtitle>{ui.helper.activePreviewBody}</StudioPaneSubtitle>
          </StudioPaneHeader>
          <StudioPaneBody className="flex min-h-0 flex-col gap-4">
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
              <AspectRatio
                ratio={outputSize.width / outputSize.height}
                className="h-full w-auto max-h-full max-w-[1000px]"
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
                            cardRef={sourceCardRef}
                          >
                            {recordingMediaSource ? (
                              <video
                                ref={mediaRef}
                                key={recordingMediaSource}
                                src={recordingMediaSource}
                                className="h-full w-full object-contain"
                                preload="metadata"
                                controls
                                playsInline
                                onLoadedMetadata={(event) => {
                                  const video = event.currentTarget;
                                  if (video.videoWidth > 0 && video.videoHeight > 0) {
                                    setSourceSize({
                                      width: video.videoWidth,
                                      height: video.videoHeight,
                                    });
                                  }
                                }}
                                onPlay={() => {
                                  setTimelinePlaybackActive(true);
                                }}
                                onPause={() => {
                                  setTimelinePlaybackActive(false);
                                }}
                                onError={handleMediaError}
                              />
                            ) : captureStatusQuery.data?.isRunning ? (
                              <div className="flex h-full flex-col items-center justify-center space-y-2 text-center">
                                <p className="text-sm font-medium">
                                  {ui.helper.activePreviewTitle}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {ui.helper.activePreviewBody}
                                </p>
                              </div>
                            ) : (
                              <Empty className="h-full border-border/70 bg-background/70 p-6">
                                <EmptyHeader>
                                  <EmptyTitle className="text-sm">
                                    {ui.helper.emptyPreviewTitle}
                                  </EmptyTitle>
                                  <EmptyDescription>{ui.helper.emptyPreviewBody}</EmptyDescription>
                                </EmptyHeader>
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

            <div className="gg-copy-compact shrink-0 grid grid-cols-3 gap-2">
              <div className="truncate">{`${ui.labels.recordingURL}: ${recordingURL ?? "-"}`}</div>
              <div>{`${ui.labels.duration}: ${formatDuration(captureStatusQuery.data?.recordingDurationSeconds ?? 0)}`}</div>
              <div className="truncate">{`${ui.labels.captureSource}: ${activeCaptureTarget ?? "-"}`}</div>
            </div>
          </StudioPaneBody>
        </StudioPane>
      }
      rightPane={<InspectorPanel mode="edit" />}
      bottomPane={<TimelineDock />}
    />
  );
}
