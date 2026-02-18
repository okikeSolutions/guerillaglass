import { FolderOpen, Keyboard, Pause, Play, RefreshCcw, Save, Scissors, Video } from "lucide-react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useStudio } from "../studio/context";

function modeTabClass(isActive: boolean): string {
  return isActive
    ? "rounded-md bg-background px-3 py-1.5 text-xs font-medium text-foreground"
    : "rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground";
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
    <div className="min-h-screen bg-background px-4 py-4 lg:px-6">
      <div className="mx-auto flex max-w-[1680px] flex-col gap-3">
        <header className="gg-panel border-border/80 p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-[0.68rem] tracking-[0.2em] text-muted-foreground uppercase">
                {studio.ui.app.shellState}
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">{studio.ui.app.title}</h1>
              <p className="text-sm text-muted-foreground">{studio.ui.app.subtitle}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={studio.permissionBadgeVariant(studio.permissionsQuery.data)}>
                {studio.permissionsQuery.data?.screenRecordingGranted
                  ? studio.ui.labels.permissionReady
                  : studio.ui.labels.permissionRequired}
              </Badge>
              <Badge variant="secondary">{`${studio.ui.labels.status}: ${studio.captureStatusLabel}`}</Badge>
              {studio.inputMonitoringDenied && studio.settingsForm.state.values.trackInputEvents ? (
                <Badge variant="destructive">{studio.ui.helper.degradedModeTitle}</Badge>
              ) : null}
              <Button
                onClick={() => void studio.refreshAll()}
                disabled={studio.isRunningAction || studio.isRefreshing}
              >
                <RefreshCcw className="mr-2 h-4 w-4" /> {studio.ui.actions.refresh}
              </Button>
              <Button
                onClick={() => void studio.toggleRecordingMutation.mutateAsync()}
                disabled={studio.isRunningAction}
              >
                <Video className="mr-2 h-4 w-4" />
                {studio.captureStatusQuery.data?.isRecording
                  ? studio.ui.actions.stopRecording
                  : studio.ui.actions.startRecording}
              </Button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-md bg-secondary/50 p-1">
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
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
              <Keyboard className="h-3.5 w-3.5" /> {studio.ui.shortcuts.title}
            </span>
            <span className="gg-keycap">{studio.ui.shortcuts.playPause}</span>
            <span className="gg-keycap">{studio.ui.shortcuts.record}</span>
            <span className="gg-keycap">{studio.ui.shortcuts.trimIn}</span>
            <span className="gg-keycap">{studio.ui.shortcuts.trimOut}</span>
            <span className="gg-keycap">{studio.ui.shortcuts.save}</span>
            <span className="gg-keycap">{studio.ui.shortcuts.saveAs}</span>
            <span className="gg-keycap">{studio.ui.shortcuts.export}</span>
          </div>
        </header>

        {studio.notice ? (
          <Card
            className={
              studio.notice.kind === "error" ? "border-destructive/60" : "border-border/70"
            }
          >
            <CardContent className="pt-5 text-sm">{studio.notice.message}</CardContent>
          </Card>
        ) : null}

        <Outlet />

        <Card className="gg-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Scissors className="h-4 w-4" /> {studio.ui.sections.timeline}
            </CardTitle>
            <CardDescription>{studio.ui.helper.activePreviewBody}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" onClick={studio.toggleTimelinePlayback}>
                {studio.isTimelinePlaying ? (
                  <Pause className="mr-2 h-4 w-4" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                {studio.ui.actions.playPause}
              </Button>
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
                onClick={() => void studio.saveProjectMutation.mutateAsync(false)}
                disabled={studio.isRunningAction || !studio.recordingURL}
              >
                <Save className="mr-2 h-4 w-4" /> {studio.ui.actions.saveProject}
              </Button>
              <label className="ml-auto inline-flex items-center gap-2 text-sm">
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

            <div className="space-y-2">
              <input
                type="range"
                min={0}
                max={studio.timelineDuration}
                step={0.01}
                value={studio.playheadSeconds}
                onChange={(event) => studio.setPlayheadSeconds(Number(event.target.value))}
                className="w-full"
                aria-label={studio.ui.labels.playhead}
              />

              <div className="grid grid-cols-3 text-xs text-muted-foreground">
                <span>{`${studio.ui.labels.trimInSeconds}: ${studio.exportForm.state.values.trimStartSeconds.toFixed(2)}`}</span>
                <span className="text-center">{`${studio.ui.labels.playhead}: ${studio.playheadSeconds.toFixed(2)}`}</span>
                <span className="text-right">{`${studio.ui.labels.trimOutSeconds}: ${studio.exportForm.state.values.trimEndSeconds.toFixed(2)}`}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
