import {
  Activity,
  AlertTriangle,
  AudioLines,
  Clock3,
  CircleDot,
  FolderOpen,
  HardDriveDownload,
  Languages,
  LayoutPanelTop,
  Pause,
  PanelLeftClose,
  PanelRightClose,
  Play,
  RefreshCcw,
  Save,
  Scissors,
  ShieldAlert,
  ShieldCheck,
  Video,
} from "lucide-react";
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useThrottler } from "@tanstack/react-pacer";
import { useCallback, useEffect, useRef } from "react";
import type { CaptureHealthReason } from "@guerillaglass/engine-protocol";
import { normalizeStudioLocale } from "@guerillaglass/localization";
import type { PanelImperativeHandle, PanelSize } from "react-resizable-panels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useStudio } from "../studio/context";
import {
  localizedRouteTargetFor,
  resolveStudioLocation,
  studioLayoutBounds,
  type StudioLayoutRoute,
} from "../studio/studioLayoutState";
import { TimelineSurface } from "./TimelineSurface";

function modeIconClass(isActive: boolean): string {
  return isActive
    ? "inline-flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/80"
    : "inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/80";
}

function telemetryHealthBadgeVariant(
  health: "good" | "warning" | "critical",
): "default" | "secondary" | "destructive" {
  switch (health) {
    case "critical":
      return "destructive";
    case "warning":
      return "secondary";
    case "good":
      return "default";
  }
}

function localizeTelemetryHealthReason(
  reason: CaptureHealthReason | null,
  studio: ReturnType<typeof useStudio>,
): string | null {
  if (reason == null) {
    return null;
  }
  switch (reason) {
    case "engine_error":
      return studio.ui.helper.healthReasonEngineError;
    case "high_dropped_frame_rate":
      return studio.ui.helper.healthReasonHighDroppedFrameRate;
    case "elevated_dropped_frame_rate":
      return studio.ui.helper.healthReasonElevatedDroppedFrameRate;
    case "low_microphone_level":
      return studio.ui.helper.healthReasonLowMicrophoneLevel;
  }
}

