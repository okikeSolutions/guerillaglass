import {
  Activity,
  AlertTriangle,
  AudioLines,
  Clock3,
  CircleDot,
  HardDriveDownload,
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
import { useEffect, type ReactNode } from "react";
import type { CaptureHealthReason } from "@guerillaglass/engine-protocol";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { ShortcutHint } from "@/components/ui/shortcut-hint";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  normalizeShortcutDisplayPlatform,
  studioShortcutDisplayTokens,
} from "../../../shared/shortcuts";
import {
  studioBadgeToneClass,
  studioButtonToneClass,
  studioHealthTone,
  studioIconToneClass,
} from "./studioSemanticTone";
import {
  buildCaptureTelemetryPresentation,
  buildDroppedFramesTooltip,
} from "../studio/captureTelemetryPresentation";
import { useStudio } from "../studio/context";
import { localizedRouteTargetFor, resolveStudioLocation } from "../studio/studioLayoutState";

function modeIconClass(isActive: boolean): string {
  return isActive
    ? "gg-button-tone gg-tone-selected inline-flex size-7 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-primary/80"
    : "gg-button-tone gg-tone-neutral inline-flex size-7 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-primary/80";
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

function HeaderIconBadge({
  tone,
  srLabel,
  tooltip,
  children,
}: {
  tone: Parameters<typeof studioBadgeToneClass>[0];
  srLabel: string;
  tooltip: string;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Badge
            className={`gg-header-icon-badge h-7 w-7 justify-center p-0 ${studioBadgeToneClass(tone)}`}
            variant="outline"
          />
        }
      >
        {children}
        <span className="sr-only">{srLabel}</span>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

function HeaderIconButton({
  onClick,
  disabled,
  title,
  srLabel,
  tooltip,
  icon,
}: {
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  srLabel: string;
  tooltip: ReactNode;
  icon: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            size="icon-sm"
            variant="outline"
            className={`gg-header-icon-button ${studioButtonToneClass("neutral")}`}
            onClick={onClick}
            disabled={disabled}
            title={title}
          />
        }
      >
        {icon}
        <span className="sr-only">{srLabel}</span>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
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
  const telemetryPresentation = buildCaptureTelemetryPresentation(telemetry, {
    formatInteger: studio.formatInteger,
    formatDecimal: studio.formatDecimal,
  });
  const telemetryHealthReason = localizeTelemetryHealthReason(
    telemetry?.healthReason ?? null,
    studio,
  );
  const telemetryHealthTone = studioHealthTone(telemetryHealth);
  const isRecording = Boolean(studio.captureStatusQuery.data?.isRecording);
  const permissionTone = studio.permissionsQuery.data?.screenRecordingGranted ? "live" : "error";
  const recordingActionDisabledReason = studio.recordingURL
    ? undefined
    : studio.recordingRequiredNotice;
  const modeItems = [
    {
      route: "/capture" as const,
      to: "/$locale/capture" as const,
      label: studio.ui.modes.capture,
      icon: Video,
      active: captureActive,
    },
    {
      route: "/edit" as const,
      to: "/$locale/edit" as const,
      label: studio.ui.modes.edit,
      icon: Scissors,
      active: editActive,
    },
    {
      route: "/deliver" as const,
      to: "/$locale/deliver" as const,
      label: studio.ui.modes.deliver,
      icon: HardDriveDownload,
      active: deliverActive,
    },
  ];
  const telemetryBadges = [
    {
      id: "status",
      tone: "neutral" as const,
      srLabel: studio.ui.labels.status,
      tooltip: `${studio.ui.labels.status}: ${studio.captureStatusLabel}`,
      icon: <CircleDot className={`h-3.5 w-3.5 ${studioIconToneClass("neutral")}`} />,
    },
    {
      id: "duration",
      tone: "neutral" as const,
      srLabel: studio.ui.labels.duration,
      tooltip: `${studio.ui.labels.duration}: ${studio.formatDuration(
        studio.captureStatusQuery.data?.recordingDurationSeconds ?? 0,
      )}`,
      icon: <Clock3 className={`h-3.5 w-3.5 ${studioIconToneClass("neutral")}`} />,
    },
    {
      id: "dropped-frames",
      tone: "neutral" as const,
      srLabel: studio.ui.labels.droppedFrames,
      tooltip: buildDroppedFramesTooltip(studio.ui.labels, telemetryPresentation),
      icon: <Activity className={`h-3.5 w-3.5 ${studioIconToneClass("neutral")}`} />,
    },
    {
      id: "audio-level",
      tone: "neutral" as const,
      srLabel: studio.ui.labels.audioLevel,
      tooltip: `${studio.ui.labels.audioLevel}: ${telemetryAudioLevel}`,
      icon: <AudioLines className={`h-3.5 w-3.5 ${studioIconToneClass("neutral")}`} />,
    },
    {
      id: "health",
      tone: telemetryHealthTone,
      srLabel: studio.ui.labels.health,
      tooltip: `${studio.ui.labels.health}: ${telemetryHealthReason ?? telemetryHealthLabel}`,
      icon: <ShieldCheck className={`h-3.5 w-3.5 ${studioIconToneClass(telemetryHealthTone)}`} />,
    },
  ];
  const shortcutPlatform = normalizeShortcutDisplayPlatform(
    typeof navigator === "undefined"
      ? undefined
      : ((navigator as { userAgentData?: { platform?: string } }).userAgentData?.platform ??
          navigator.platform ??
          navigator.userAgent),
  );
  const utilityActions = [
    {
      id: "refresh",
      onClick: () => void studio.refreshAll(),
      disabled: studio.isRunningAction || studio.isRefreshing,
      srLabel: studio.ui.actions.refresh,
      tooltip: studio.ui.actions.refresh,
      icon: <RefreshCcw className={`h-4 w-4 ${studioIconToneClass("neutral")}`} />,
    },
    {
      id: "save",
      onClick: () => void studio.saveProjectMutation.mutateAsync(false),
      disabled: studio.isRunningAction || !studio.recordingURL,
      title: recordingActionDisabledReason,
      srLabel: studio.ui.actions.saveProject,
      tooltip: (
        <ShortcutHint
          label={studio.ui.actions.saveProject}
          keys={studioShortcutDisplayTokens("save", { platform: shortcutPlatform })}
        />
      ),
      icon: <Save className={`h-4 w-4 ${studioIconToneClass("neutral")}`} />,
    },
    {
      id: "export",
      onClick: () => void studio.exportMutation.mutateAsync(),
      disabled: studio.isRunningAction || !studio.recordingURL,
      title: recordingActionDisabledReason,
      srLabel: studio.ui.actions.exportNow,
      tooltip: (
        <ShortcutHint
          label={studio.ui.actions.exportNow}
          keys={studioShortcutDisplayTokens("export", { platform: shortcutPlatform })}
        />
      ),
      icon: <HardDriveDownload className={`h-4 w-4 ${studioIconToneClass("neutral")}`} />,
    },
    {
      id: "toggle-left-pane",
      onClick: studio.toggleLeftPaneCollapsed,
      srLabel: studio.ui.actions.toggleLeftPane,
      tooltip: studio.ui.actions.toggleLeftPane,
      icon: <PanelLeftClose className={`h-4 w-4 ${studioIconToneClass("neutral")}`} />,
    },
    {
      id: "toggle-right-pane",
      onClick: studio.toggleRightPaneCollapsed,
      srLabel: studio.ui.actions.toggleRightPane,
      tooltip: studio.ui.actions.toggleRightPane,
      icon: <PanelRightClose className={`h-4 w-4 ${studioIconToneClass("neutral")}`} />,
    },
    {
      id: "toggle-timeline",
      onClick: studio.toggleTimelineCollapsed,
      srLabel: studio.ui.actions.toggleTimeline,
      tooltip: studio.ui.actions.toggleTimeline,
      icon: <SplitSquareVertical className={`h-4 w-4 ${studioIconToneClass("neutral")}`} />,
    },
    {
      id: "reset-layout",
      onClick: studio.resetLayout,
      srLabel: studio.ui.actions.resetLayout,
      tooltip: studio.ui.actions.resetLayout,
      icon: <LayoutPanelTop className={`h-4 w-4 ${studioIconToneClass("neutral")}`} />,
    },
  ];

  useEffect(() => {
    if (activeLocale === studio.locale) {
      return;
    }
    setLastRoute(activeRoute);
    void navigate({
      to: localizedRouteTargetFor(activeRoute),
      params: { locale: studio.locale },
      replace: true,
    });
  }, [activeLocale, activeRoute, navigate, setLastRoute, studio.locale]);

  return (
    <div className="h-full overflow-hidden bg-background">
      <div
        className="gg-shell-frame mx-auto flex h-full max-w-[1780px] flex-col overflow-hidden"
        data-density={studio.densityMode}
      >
        <header className="gg-shell-header px-4 py-2">
          <TooltipProvider delay={120}>
            <div className="flex flex-col gap-2 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-center">
              <div className="flex flex-wrap items-center gap-1.5 lg:justify-self-start">
                <h1 className="mr-2 text-sm font-semibold tracking-tight">{studio.ui.app.title}</h1>
                <ButtonGroup className="gg-toolbar-group gap-1 rounded-lg border p-1">
                  {modeItems.map((item) => (
                    <Tooltip key={item.route}>
                      <TooltipTrigger
                        render={
                          <Link
                            to={item.to}
                            params={{ locale: activeLocale }}
                            className={modeIconClass(item.active)}
                            aria-current={item.active ? "page" : undefined}
                            onClick={() => setLastRoute(item.route)}
                          />
                        }
                      >
                        <item.icon
                          className={`h-3.5 w-3.5 ${studioIconToneClass(item.active ? "selected" : "neutral")}`}
                        />
                        <span className="sr-only">{item.label}</span>
                      </TooltipTrigger>
                      <TooltipContent>{item.label}</TooltipContent>
                    </Tooltip>
                  ))}
                </ButtonGroup>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 lg:justify-self-center">
                <ButtonGroup className="gg-toolbar-group gap-1 rounded-lg border p-1">
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          size="icon-sm"
                          variant="outline"
                          className={studioButtonToneClass("neutral")}
                          onClick={studio.toggleTimelinePlayback}
                          disabled={studio.timelineDuration <= 0}
                        />
                      }
                    >
                      {studio.isTimelinePlaying ? (
                        <Pause className={`h-4 w-4 ${studioIconToneClass("neutral")}`} />
                      ) : (
                        <Play className={`h-4 w-4 ${studioIconToneClass("neutral")}`} />
                      )}
                      <span className="sr-only">{studio.ui.actions.playPause}</span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <ShortcutHint
                        label={studio.ui.actions.playPause}
                        keys={studioShortcutDisplayTokens("playPause", {
                          platform: shortcutPlatform,
                          spaceKeyLabel: studio.ui.shortcuts.playPause,
                        })}
                      />
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          size="icon-sm"
                          variant="outline"
                          className={studioButtonToneClass(isRecording ? "record" : "neutral")}
                          onClick={() => void studio.toggleRecordingMutation.mutateAsync()}
                          disabled={studio.isRunningAction}
                        />
                      }
                    >
                      <Video
                        className={`h-4 w-4 ${studioIconToneClass(isRecording ? "record" : "neutral")}`}
                      />
                      <span className="sr-only">
                        {studio.captureStatusQuery.data?.isRecording
                          ? studio.ui.actions.stopRecording
                          : studio.ui.actions.startRecording}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <ShortcutHint
                        label={
                          studio.captureStatusQuery.data?.isRecording
                            ? studio.ui.actions.stopRecording
                            : studio.ui.actions.startRecording
                        }
                        keys={studioShortcutDisplayTokens("record", {
                          platform: shortcutPlatform,
                        })}
                      />
                    </TooltipContent>
                  </Tooltip>
                </ButtonGroup>

                <div className="gg-toolbar-group flex items-center gap-1 rounded-lg border p-1">
                  {telemetryBadges.map((badge) => (
                    <HeaderIconBadge
                      key={badge.id}
                      tone={badge.tone}
                      srLabel={badge.srLabel}
                      tooltip={badge.tooltip}
                    >
                      {badge.icon}
                    </HeaderIconBadge>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 lg:justify-self-end">
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Badge
                        className={`gg-header-icon-badge h-7 w-7 justify-center p-0 ${studioBadgeToneClass(permissionTone)}`}
                        variant="outline"
                      />
                    }
                  >
                    {studio.permissionsQuery.data?.screenRecordingGranted ? (
                      <ShieldCheck
                        className={`h-3.5 w-3.5 ${studioIconToneClass(permissionTone)}`}
                      />
                    ) : (
                      <ShieldAlert
                        className={`h-3.5 w-3.5 ${studioIconToneClass(permissionTone)}`}
                      />
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
                        <Badge
                          className={`gg-header-icon-badge h-7 w-7 justify-center p-0 ${studioBadgeToneClass("error")}`}
                          variant="outline"
                        />
                      }
                    >
                      <AlertTriangle className={`h-3.5 w-3.5 ${studioIconToneClass("error")}`} />
                      <span className="sr-only">{studio.ui.helper.degradedModeTitle}</span>
                    </TooltipTrigger>
                    <TooltipContent>{studio.ui.helper.degradedModeTitle}</TooltipContent>
                  </Tooltip>
                ) : null}

                {utilityActions.map((action) => (
                  <HeaderIconButton
                    key={action.id}
                    onClick={action.onClick}
                    disabled={action.disabled}
                    title={action.title}
                    srLabel={action.srLabel}
                    tooltip={action.tooltip}
                    icon={action.icon}
                  />
                ))}
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
