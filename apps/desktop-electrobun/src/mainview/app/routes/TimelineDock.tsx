import {
  ArrowLeft,
  ArrowRight,
  FolderOpen,
  Gauge,
  Magnet,
  Minus,
  MousePointer,
  Plus,
  RotateCcw,
  Save,
  Scissors,
  SplitSquareVertical,
  Waves,
} from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useStudio } from "../studio/context";
import { TimelineSurface } from "./TimelineSurface";

function TimelineIconAction({
  label,
  children,
  ...buttonProps
}: {
  label: string;
  children: ReactNode;
} & ComponentProps<typeof Button>) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Button size="icon-sm" variant="outline" {...buttonProps} />}>
        {children}
        <span className="sr-only">{label}</span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function TimelineDock() {
  const studio = useStudio();
  const recordingActionDisabledReason = studio.recordingURL
    ? undefined
    : studio.recordingRequiredNotice;

  return (
    <footer className="h-full overflow-hidden bg-background/60">
      <div className="h-full overflow-auto px-4 py-3">
        <div className="gg-pane-title mb-2 flex items-center gap-2">
          <Scissors className="h-4 w-4" /> {studio.ui.sections.timeline}
        </div>

        <TooltipProvider delay={120}>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <ButtonGroup className="gap-1">
                <TimelineIconAction
                  label={studio.ui.actions.setTrimIn}
                  onClick={studio.setTrimInFromPlayhead}
                >
                  <ArrowLeft className="h-4 w-4" />
                </TimelineIconAction>
                <TimelineIconAction
                  label={studio.ui.actions.setTrimOut}
                  onClick={studio.setTrimOutFromPlayhead}
                >
                  <ArrowRight className="h-4 w-4" />
                </TimelineIconAction>
                <TimelineIconAction
                  label={studio.ui.actions.openProject}
                  onClick={() => void studio.openProjectMutation.mutateAsync()}
                  disabled={studio.isRunningAction}
                >
                  <FolderOpen className="h-4 w-4" />
                </TimelineIconAction>
              </ButtonGroup>
              <div className="ml-auto inline-flex items-center gap-2">
                <TimelineIconAction
                  label={studio.ui.actions.saveProjectAs}
                  onClick={() => void studio.saveProjectMutation.mutateAsync(true)}
                  disabled={studio.isRunningAction || !studio.recordingURL}
                  title={recordingActionDisabledReason}
                >
                  <Save className="h-4 w-4" />
                </TimelineIconAction>
                <Tooltip>
                  <TooltipTrigger
                    render={<Badge className="h-7 w-7 justify-center p-0" variant="outline" />}
                  >
                    <Gauge className="h-4 w-4" />
                    <span className="sr-only">{studio.ui.labels.playbackRate}</span>
                  </TooltipTrigger>
                  <TooltipContent>{studio.ui.labels.playbackRate}</TooltipContent>
                </Tooltip>
                <Label className="sr-only" htmlFor="timeline-playback-rate-select">
                  {studio.ui.labels.playbackRate}
                </Label>
                <NativeSelect
                  id="timeline-playback-rate-select"
                  size="sm"
                  className="w-24"
                  value={String(studio.playbackRate)}
                  onChange={(event) =>
                    studio.setPlaybackRate(
                      Number(event.target.value) as (typeof studio.playbackRates)[number],
                    )
                  }
                >
                  {studio.playbackRates.map((rate) => (
                    <NativeSelectOption key={rate} value={String(rate)}>
                      {`${rate.toFixed(1)}x`}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
            </div>

            <div className="gg-toolbar-group flex flex-wrap items-center gap-2 rounded-md border px-2 py-1.5">
              <span className="gg-utility-label">{studio.ui.labels.timelineTools}</span>
              <ButtonGroup className="flex-wrap gap-1">
                <TimelineIconAction
                  label={studio.ui.actions.timelineToolSelect}
                  variant={studio.timelineTool === "select" ? "secondary" : "outline"}
                  onClick={() => studio.setTimelineTool("select")}
                >
                  <MousePointer className="h-4 w-4" />
                </TimelineIconAction>
                <TimelineIconAction
                  label={studio.ui.actions.timelineToolTrim}
                  variant={studio.timelineTool === "trim" ? "secondary" : "outline"}
                  onClick={() => studio.setTimelineTool("trim")}
                >
                  <Scissors className="h-4 w-4" />
                </TimelineIconAction>
                <TimelineIconAction
                  label={studio.ui.actions.timelineToolBlade}
                  variant={studio.timelineTool === "blade" ? "secondary" : "outline"}
                  onClick={() => studio.setTimelineTool("blade")}
                >
                  <SplitSquareVertical className="h-4 w-4" />
                </TimelineIconAction>
                <TimelineIconAction
                  label={studio.ui.labels.timelineSnap}
                  variant={studio.timelineSnapEnabled ? "secondary" : "outline"}
                  onClick={studio.toggleTimelineSnap}
                >
                  <Magnet className="h-4 w-4" />
                </TimelineIconAction>
                <TimelineIconAction
                  label={studio.ui.labels.timelineRipple}
                  variant={studio.timelineRippleEnabled ? "secondary" : "outline"}
                  onClick={studio.toggleTimelineRipple}
                >
                  <Waves className="h-4 w-4" />
                </TimelineIconAction>
              </ButtonGroup>
              <span className="gg-copy-meta ml-auto">{`${studio.ui.labels.timelineZoom}: ${studio.timelineZoomPercent}%`}</span>
              <ButtonGroup className="gap-1">
                <TimelineIconAction
                  label={studio.ui.actions.timelineZoomOut}
                  onClick={studio.zoomTimelineOut}
                >
                  <Minus className="h-4 w-4" />
                </TimelineIconAction>
                <TimelineIconAction
                  label={studio.ui.actions.timelineZoomReset}
                  onClick={studio.resetTimelineZoom}
                >
                  <RotateCcw className="h-4 w-4" />
                </TimelineIconAction>
                <TimelineIconAction
                  label={studio.ui.actions.timelineZoomIn}
                  onClick={studio.zoomTimelineIn}
                >
                  <Plus className="h-4 w-4" />
                </TimelineIconAction>
              </ButtonGroup>
            </div>

            <TimelineSurface
              durationSeconds={studio.timelineDuration}
              playheadSeconds={studio.playheadSeconds}
              trimStartSeconds={studio.exportForm.state.values.trimStartSeconds}
              trimEndSeconds={studio.exportForm.state.values.trimEndSeconds}
              lanes={studio.timelineLanes}
              laneControls={studio.timelineLaneControlState}
              labels={studio.ui.labels}
              timelineTool={studio.timelineTool}
              timelineSnapEnabled={studio.timelineSnapEnabled}
              zoomPercent={studio.timelineZoomPercent}
              onSetPlayheadSeconds={studio.setPlayheadSeconds}
              onSetTrimStartSeconds={studio.setTrimStartSeconds}
              onSetTrimEndSeconds={studio.setTrimEndSeconds}
              onNudgePlayheadSeconds={studio.nudgePlayheadSeconds}
              onToggleLaneLocked={(laneId) => studio.toggleLaneControl(laneId, "locked")}
              onToggleLaneMuted={(laneId) => studio.toggleLaneControl(laneId, "muted")}
              onToggleLaneSolo={(laneId) => studio.toggleLaneControl(laneId, "solo")}
              selectedClip={
                studio.inspectorSelection.kind === "timelineClip"
                  ? {
                      laneId: studio.inspectorSelection.laneId,
                      clipId: studio.inspectorSelection.clipId,
                    }
                  : null
              }
              selectedMarkerId={
                studio.inspectorSelection.kind === "timelineMarker"
                  ? studio.inspectorSelection.markerId
                  : null
              }
              onSelectClip={studio.selectTimelineClip}
              onSelectMarker={studio.selectTimelineMarker}
            />

            <div className="gg-copy-meta grid grid-cols-3">
              <span>{`${studio.ui.labels.trimInSeconds}: ${studio.exportForm.state.values.trimStartSeconds.toFixed(2)}`}</span>
              <span className="text-center">{`${studio.ui.labels.playhead}: ${studio.playheadSeconds.toFixed(2)}`}</span>
              <span className="text-right">{`${studio.ui.labels.trimOutSeconds}: ${studio.exportForm.state.values.trimEndSeconds.toFixed(2)}`}</span>
            </div>
          </div>
        </TooltipProvider>
      </div>
    </footer>
  );
}
