import { Link } from "@tanstack/react-router";
import { Button, buttonVariants } from "@guerillaglass/ui/components/button";
import * as m from "../../../../paraglide/messages.js";
import { useSceneCameraPreview } from "../hooks/useSceneCameraPreview";
import { useEffect, useRef, useState } from "react";
import { AspectRatio } from "@guerillaglass/ui/components/aspect-ratio";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@guerillaglass/ui/components/empty";
import { useStudio } from "../state/StudioProvider";
import { BackgroundFramingPreview } from "../panels/BackgroundFramingPreview";
import {
  useRecordingMediaSourceErrorRecovery,
  useRecordingMediaSourceLease,
} from "../hooks/useRecordingMediaSource";
import { useVideoPlaybackSync } from "../hooks/useVideoPlaybackSync";
import { ProgramPreviewControls } from "../panels/ProgramPreviewControls";
import { readEmbeddedAudioTrackCount } from "../domain/sourceAudioPresentation";
import { StudioPaneBody } from "@guerillaglass/ui/desktop/studio-pane";

export function ProgramPreview() {
  const studio = useStudio();
  const {
    captureStatusQuery,
    playbackStore,
    setDisplayPlayheadSecondsFromMedia,
    recordingURL,
    selectedPreset,
    setPlayheadSecondsFromMedia,
    setTimelinePlaybackActive,
    timelineDuration,
    timelineItems,
    ui,
  } = studio;
  const fullscreenRef = useRef<HTMLDivElement | null>(null);
  const mediaRef = useRef<HTMLVideoElement | null>(null);
  const sourceCardRef = useRef<HTMLDivElement | null>(null);
  const [sourceSize, setSourceSize] = useState({ width: 1920, height: 1080 });
  const outputSize = selectedPreset
    ? { width: selectedPreset.width, height: selectedPreset.height }
    : { width: 1920, height: 1080 };
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const {
    source: recordingMediaSource,
    refresh: refreshRecordingMediaSource,
    error: mediaError,
    isPending: mediaPending,
  } = useRecordingMediaSourceLease(recordingURL);
  const handleMediaError = useRecordingMediaSourceErrorRecovery(
    recordingMediaSource,
    refreshRecordingMediaSource,
  );
  useEffect(() => {
    const video = mediaRef.current;
    if (video) {
      video.volume = studio.previewAudio.volume;
      video.muted = studio.previewAudio.muted;
    }
  }, [studio.previewAudio, recordingMediaSource, failedSource, mediaError]);
  useSceneCameraPreview({
    mediaRef,
    sourceCardRef,
    playbackStore,
    timelineItems,
    recordingMediaSource,
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
    <StudioPaneBody className="flex min-h-0 flex-col gap-4">
      <div
        ref={fullscreenRef}
        className="flex min-h-0 flex-1 flex-col bg-background"
        data-testid="program-preview-fullscreen"
      >
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
          <AspectRatio
            ratio={outputSize.width / outputSize.height}
            className="h-full w-auto max-h-full max-w-full"
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
                        {recordingURL &&
                        (mediaError ||
                          (failedSource !== null && failedSource === recordingMediaSource)) ? (
                          <div className="flex flex-col gap-3 p-6 text-center" role="alert">
                            <p>
                              {m.ui_workflow_media_failed(undefined, { locale: studio.locale })}
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
                        ) : recordingURL && mediaPending ? (
                          <p role="status">
                            {m.ui_workflow_loading_media(undefined, { locale: studio.locale })}
                          </p>
                        ) : recordingMediaSource ? (
                          <video
                            ref={mediaRef}
                            key={recordingMediaSource}
                            src={recordingMediaSource}
                            className="h-full w-full object-contain"
                            preload="metadata"
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
                        ) : captureStatusQuery.data?.isRunning ? (
                          <div className="flex h-full flex-col items-center justify-center space-y-2 text-center">
                            <p className="text-sm font-medium">{ui.helper.activePreviewTitle}</p>
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
                              <div className="flex flex-wrap justify-center gap-2 pt-3">
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={studio.isRunningAction}
                                  onClick={() => void studio.openProjectMutation.mutateAsync()}
                                >
                                  {ui.actions.openProject}
                                </Button>
                                <Link
                                  to="/$locale/capture"
                                  params={{ locale: studio.locale }}
                                  className={buttonVariants({ variant: "outline", size: "sm" })}
                                >
                                  {m.ui_preview_go_capture(undefined, { locale: studio.locale })}
                                </Link>
                              </div>
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

        <ProgramPreviewControls
          targetRef={fullscreenRef}
          available={
            Boolean(recordingMediaSource) && !mediaError && failedSource !== recordingMediaSource
          }
        />
      </div>
    </StudioPaneBody>
  );
}
