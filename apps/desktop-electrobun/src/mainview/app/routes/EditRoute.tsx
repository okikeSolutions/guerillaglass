import { useEffect, useRef } from "react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { useStudio } from "../studio/context";
import { EditorWorkspace } from "./EditorWorkspace";
import { InspectorPanel } from "./InspectorPanel";
import { TimelineDock } from "./TimelineDock";
import { ProjectUtilityPanel } from "./ProjectUtilityPanel";
import { captureTargetLabelFromMetadata } from "./captureTargetLabel";
import { useRecordingMediaSource } from "./useRecordingMediaSource";
import {
  StudioPane,
  StudioPaneBody,
  StudioPaneHeader,
  StudioPaneSubtitle,
  StudioPaneTitle,
} from "./StudioPane";

export function EditRoute() {
  const studio = useStudio();
  const {
    captureStatusQuery,
    formatDuration,
    formatInteger,
    isTimelinePlaying,
    playbackRate,
    playheadSeconds,
    projectQuery,
    recordingURL,
    setPlayheadSecondsFromMedia,
    setTimelinePlaybackActive,
    timelineDuration,
    ui,
  } = studio;
  const mediaRef = useRef<HTMLVideoElement | null>(null);
  const recordingMediaSource = useRecordingMediaSource(recordingURL);
  const activeCaptureMetadata =
    captureStatusQuery.data?.captureMetadata ?? projectQuery.data?.captureMetadata ?? null;
  const activeCaptureTarget = captureTargetLabelFromMetadata({
    metadata: activeCaptureMetadata,
    displayLabel: ui.labels.display,
    windowLabel: ui.labels.window,
    untitledLabel: ui.values.untitled,
    formatInteger,
  });

  useEffect(() => {
    const media = mediaRef.current;
    if (!media || !recordingMediaSource) {
      return;
    }

    media.playbackRate = playbackRate;
  }, [playbackRate, recordingMediaSource]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media || !recordingMediaSource) {
      return;
    }

    if (isTimelinePlaying) {
      void media.play().catch(() => {
        setTimelinePlaybackActive(false);
      });
      return;
    }
    media.pause();
  }, [isTimelinePlaying, recordingMediaSource, setTimelinePlaybackActive]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media || !recordingMediaSource || isTimelinePlaying) {
      return;
    }

    const boundedPlayhead = Math.max(0, Math.min(playheadSeconds, timelineDuration));
    if (Math.abs(media.currentTime - boundedPlayhead) <= 0.08) {
      return;
    }

    try {
      media.currentTime = boundedPlayhead;
    } catch {
      // Ignore seek errors while media is loading.
    }
  }, [isTimelinePlaying, playheadSeconds, recordingMediaSource, timelineDuration]);

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
              <AspectRatio ratio={16 / 9} className="h-full w-auto max-h-full max-w-[1000px]">
                <div className="gg-preview-stage">
                  {recordingMediaSource ? (
                    <video
                      ref={mediaRef}
                      key={recordingMediaSource}
                      src={recordingMediaSource}
                      className="h-full w-full rounded-md object-contain"
                      preload="metadata"
                      controls
                      playsInline
                      onTimeUpdate={(event) => {
                        setPlayheadSecondsFromMedia(event.currentTarget.currentTime);
                      }}
                      onPlay={() => {
                        setTimelinePlaybackActive(true);
                      }}
                      onPause={() => {
                        setTimelinePlaybackActive(false);
                      }}
                      onEnded={(event) => {
                        setTimelinePlaybackActive(false);
                        const duration = event.currentTarget.duration;
                        if (Number.isFinite(duration) && duration > 0) {
                          setPlayheadSecondsFromMedia(duration);
                        }
                      }}
                      onLoadedMetadata={(event) => {
                        const duration = event.currentTarget.duration;
                        if (Number.isFinite(duration) && duration > 0) {
                          setPlayheadSecondsFromMedia(Math.min(playheadSeconds, duration));
                        }
                      }}
                    />
                  ) : captureStatusQuery.data?.isRunning ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">{ui.helper.activePreviewTitle}</p>
                      <p className="text-xs text-muted-foreground">{ui.helper.activePreviewBody}</p>
                    </div>
                  ) : (
                    <Empty className="max-w-md border-border/70 bg-background/70 p-6">
                      <EmptyHeader>
                        <EmptyTitle className="text-sm">{ui.helper.emptyPreviewTitle}</EmptyTitle>
                        <EmptyDescription>{ui.helper.emptyPreviewBody}</EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  )}
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