export function StudioShellLayout() {
  const studio = useStudio();
  const navigate = useNavigate();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  const location = resolveStudioLocation(pathname);
  const activeRoute = location.route;
  const activeLocale = location.locale;

  const captureActive = activeRoute === "/capture";
  const editActive = activeRoute === "/edit";
  const deliverActive = activeRoute === "/deliver";
  const setLastRoute = studio.setLastRoute;
  const setLocale = studio.setLocale;
  const telemetry = studio.captureStatusQuery.data?.telemetry;
  const telemetryHealth = telemetry?.health ?? "good";
  const telemetryHealthLabel =
    telemetryHealth === "critical"
      ? studio.ui.values.critical
      : telemetryHealth === "warning"
        ? studio.ui.values.warning
        : studio.ui.values.good;
  const telemetryAudioLevel =
    telemetry?.audioLevelDbfs == null
      ? "-"
      : `${studio.formatDecimal(telemetry.audioLevelDbfs)} dBFS`;
  const telemetryDroppedFrames = `${studio.formatInteger(
    telemetry?.droppedFrames ?? 0,
  )} (${studio.formatDecimal(telemetry?.droppedFramePercent ?? 0)}%)`;
  const telemetryHealthReason = localizeTelemetryHealthReason(
    telemetry?.healthReason ?? null,
    studio,
  );
  const recordingActionDisabledReason = studio.recordingURL
    ? undefined
    : studio.recordingRequiredNotice;
  const timelineResizeStepPx = 8;
  const timelineResizeStepPxLarge = 32;
  const timelineResizeThrottleMs = 16;
  const timelinePanelRef = useRef<PanelImperativeHandle | null>(null);
  const timelineResizeThrottler = useThrottler(
    (nextHeightPx: number) => {
      studio.setTimelineHeight(nextHeightPx);
    },
    {
      leading: true,
      trailing: true,
      wait: timelineResizeThrottleMs,
    },
    () => null,
  );

  const setLocaleAndNavigate = useCallback(
    async (nextLocaleRaw: string, route: StudioLayoutRoute) => {
      const nextLocale = normalizeStudioLocale(nextLocaleRaw);
      setLocale(nextLocale);
      setLastRoute(route);
      await navigate({
        to: localizedRouteTargetFor(route),
        params: { locale: nextLocale },
      });
    },
    [navigate, setLastRoute, setLocale],
  );

  useEffect(() => {
    const timelinePanel = timelinePanelRef.current;
    if (!timelinePanel) {
      return;
    }
    if (Math.abs(timelinePanel.getSize().inPixels - studio.layout.timelineHeightPx) > 1) {
      timelinePanel.resize(studio.layout.timelineHeightPx);
    }
  }, [studio.layout.timelineHeightPx]);

  useEffect(() => {
    return () => {
      timelineResizeThrottler.cancel();
    };
  }, [timelineResizeThrottler]);

  const syncTimelineHeight = useCallback(
    (panelSize: PanelSize) => {
      timelineResizeThrottler.maybeExecute(panelSize.inPixels);
    },
    [timelineResizeThrottler],
  );

  const resizeTimelineFromKeyboard = useCallback(
    (deltaPx: number) => {
      const timelinePanel = timelinePanelRef.current;
      if (!timelinePanel) {
        return;
      }
      const nextHeight = studio.layout.timelineHeightPx + deltaPx;
      timelinePanel.resize(nextHeight);
      studio.setTimelineHeight(nextHeight);
    },
    [studio],
  );

  return (
    <div className="h-full overflow-hidden bg-background">
      <div className="mx-auto flex h-full max-w-[1780px] flex-col overflow-hidden border border-border/80 bg-card shadow-[0_20px_50px_rgba(8,15,35,0.14)]">
        <header className="border-b border-border/80 bg-background/80 px-4 py-2 backdrop-blur-sm">
          <TooltipProvider delay={120}>
            <div className="flex flex-col gap-2 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-center">
              <div className="flex flex-wrap items-center gap-1.5 lg:justify-self-start">
                <h1 className="mr-2 text-sm font-semibold tracking-tight">{studio.ui.app.title}</h1>
                <div className="flex items-center gap-1 rounded-lg border border-border/70 bg-secondary/30 p-1">
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Link
                          to="/$locale/capture"
                          params={{ locale: activeLocale }}
                          className={modeIconClass(captureActive)}
                          aria-current={captureActive ? "page" : undefined}
                          onClick={() => setLastRoute("/capture")}
                        />
                      }
                    >
                      <Video className="h-3.5 w-3.5" />
                      <span className="sr-only">{studio.ui.modes.capture}</span>
                    </TooltipTrigger>
                    <TooltipContent>{studio.ui.modes.capture}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Link
                          to="/$locale/edit"
                          params={{ locale: activeLocale }}
                          className={modeIconClass(editActive)}
                          aria-current={editActive ? "page" : undefined}
                          onClick={() => setLastRoute("/edit")}
                        />
                      }
                    >
                      <Scissors className="h-3.5 w-3.5" />
                      <span className="sr-only">{studio.ui.modes.edit}</span>
                    </TooltipTrigger>
                    <TooltipContent>{studio.ui.modes.edit}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Link
                          to="/$locale/deliver"
                          params={{ locale: activeLocale }}
                          className={modeIconClass(deliverActive)}
                          aria-current={deliverActive ? "page" : undefined}
                          onClick={() => setLastRoute("/deliver")}
                        />
                      }
                    >
                      <HardDriveDownload className="h-3.5 w-3.5" />
                      <span className="sr-only">{studio.ui.modes.deliver}</span>
                    </TooltipTrigger>
                    <TooltipContent>{studio.ui.modes.deliver}</TooltipContent>
                  </Tooltip>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 lg:justify-self-center">
                <div className="flex items-center gap-1 rounded-lg border border-border/70 bg-muted/35 p-1">
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          size="icon-sm"
                          variant="secondary"
                          onClick={studio.toggleTimelinePlayback}
                          disabled={studio.timelineDuration <= 0}
                        />
                      }
                    >
                      {studio.isTimelinePlaying ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                      <span className="sr-only">{studio.ui.actions.playPause}</span>
                    </TooltipTrigger>
                    <TooltipContent>{studio.ui.actions.playPause}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          size="icon-sm"
                          onClick={() => void studio.toggleRecordingMutation.mutateAsync()}
                          disabled={studio.isRunningAction}
                        />
                      }
                    >
                      <Video className="h-4 w-4" />
                      <span className="sr-only">
                        {studio.captureStatusQuery.data?.isRecording
                          ? studio.ui.actions.stopRecording
                          : studio.ui.actions.startRecording}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {studio.captureStatusQuery.data?.isRecording
                        ? studio.ui.actions.stopRecording
                        : studio.ui.actions.startRecording}
                    </TooltipContent>
                  </Tooltip>
                </div>

                <div className="flex items-center gap-1 rounded-lg border border-border/70 bg-background/70 p-1">
                  <Tooltip>
                    <TooltipTrigger
                      render={<Badge className="h-7 w-7 justify-center p-0" variant="outline" />}
                    >
                      <CircleDot className="h-3.5 w-3.5" />
                      <span className="sr-only">{studio.ui.labels.status}</span>
                    </TooltipTrigger>
                    <TooltipContent>{`${studio.ui.labels.status}: ${studio.captureStatusLabel}`}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger
                      render={<Badge className="h-7 w-7 justify-center p-0" variant="outline" />}
                    >
                      <Clock3 className="h-3.5 w-3.5" />
                      <span className="sr-only">{studio.ui.labels.duration}</span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {`${studio.ui.labels.duration}: ${studio.formatDuration(
                        studio.captureStatusQuery.data?.recordingDurationSeconds ?? 0,
                      )}`}
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger
                      render={<Badge className="h-7 w-7 justify-center p-0" variant="outline" />}
                    >
                      <Activity className="h-3.5 w-3.5" />
                      <span className="sr-only">{studio.ui.labels.droppedFrames}</span>
                    </TooltipTrigger>
                    <TooltipContent>{`${studio.ui.labels.droppedFrames}: ${telemetryDroppedFrames}`}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger
                      render={<Badge className="h-7 w-7 justify-center p-0" variant="outline" />}
                    >
                      <AudioLines className="h-3.5 w-3.5" />
                      <span className="sr-only">{studio.ui.labels.audioLevel}</span>
                    </TooltipTrigger>
                    <TooltipContent>{`${studio.ui.labels.audioLevel}: ${telemetryAudioLevel}`}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Badge
                          className="h-7 w-7 justify-center p-0"
                          variant={telemetryHealthBadgeVariant(telemetryHealth)}
                        />
                      }
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span className="sr-only">{studio.ui.labels.health}</span>
                    </TooltipTrigger>
                    <TooltipContent>{`${studio.ui.labels.health}: ${telemetryHealthReason ?? telemetryHealthLabel}`}</TooltipContent>
                  </Tooltip>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 lg:justify-self-end">
                <div className="inline-flex items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger
                      render={<Badge className="h-7 w-7 justify-center p-0" variant="outline" />}
                    >
                      <Languages className="h-3.5 w-3.5" />
                      <span className="sr-only">{studio.ui.labels.language}</span>
                    </TooltipTrigger>
                    <TooltipContent>{studio.ui.labels.language}</TooltipContent>
                  </Tooltip>
                  <label className="sr-only" htmlFor="studio-locale-select">
                    {studio.ui.labels.language}
                  </label>
                  <NativeSelect
                    id="studio-locale-select"
                    size="sm"
                    className="w-[8rem]"
                    value={activeLocale}
                    onChange={(event) => {
                      void setLocaleAndNavigate(event.target.value, activeRoute);
                    }}
                  >
                    <NativeSelectOption value="en-US">
                      {studio.ui.labels.localeEnglish}
                    </NativeSelectOption>
                    <NativeSelectOption value="de-DE">
                      {studio.ui.labels.localeGerman}
                    </NativeSelectOption>
                  </NativeSelect>
                </div>

                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Badge
                        className="h-7 w-7 justify-center p-0"
                        variant={studio.permissionBadgeVariant(studio.permissionsQuery.data)}
                      />
                    }
                  >
                    {studio.permissionsQuery.data?.screenRecordingGranted ? (
                      <ShieldCheck className="h-3.5 w-3.5" />
                    ) : (
                      <ShieldAlert className="h-3.5 w-3.5" />
                    )}
                    <span className="sr-only">{studio.ui.labels.permissionReady}</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {studio.permissionsQuery.data?.screenRecordingGranted
                      ? studio.ui.labels.permissionReady
                      : studio.ui.labels.permissionRequired}
                  </TooltipContent>
                </Tooltip>

                {studio.inputMonitoringDenied &&
                studio.settingsForm.state.values.trackInputEvents ? (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Badge className="h-7 w-7 justify-center p-0" variant="destructive" />
                      }
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span className="sr-only">{studio.ui.helper.degradedModeTitle}</span>
                    </TooltipTrigger>
                    <TooltipContent>{studio.ui.helper.degradedModeTitle}</TooltipContent>
                  </Tooltip>
                ) : null}

                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        size="icon-sm"
                        variant="outline"
                        onClick={() => void studio.refreshAll()}
                        disabled={studio.isRunningAction || studio.isRefreshing}
                      />
                    }
                  >
                    <RefreshCcw className="h-4 w-4" />
                    <span className="sr-only">{studio.ui.actions.refresh}</span>
                  </TooltipTrigger>
                  <TooltipContent>{studio.ui.actions.refresh}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        size="icon-sm"
                        variant="outline"
                        onClick={() => void studio.saveProjectMutation.mutateAsync(false)}
                        disabled={studio.isRunningAction || !studio.recordingURL}
                        title={recordingActionDisabledReason}
                      />
                    }
                  >
                    <Save className="h-4 w-4" />
                    <span className="sr-only">{studio.ui.actions.saveProject}</span>
                  </TooltipTrigger>
                  <TooltipContent>{studio.ui.actions.saveProject}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        size="icon-sm"
                        variant="outline"
                        onClick={() => void studio.exportMutation.mutateAsync()}
                        disabled={studio.isRunningAction || !studio.recordingURL}
                        title={recordingActionDisabledReason}
                      />
                    }
                  >
                    <HardDriveDownload className="h-4 w-4" />
                    <span className="sr-only">{studio.ui.actions.exportNow}</span>
                  </TooltipTrigger>
                  <TooltipContent>{studio.ui.actions.exportNow}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        size="icon-sm"
                        variant="outline"
                        onClick={studio.toggleLeftPaneCollapsed}
                      />
                    }
                  >
                    <PanelLeftClose className="h-4 w-4" />
                    <span className="sr-only">{studio.ui.actions.toggleLeftPane}</span>
                  </TooltipTrigger>
                  <TooltipContent>{studio.ui.actions.toggleLeftPane}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        size="icon-sm"
                        variant="outline"
                        onClick={studio.toggleRightPaneCollapsed}
                      />
                    }
                  >
                    <PanelRightClose className="h-4 w-4" />
                    <span className="sr-only">{studio.ui.actions.toggleRightPane}</span>
                  </TooltipTrigger>
                  <TooltipContent>{studio.ui.actions.toggleRightPane}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button size="icon-sm" variant="outline" onClick={studio.resetLayout} />
                    }
                  >
                    <LayoutPanelTop className="h-4 w-4" />
                    <span className="sr-only">{studio.ui.actions.resetLayout}</span>
                  </TooltipTrigger>
                  <TooltipContent>{studio.ui.actions.resetLayout}</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </TooltipProvider>
        </header>

        {studio.notice ? (
          <div
            className={
              studio.notice.kind === "error"
                ? "border-b border-destructive/60 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                : "border-b border-border/70 bg-muted/50 px-4 py-3 text-sm"
            }
          >
            {studio.notice.message}
          </div>
        ) : null}

        <ResizablePanelGroup
          className="min-h-0 flex-1"
          orientation="vertical"
          onLayoutChanged={() => {
            timelineResizeThrottler.flush();
          }}
        >
          <ResizablePanel id="workspace-content-pane" minSize={320}>
            <div className="flex-1 min-h-0 overflow-auto">
              <Outlet />
            </div>
          </ResizablePanel>
          <ResizableHandle
            withHandle
            className="gg-timeline-resize-handle"
            aria-label={studio.ui.labels.resizeTimeline}
            aria-valuemin={studioLayoutBounds.timelineMinHeightPx}
            aria-valuemax={studioLayoutBounds.timelineMaxHeightPx}
            aria-valuenow={studio.layout.timelineHeightPx}
            onKeyDown={(event) => {
              const step = event.shiftKey ? timelineResizeStepPxLarge : timelineResizeStepPx;
              if (event.key === "ArrowDown") {
                event.preventDefault();
                resizeTimelineFromKeyboard(-step);
                return;
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                resizeTimelineFromKeyboard(step);
                return;
              }
              if (event.key === "Home") {
                event.preventDefault();
                resizeTimelineFromKeyboard(
                  studioLayoutBounds.timelineMinHeightPx - studio.layout.timelineHeightPx,
                );
                return;
              }
              if (event.key === "End") {
                event.preventDefault();
                resizeTimelineFromKeyboard(
                  studioLayoutBounds.timelineMaxHeightPx - studio.layout.timelineHeightPx,
                );
              }
            }}
          />
          <ResizablePanel
            id="workspace-timeline-pane"
            panelRef={timelinePanelRef}
            defaultSize={studio.layout.timelineHeightPx}
            minSize={studioLayoutBounds.timelineMinHeightPx}
            maxSize={studioLayoutBounds.timelineMaxHeightPx}
            onResize={syncTimelineHeight}
          >
            <footer className="h-full overflow-hidden border-t border-border/80 bg-background/75 backdrop-blur-sm">
              <div className="h-full overflow-auto px-4 py-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold tracking-wide uppercase">
                  <Scissors className="h-4 w-4" /> {studio.ui.sections.timeline}
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" onClick={studio.setTrimInFromPlayhead}>
                      {studio.ui.actions.setTrimIn}
                    </Button>
                    <Button size="sm" variant="outline" onClick={studio.setTrimOutFromPlayhead}>
                      {studio.ui.actions.setTrimOut}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void studio.openProjectMutation.mutateAsync()}
                      disabled={studio.isRunningAction}
                    >
                      <FolderOpen className="mr-2 h-4 w-4" /> {studio.ui.actions.openProject}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="ml-auto"
                      onClick={() => void studio.saveProjectMutation.mutateAsync(true)}
                      disabled={studio.isRunningAction || !studio.recordingURL}
                      title={recordingActionDisabledReason}
                    >
                      <Save className="mr-2 h-4 w-4" /> {studio.ui.actions.saveProjectAs}
                    </Button>
                    <label className="inline-flex items-center gap-2 text-sm">
                      {studio.ui.labels.playbackRate}
                      <NativeSelect
                        className="w-28"
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
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 rounded-md border border-border/70 bg-muted/25 px-2 py-1.5">
                    <span className="text-[0.68rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                      {studio.ui.labels.timelineTools}
                    </span>
                    <Button
                      size="sm"
                      variant={studio.timelineTool === "select" ? "secondary" : "outline"}
                      onClick={() => studio.setTimelineTool("select")}
                    >
                      {studio.ui.actions.timelineToolSelect}
                    </Button>
                    <Button
                      size="sm"
                      variant={studio.timelineTool === "trim" ? "secondary" : "outline"}
                      onClick={() => studio.setTimelineTool("trim")}
                    >
                      {studio.ui.actions.timelineToolTrim}
                    </Button>
                    <Button
                      size="sm"
                      variant={studio.timelineTool === "blade" ? "secondary" : "outline"}
                      onClick={() => studio.setTimelineTool("blade")}
                    >
                      {studio.ui.actions.timelineToolBlade}
                    </Button>
                    <Button
                      size="sm"
                      variant={studio.timelineSnapEnabled ? "secondary" : "outline"}
                      onClick={studio.toggleTimelineSnap}
                    >
                      {studio.ui.labels.timelineSnap}
                    </Button>
                    <Button
                      size="sm"
                      variant={studio.timelineRippleEnabled ? "secondary" : "outline"}
                      onClick={studio.toggleTimelineRipple}
                    >
                      {studio.ui.labels.timelineRipple}
                    </Button>
                    <span className="ml-auto text-xs text-muted-foreground">{`${studio.ui.labels.timelineZoom}: ${studio.timelineZoomPercent}%`}</span>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="outline" onClick={studio.zoomTimelineOut}>
                        {studio.ui.actions.timelineZoomOut}
                      </Button>
                      <Button size="sm" variant="outline" onClick={studio.resetTimelineZoom}>
                        {studio.ui.actions.timelineZoomReset}
                      </Button>
                      <Button size="sm" variant="outline" onClick={studio.zoomTimelineIn}>
                        {studio.ui.actions.timelineZoomIn}
                      </Button>
                    </div>
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

                  <div className="grid grid-cols-3 text-xs text-muted-foreground">
                    <span>{`${studio.ui.labels.trimInSeconds}: ${studio.exportForm.state.values.trimStartSeconds.toFixed(2)}`}</span>
                    <span className="text-center">{`${studio.ui.labels.playhead}: ${studio.playheadSeconds.toFixed(2)}`}</span>
                    <span className="text-right">{`${studio.ui.labels.trimOutSeconds}: ${studio.exportForm.state.values.trimEndSeconds.toFixed(2)}`}</span>
                  </div>
                </div>
              </div>
            </footer>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
