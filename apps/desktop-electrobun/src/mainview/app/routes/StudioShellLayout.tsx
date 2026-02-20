import {
  Activity,
  AlertTriangle,
  AudioLines,
  Clock3,
  CircleDot,
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
  SplitSquareVertical,
  Video,
} from "lucide-react";
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useCallback } from "react";
import type { CaptureHealthReason } from "@guerillaglass/engine-protocol";
import { normalizeStudioLocale } from "@guerillaglass/localization";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useStudio } from "../studio/context";
import {
  localizedRouteTargetFor,
  resolveStudioLocation,
  type StudioLayoutRoute,
} from "../studio/studioLayoutState";

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

  return (
    <div className="h-full overflow-hidden bg-background">
      <div className="gg-shell-frame mx-auto flex h-full max-w-[1780px] flex-col overflow-hidden border">
        <header className="gg-shell-header border-b px-4 py-2">
          <TooltipProvider delay={120}>
            <div className="flex flex-col gap-2 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-center">
              <div className="flex flex-wrap items-center gap-1.5 lg:justify-self-start">
                <h1 className="mr-2 text-sm font-semibold tracking-tight">{studio.ui.app.title}</h1>
                <ButtonGroup className="gg-toolbar-group gap-1 rounded-lg border p-1">
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
                </ButtonGroup>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 lg:justify-self-center">
                <ButtonGroup className="gg-toolbar-group gap-1 rounded-lg border p-1">
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
                </ButtonGroup>

                <div className="gg-toolbar-group flex items-center gap-1 rounded-lg border p-1">
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
                  <Label className="sr-only" htmlFor="studio-locale-select">
                    {studio.ui.labels.language}
                  </Label>
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
                      <Button
                        size="icon-sm"
                        variant="outline"
                        onClick={studio.toggleTimelineCollapsed}
                      />
                    }
                  >
                    <SplitSquareVertical className="h-4 w-4" />
                    <span className="sr-only">{studio.ui.actions.toggleTimeline}</span>
                  </TooltipTrigger>
                  <TooltipContent>{studio.ui.actions.toggleTimeline}</TooltipContent>
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
          <Alert
            variant={studio.notice.kind === "error" ? "destructive" : "default"}
            className="rounded-none border-x-0 border-t-0 border-b px-4 py-3 text-sm"
          >
            <AlertDescription>{studio.notice.message}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex-1 min-h-0 overflow-hidden">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
