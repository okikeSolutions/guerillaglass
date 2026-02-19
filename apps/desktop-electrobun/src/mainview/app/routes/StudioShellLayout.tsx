import {
  AlertTriangle,
  Clock3,
  CircleDot,
  FolderOpen,
  HardDriveDownload,
  Pause,
  Play,
  RefreshCcw,
  Save,
  Scissors,
  ShieldAlert,
  ShieldCheck,
  Video,
} from "lucide-react";
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useCallback, type MouseEvent } from "react";
import type { CaptureHealthReason } from "@guerillaglass/engine-protocol";
import { normalizeStudioLocale } from "@/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useStudio } from "../studio/context";
import {
  localizedRouteTargetFor,
  resolveStudioLocation,
  type StudioLayoutRoute,
} from "../studio/studioLayoutState";
import { TimelineSurface } from "./TimelineSurface";

function modeTabClass(isActive: boolean): string {
  return isActive
    ? "rounded bg-background px-2 py-1 text-[0.7rem] font-medium text-foreground"
    : "rounded px-2 py-1 text-[0.7rem] font-medium text-muted-foreground hover:text-foreground";
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

  const startTimelineResize = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return;
      }

      event.preventDefault();
      const startY = event.clientY;
      const initialHeight = studio.layout.timelineHeightPx;

      const onMouseMove = (moveEvent: globalThis.MouseEvent) => {
        const delta = startY - moveEvent.clientY;
        studio.setTimelineHeight(initialHeight + delta);
      };

      const onMouseUp = () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [studio],
  );

  return (
    <div className="h-full overflow-hidden bg-background">
      <div className="mx-auto flex h-full max-w-[1780px] flex-col overflow-hidden border border-border/80 bg-card shadow-[0_20px_50px_rgba(8,15,35,0.14)]">
        <header className="border-b border-border/80 bg-background/80 px-4 py-2 backdrop-blur-sm">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="mr-2 text-sm font-semibold tracking-tight">{studio.ui.app.title}</h1>
            <div className="flex items-center gap-1 rounded bg-secondary/50 p-1">
              <Link
                to="/$locale/capture"
                params={{ locale: activeLocale }}
                className={modeTabClass(captureActive)}
                onClick={() => setLastRoute("/capture")}
              >
                {studio.ui.modes.capture}
              </Link>
              <Link
                to="/$locale/edit"
                params={{ locale: activeLocale }}
                className={modeTabClass(editActive)}
                onClick={() => setLastRoute("/edit")}
              >
                {studio.ui.modes.edit}
              </Link>
              <Link
                to="/$locale/deliver"
                params={{ locale: activeLocale }}
                className={modeTabClass(deliverActive)}
                onClick={() => setLastRoute("/deliver")}
              >
                {studio.ui.modes.deliver}
              </Link>
            </div>

            <span className="hidden h-5 w-px bg-border/80 lg:block" aria-hidden />

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                {studio.ui.labels.language}
                <select
                  className="gg-input h-7 w-[7.75rem] py-0 text-xs"
                  value={activeLocale}
                  onChange={(event) => {
                    void setLocaleAndNavigate(event.target.value, activeRoute);
                  }}
                >
                  <option value="en-US">{studio.ui.labels.localeEnglish}</option>
                  <option value="de-DE">{studio.ui.labels.localeGerman}</option>
                </select>
              </label>
              <Badge
                className="h-6 px-1.5"
                variant={studio.permissionBadgeVariant(studio.permissionsQuery.data)}
                title={
                  studio.permissionsQuery.data?.screenRecordingGranted
                    ? studio.ui.labels.permissionReady
                    : studio.ui.labels.permissionRequired
                }
              >
                {studio.permissionsQuery.data?.screenRecordingGranted ? (
                  <ShieldCheck className="h-3.5 w-3.5" />
                ) : (
                  <ShieldAlert className="h-3.5 w-3.5" />
                )}
                <span className="sr-only">
                  {studio.permissionsQuery.data?.screenRecordingGranted
                    ? studio.ui.labels.permissionReady
                    : studio.ui.labels.permissionRequired}
                </span>
              </Badge>
              {studio.inputMonitoringDenied && studio.settingsForm.state.values.trackInputEvents ? (
                <Badge
                  className="h-6 px-1.5"
                  variant="destructive"
                  title={studio.ui.helper.degradedModeTitle}
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span className="sr-only">{studio.ui.helper.degradedModeTitle}</span>
                </Badge>
              ) : null}
              <Button size="sm" variant="outline" onClick={studio.toggleLeftPaneCollapsed}>
                {studio.ui.actions.toggleLeftPane}
              </Button>
              <Button size="sm" variant="outline" onClick={studio.toggleRightPaneCollapsed}>
                {studio.ui.actions.toggleRightPane}
              </Button>
              <Button size="sm" variant="outline" onClick={studio.resetLayout}>
                {studio.ui.actions.resetLayout}
              </Button>
              <Button
                size="sm"
                onClick={() => void studio.refreshAll()}
                disabled={studio.isRunningAction || studio.isRefreshing}
              >
                <RefreshCcw className="mr-2 h-4 w-4" /> {studio.ui.actions.refresh}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={studio.toggleTimelinePlayback}
                disabled={studio.timelineDuration <= 0}
              >
                {studio.isTimelinePlaying ? (
                  <Pause className="mr-2 h-4 w-4" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                {studio.ui.actions.playPause}
              </Button>
              <Button
                size="sm"
                onClick={() => void studio.toggleRecordingMutation.mutateAsync()}
                disabled={studio.isRunningAction}
              >
                <Video className="mr-2 h-4 w-4" />
                {studio.captureStatusQuery.data?.isRecording
                  ? studio.ui.actions.stopRecording
                  : studio.ui.actions.startRecording}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void studio.saveProjectMutation.mutateAsync(false)}
                disabled={studio.isRunningAction || !studio.recordingURL}
              >
                <Save className="mr-2 h-4 w-4" /> {studio.ui.actions.saveProject}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void studio.exportMutation.mutateAsync()}
                disabled={studio.isRunningAction || !studio.recordingURL}
              >
                <HardDriveDownload className="mr-2 h-4 w-4" /> {studio.ui.actions.exportNow}
              </Button>
            </div>
          </div>

          <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded border border-border/70 bg-background/70 px-2 py-1.5">
              <div className="text-[0.65rem] tracking-[0.08em] uppercase text-muted-foreground">
                {studio.ui.labels.status}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 font-medium">
                <CircleDot className="h-3.5 w-3.5" />
                {studio.captureStatusLabel}
              </div>
            </div>
            <div className="rounded border border-border/70 bg-background/70 px-2 py-1.5">
              <div className="text-[0.65rem] tracking-[0.08em] uppercase text-muted-foreground">
                {studio.ui.labels.duration}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 font-medium">
                <Clock3 className="h-3.5 w-3.5" />
                {studio.formatDuration(
                  studio.captureStatusQuery.data?.recordingDurationSeconds ?? 0,
                )}
              </div>
            </div>
            <div className="rounded border border-border/70 bg-background/70 px-2 py-1.5">
              <div className="text-[0.65rem] tracking-[0.08em] uppercase text-muted-foreground">
                {studio.ui.labels.droppedFrames}
              </div>
              <div className="mt-0.5 font-medium">{telemetryDroppedFrames}</div>
            </div>
            <div className="rounded border border-border/70 bg-background/70 px-2 py-1.5">
              <div className="text-[0.65rem] tracking-[0.08em] uppercase text-muted-foreground">
                {studio.ui.labels.audioLevel}
              </div>
              <div className="mt-0.5 font-medium">{telemetryAudioLevel}</div>
            </div>
            <div className="rounded border border-border/70 bg-background/70 px-2 py-1.5">
              <div className="text-[0.65rem] tracking-[0.08em] uppercase text-muted-foreground">
                {studio.ui.labels.health}
              </div>
              <div className="mt-0.5 flex items-center gap-2" aria-live="polite">
                <Badge
                  variant={telemetryHealthBadgeVariant(telemetryHealth)}
                  title={telemetryHealthReason ?? telemetryHealthLabel}
                >
                  {telemetryHealthLabel}
                </Badge>
                {telemetryHealthReason ? (
                  <span className="truncate text-muted-foreground">{telemetryHealthReason}</span>
                ) : null}
              </div>
            </div>
          </div>
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

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 min-h-0 overflow-auto">
            <Outlet />
          </div>
          <div
            className="gg-timeline-resize-handle"
            onMouseDown={startTimelineResize}
            role="separator"
            aria-label={studio.ui.labels.resizeTimeline}
            aria-orientation="horizontal"
          />
          <footer
            className="shrink-0 overflow-hidden border-t border-border/80 bg-background/75 backdrop-blur-sm"
            style={{ height: `${studio.layout.timelineHeightPx}px` }}
          >
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
                  >
                    <Save className="mr-2 h-4 w-4" /> {studio.ui.actions.saveProjectAs}
                  </Button>
                  <label className="inline-flex items-center gap-2 text-sm">
                    {studio.ui.labels.playbackRate}
                    <select
                      className="gg-input w-28"
                      value={studio.playbackRate}
                      onChange={(event) =>
                        studio.setPlaybackRate(
                          Number(event.target.value) as (typeof studio.playbackRates)[number],
                        )
                      }
                    >
                      {studio.playbackRates.map((rate) => (
                        <option key={rate} value={rate}>{`${rate.toFixed(1)}x`}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <TimelineSurface
                  durationSeconds={studio.timelineDuration}
                  playheadSeconds={studio.playheadSeconds}
                  trimStartSeconds={studio.exportForm.state.values.trimStartSeconds}
                  trimEndSeconds={studio.exportForm.state.values.trimEndSeconds}
                  lanes={studio.timelineLanes}
                  labels={studio.ui.labels}
                  onSetPlayheadSeconds={studio.setPlayheadSeconds}
                  onSetTrimStartSeconds={studio.setTrimStartSeconds}
                  onSetTrimEndSeconds={studio.setTrimEndSeconds}
                  onNudgePlayheadSeconds={studio.nudgePlayheadSeconds}
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
        </div>
      </div>
    </div>
  );
}
