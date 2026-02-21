import { useRef } from "react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { useStudio } from "../state/StudioProvider";
import { EditorWorkspace } from "../layout/EditorWorkspace";
import { InspectorPanel } from "../panels/InspectorPanel";
import { TimelineDock } from "../panels/TimelineDock";
import { ProjectUtilityPanel } from "../panels/ProjectUtilityPanel";
import { formatCaptureTargetLabelFromMetadata } from "../model/captureTargetLabelFormatter";
import { useRecordingMediaSource } from "../hooks/useRecordingMediaSource";
import { useVideoPlaybackSync } from "../hooks/useVideoPlaybackSync";
import {
  StudioPane,
  StudioPaneBody,
  StudioPaneHeader,
  StudioPaneSubtitle,
  StudioPaneTitle,
} from "../layout/StudioPanePrimitives";

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
  const activeCaptureTarget = formatCaptureTargetLabelFromMetadata({
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
