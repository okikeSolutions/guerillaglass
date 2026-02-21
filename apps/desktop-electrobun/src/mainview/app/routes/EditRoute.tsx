import { useRef } from "react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { useStudio } from "../studio/context";
import { EditorWorkspace } from "./EditorWorkspace";
import { InspectorPanel } from "./InspectorPanel";
import { TimelineDock } from "./TimelineDock";
import { ProjectUtilityPanel } from "./ProjectUtilityPanel";
import { captureTargetLabelFromMetadata } from "./captureTargetLabel";
import { useRecordingMediaSource } from "./useRecordingMediaSource";
import { useVideoPlaybackSync } from "./useVideoPlaybackSync";
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
    setDisplayPlayheadSecondsFromMedia,
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

  useVideoPlaybackSync({
    mediaRef,
    recordingMediaSource,
    isTimelinePlaying,
    playbackRate,
    playheadSeconds,
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
                      onPlay={() => {
                        setTimelinePlaybackActive(true);
                      }}
                      onPause={() => {
                        setTimelinePlaybackActive(false);
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
