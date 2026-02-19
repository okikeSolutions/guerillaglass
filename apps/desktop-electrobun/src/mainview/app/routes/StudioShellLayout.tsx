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
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useStudio } from "../studio/context";
import { TimelineSurface } from "./TimelineSurface";

function modeTabClass(isActive: boolean): string {
  return isActive
    ? "rounded bg-background px-2 py-1 text-[0.7rem] font-medium text-foreground"
    : "rounded px-2 py-1 text-[0.7rem] font-medium text-muted-foreground hover:text-foreground";
}

export function StudioShellLayout() {
  const studio = useStudio();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  const captureActive = pathname.startsWith("/capture");
  const editActive = pathname.startsWith("/edit");
  const deliverActive = pathname.startsWith("/deliver");

  return (
    <div className="h-full overflow-hidden bg-background">
      <div className="mx-auto flex h-full max-w-[1780px] flex-col overflow-hidden border border-border/80 bg-card shadow-[0_20px_50px_rgba(8,15,35,0.14)]">
        <header className="border-b border-border/80 bg-background/80 px-4 py-2 backdrop-blur-sm">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="mr-2 text-sm font-semibold tracking-tight">{studio.ui.app.title}</h1>
            <div className="flex items-center gap-1 rounded bg-secondary/50 p-1">
              <Link to="/capture" className={modeTabClass(captureActive)}>
                Capture
              </Link>
              <Link to="/edit" className={modeTabClass(editActive)}>
                Edit
              </Link>
              <Link to="/deliver" className={modeTabClass(deliverActive)}>
                Deliver
              </Link>
            </div>

            <span className="hidden h-5 w-px bg-border/80 lg:block" aria-hidden />

            <div className="ml-auto flex flex-wrap items-center gap-2">
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
              <Badge
                className="h-6 gap-1.5 px-2"
                variant="secondary"
                title={`${studio.ui.labels.status}: ${studio.captureStatusLabel}`}
              >
                <CircleDot className="h-3.5 w-3.5" />
                <span className="text-[0.65rem] tracking-[0.08em] uppercase">
                  {studio.captureStatusLabel}
                </span>
              </Badge>
              <Badge
                className="h-6 gap-1.5 px-2"
                variant="secondary"
                title={`${studio.ui.labels.duration}: ${studio.formatDuration(
                  studio.captureStatusQuery.data?.recordingDurationSeconds ?? 0,
                )}`}
              >
                <Clock3 className="h-3.5 w-3.5" />
                <span className="text-[0.65rem] tracking-[0.08em] uppercase">
                  {studio.formatDuration(
                    studio.captureStatusQuery.data?.recordingDurationSeconds ?? 0,
                  )}
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

        <div className="flex-1 min-h-0 overflow-auto">
          <Outlet />
        </div>

        <footer className="border-t border-border/80 bg-background/75 px-4 py-3 backdrop-blur-sm">
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
            />

            <div className="grid grid-cols-3 text-xs text-muted-foreground">
              <span>{`${studio.ui.labels.trimInSeconds}: ${studio.exportForm.state.values.trimStartSeconds.toFixed(2)}`}</span>
              <span className="text-center">{`${studio.ui.labels.playhead}: ${studio.playheadSeconds.toFixed(2)}`}</span>
              <span className="text-right">{`${studio.ui.labels.trimOutSeconds}: ${studio.exportForm.state.values.trimEndSeconds.toFixed(2)}`}</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
