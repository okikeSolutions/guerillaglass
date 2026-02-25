import {
  ArrowLeft,
  ArrowRight,
  FolderOpen,
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
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ShortcutHint } from "@/components/ui/shortcut-hint";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  normalizeShortcutDisplayPlatform,
  studioShortcutDisplayTokens,
} from "../../../../shared/shortcuts";
import { useStudio } from "../state/StudioProvider";
import { studioToneClass, type StudioSemanticState } from "../model/studioSemanticTone";
import { TimelineSurface } from "./TimelineSurface";

function TimelineIconAction({
  label,
  tone = "neutral",
  shortcutKeys,
  children,
  className,
  ...buttonProps
}: {
  label: string;
  tone?: StudioSemanticState;
  shortcutKeys?: readonly string[];
  children: ReactNode;
} & ComponentProps<typeof Button>) {
  const isActiveTone = tone !== "neutral";

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            size="icon-sm"
            variant="ghost"
            className={cn(
              "gg-timeline-icon-action",
              studioToneClass(tone),
              isActiveTone && "gg-timeline-icon-action-active",
              className,
            )}
            {...buttonProps}
          />
        }
      >
        {children}
        <span className="sr-only">{label}</span>
      </TooltipTrigger>
      <TooltipContent>
        <ShortcutHint label={label} keys={shortcutKeys} />
      </TooltipContent>
    </Tooltip>
  );
}

function TimelineToolbarDivider() {
  return <span aria-hidden className="gg-timeline-toolbar-divider" />;
}

export function TimelineDock() {
  const studio = useStudio();
  const recordingActionDisabledReason = studio.recordingURL
    ? undefined
    : studio.recordingRequiredNotice;
  const shortcutPlatform = normalizeShortcutDisplayPlatform(
    typeof navigator === "undefined"
      ? undefined
      : ((navigator as { userAgentData?: { platform?: string } }).userAgentData?.platform ??
          navigator.platform ??
          navigator.userAgent),
  );

  return (
    <footer className="h-full overflow-hidden bg-background/45">
      <TooltipProvider delay={120}>
        <div className="flex h-full min-h-0 flex-col px-4 py-3">
          <div className="gg-toolbar-group mb-2 flex h-10 min-w-0 items-center gap-1 overflow-x-auto whitespace-nowrap rounded-md border px-2 py-1">
            <span className="gg-utility-label shrink-0">{studio.ui.sections.timeline}</span>
            <ButtonGroup className="shrink-0 gap-1">
              <TimelineIconAction
                label={studio.ui.actions.setTrimIn}
                shortcutKeys={studioShortcutDisplayTokens("trimIn", {
                  platform: shortcutPlatform,
                })}
                onClick={studio.setTrimInFromPlayhead}
              >
                <ArrowLeft className="h-4 w-4" />
              </TimelineIconAction>
              <TimelineIconAction
                label={studio.ui.actions.setTrimOut}
                shortcutKeys={studioShortcutDisplayTokens("trimOut", {
                  platform: shortcutPlatform,
                })}
                onClick={studio.setTrimOutFromPlayhead}
              >
                <ArrowRight className="h-4 w-4" />
              </TimelineIconAction>
            </ButtonGroup>
            <TimelineToolbarDivider />
            <ButtonGroup className="shrink-0 gap-1">
              <TimelineIconAction
                label={studio.ui.actions.timelineToolSelect}
                tone={studio.timelineTool === "select" ? "selected" : "neutral"}
                onClick={() => studio.setTimelineTool("select")}
              >
                <MousePointer className="h-4 w-4" />
              </TimelineIconAction>
              <TimelineIconAction
                label={studio.ui.actions.timelineToolTrim}
                tone={studio.timelineTool === "trim" ? "selected" : "neutral"}
                onClick={() => studio.setTimelineTool("trim")}
              >
                <Scissors className="h-4 w-4" />
              </TimelineIconAction>
              <TimelineIconAction
                label={studio.ui.actions.timelineToolBlade}
                shortcutKeys={studioShortcutDisplayTokens("timelineBlade", {
                  platform: shortcutPlatform,
                })}
                tone={studio.timelineTool === "blade" ? "selected" : "neutral"}
                onClick={() => studio.setTimelineTool("blade")}
              >
                <SplitSquareVertical className="h-4 w-4" />
              </TimelineIconAction>
            </ButtonGroup>
            <TimelineToolbarDivider />
            <ButtonGroup className="shrink-0 gap-1">
              <TimelineIconAction
                label={studio.ui.labels.timelineSnap}
                tone={studio.timelineSnapEnabled ? "selectedAlt" : "neutral"}
                onClick={studio.toggleTimelineSnap}
              >
                <Magnet className="h-4 w-4" />
              </TimelineIconAction>
              <TimelineIconAction
                label={studio.ui.labels.timelineRipple}
                tone={studio.timelineRippleEnabled ? "selectedAlt" : "neutral"}
                onClick={studio.toggleTimelineRipple}
              >
                <Waves className="h-4 w-4" />
              </TimelineIconAction>
            </ButtonGroup>
            <TimelineToolbarDivider />
            <ButtonGroup className="shrink-0 gap-1">
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
            <TimelineToolbarDivider />
            <span className="gg-copy-meta gg-numeric ml-auto shrink-0">{`${studio.ui.labels.timelineZoom}: ${studio.timelineZoomPercent}%`}</span>
            <TimelineIconAction
              label={studio.ui.actions.openProject}
              onClick={() => void studio.openProjectMutation.mutateAsync()}
              disabled={studio.isRunningAction}
              className="shrink-0"
            >
              <FolderOpen className="h-4 w-4" />
            </TimelineIconAction>
            <TimelineIconAction
              label={studio.ui.actions.saveProjectAs}
              shortcutKeys={studioShortcutDisplayTokens("saveAs", {
                platform: shortcutPlatform,
              })}
              onClick={() => void studio.saveProjectMutation.mutateAsync(true)}
              disabled={studio.isRunningAction || !studio.recordingURL}
              title={recordingActionDisabledReason}
              className="shrink-0"
            >
              <Save className="h-4 w-4" />
            </TimelineIconAction>
            <Label className="sr-only" htmlFor="timeline-playback-rate-select">
              {studio.ui.labels.playbackRate}
            </Label>
            <NativeSelect
              id="timeline-playback-rate-select"
              size="sm"
              className="h-8 w-20 shrink-0"
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
          <div className="min-h-0 flex-1 overflow-auto">
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
              onClearSelection={studio.clearInspectorSelection}
              selectedClip={
                studio.inspectorSelection.kind === "timelineClip" ? studio.inspectorSelection : null
              }
              selectedMarkerId={
                studio.inspectorSelection.kind === "timelineMarker"
                  ? studio.inspectorSelection.markerId
                  : null
              }
              onSelectClip={studio.selectTimelineClip}
              onSelectMarker={studio.selectTimelineMarker}
            />
          </div>
          <div className="gg-copy-meta gg-numeric mt-2 grid shrink-0 grid-cols-3">
            <span>{`${studio.ui.labels.trimInSeconds}: ${studio.exportForm.state.values.trimStartSeconds.toFixed(2)}`}</span>
            <span className="text-center">{`${studio.ui.labels.playhead}: ${studio.playheadSeconds.toFixed(2)}`}</span>
            <span className="text-right">{`${studio.ui.labels.trimOutSeconds}: ${studio.exportForm.state.values.trimEndSeconds.toFixed(2)}`}</span>
          </div>
        </div>
      </TooltipProvider>
    </footer>
  );
}
