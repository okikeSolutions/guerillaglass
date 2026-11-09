import { NativeSelect, NativeSelectOption } from "@guerillaglass/ui/components/native-select";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@guerillaglass/ui/components/dialog";
import { Checkbox } from "@guerillaglass/ui/components/checkbox";
import { ShortcutOverridesSection } from "../panels/inspector/ShortcutOverridesSection";
import {
  AlertTriangle,
  Settings,
  Undo2,
  Redo2,
  ChevronDown,
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
import * as m from "../../../../paraglide/messages.js";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Badge } from "@guerillaglass/ui/components/badge";
import { Button } from "@guerillaglass/ui/components/button";
import { ButtonGroup } from "@guerillaglass/ui/components/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@guerillaglass/ui/components/dropdown-menu";
import { ShortcutHint } from "@guerillaglass/ui/desktop/shortcut-hint";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@guerillaglass/ui/components/tooltip";
import {
  detectStudioShortcutPlatform,
  type ShortcutDisplayPlatform,
  type StudioShortcutOverrides,
  studioShortcutDisplayTokens,
} from "@shared/shortcuts";
import { useStudioRenderDiagnostics } from "@lib/studioDiagnostics";
import { useStudio, useStudioPlaybackValue } from "../state/StudioProvider";
import type { StudioLayoutRoute, StudioLocalizedRouteTarget } from "../contracts/studioLayoutModel";
import {
  studioBadgeToneClass,
  studioButtonToneClass,
  studioIconToneClass,
} from "../view-model/studioSemanticTone";

type ModeItem = {
  route: StudioLayoutRoute;
  to: StudioLocalizedRouteTarget;
  label: string;
  active: boolean;
  icon: typeof Video;
};

type HeaderIconButtonModel = {
  id: string;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  srLabel: string;
  tooltip: ReactNode;
  icon: ReactNode;
};

type HeaderStudio = {
  readonly ui: Pick<ReturnType<typeof useStudio>["ui"], "modes" | "actions">;
  readonly recordingURL: string | null;
  readonly timelineDocument?: { readonly items: readonly unknown[] };
  readonly recordingRequiredNotice: string;
  readonly isRunningAction: boolean;
  readonly isRefreshing: boolean;
  readonly refreshAll: () => Promise<unknown>;
  readonly saveProjectMutation: { readonly mutateAsync: (saveAs: boolean) => Promise<unknown> };
  readonly exportMutation: { readonly mutateAsync: () => Promise<unknown> };
  readonly shortcutOverrides: StudioShortcutOverrides;
  readonly toggleLeftPaneCollapsed: () => void;
  readonly toggleRightPaneCollapsed: () => void;
  readonly toggleTimelineCollapsed: () => void;
  readonly resetLayout: () => void;
};

function modeIconClass(isActive: boolean): string {
  return isActive
    ? "gg-button-tone gg-tone-selected inline-flex h-8 items-center justify-center gap-1.5 px-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-primary/80"
    : "gg-button-tone gg-tone-neutral inline-flex h-8 items-center justify-center gap-1.5 px-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-primary/80";
}

function resolveShortcutPlatform(): ShortcutDisplayPlatform | undefined {
  if (typeof navigator === "undefined") {
    return undefined;
  }
  return detectStudioShortcutPlatform();
}

function HeaderIconButton({
  onClick,
  disabled,
  title,
  srLabel,
  tooltip,
  icon,
  showLabel = false,
}: {
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  srLabel: string;
  tooltip: ReactNode;
  icon: ReactNode;
  showLabel?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            size={showLabel ? "sm" : "icon-sm"}
            variant="outline"
            className={`gg-header-icon-button ${studioButtonToneClass("neutral")}`}
            onClick={onClick}
            disabled={disabled}
            title={title}
          />
        }
      >
        {icon}
        <span className={showLabel ? undefined : "sr-only"}>{srLabel}</span>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export function buildModeItems(studio: HeaderStudio, activeRoute: StudioLayoutRoute): ModeItem[] {
  return [
    {
      route: "/capture",
      to: "/$locale/capture",
      label: studio.ui.modes.capture,
      icon: Video,
      active: activeRoute === "/capture",
    },
    {
      route: "/edit",
      to: "/$locale/edit",
      label: studio.ui.modes.edit,
      icon: Scissors,
      active: activeRoute === "/edit",
    },
    {
      route: "/deliver",
      to: "/$locale/deliver",
      label: studio.ui.modes.deliver,
      icon: HardDriveDownload,
      active: activeRoute === "/deliver",
    },
  ];
}

export function buildUtilityActions(
  studio: HeaderStudio,
  shortcutPlatform: ShortcutDisplayPlatform | undefined,
  activeRoute: StudioLayoutRoute,
): HeaderIconButtonModel[] {
  const recordingActionDisabledReason = studio.recordingURL
    ? undefined
    : studio.recordingRequiredNotice;

  const actions: HeaderIconButtonModel[] = [
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
          keys={studioShortcutDisplayTokens("save", {
            platform: shortcutPlatform,
            overrides: studio.shortcutOverrides,
          })}
        />
      ),
      icon: <Save className={`h-4 w-4 ${studioIconToneClass("neutral")}`} />,
    },
    {
      id: "export",
      onClick: () => void studio.exportMutation.mutateAsync(),
      disabled:
        studio.isRunningAction ||
        !studio.recordingURL ||
        studio.timelineDocument?.items.length === 0,
      title: recordingActionDisabledReason,
      srLabel: studio.ui.actions.exportNow,
      tooltip: (
        <ShortcutHint
          label={studio.ui.actions.exportNow}
          keys={studioShortcutDisplayTokens("export", {
            platform: shortcutPlatform,
            overrides: studio.shortcutOverrides,
          })}
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
      id: "reset-layout",
      onClick: studio.resetLayout,
      srLabel: studio.ui.actions.resetLayout,
      tooltip: studio.ui.actions.resetLayout,
      icon: <LayoutPanelTop className={`h-4 w-4 ${studioIconToneClass("neutral")}`} />,
    },
  ];

  if (activeRoute !== "/capture") {
    actions.splice(5, 0, {
      id: "toggle-timeline",
      onClick: studio.toggleTimelineCollapsed,
      srLabel: studio.ui.actions.toggleTimeline,
      tooltip: studio.ui.actions.toggleTimeline,
      icon: <SplitSquareVertical className={`h-4 w-4 ${studioIconToneClass("neutral")}`} />,
    });
  }

  return actions;
}

export function resolveConfiguredRecordingOptions(captureSource: "display" | "window"): {
  captureSourceOverride: "display" | "window";
} {
  return { captureSourceOverride: captureSource };
}
export function StudioShellHeader({
  activeLocale,
  activeRoute,
}: {
  activeLocale: string;
  activeRoute: StudioLayoutRoute;
}) {
  const studio = useStudio();
  useStudioRenderDiagnostics("StudioShellHeader", {
    route: activeRoute,
  });
  const shortcutPlatform = resolveShortcutPlatform();
  const modeItems = buildModeItems(studio, activeRoute);
  const utilityActions = buildUtilityActions(studio, shortcutPlatform, activeRoute);
  const isTimelinePlaying = useStudioPlaybackValue((snapshot) => snapshot.isPlaying);
  const isRecording = Boolean(studio.captureStatusQuery.data?.isRecording);
  const permissionTone = !studio.permissionsQuery.data
    ? "neutral"
    : studio.permissionsQuery.data.screenRecordingGranted
      ? "live"
      : "error";
  const permissionLabel = !studio.permissionsQuery.data
    ? studio.ui.values.unknown
    : studio.permissionsQuery.data.screenRecordingGranted
      ? studio.ui.labels.permissionReady
      : studio.ui.labels.permissionRequired;
  const isCaptureActionDisabled = studio.isRunningAction;
  const activeCaptureSourceLabel =
    studio.settingsForm.state.values.captureSource === "display"
      ? studio.ui.labels.display
      : studio.ui.labels.window;
  const startConfiguredRecording = () => {
    studio.toggleRecordingMutation.mutate(
      resolveConfiguredRecordingOptions(studio.settingsForm.state.values.captureSource),
    );
  };

  const startDisplayRecording = () => {
    studio.settingsForm.setFieldValue("captureSource", "display");
    studio.toggleRecordingMutation.mutate({
      captureSourceOverride: "display",
    });
  };

  const startCurrentWindowRecording = () => {
    studio.settingsForm.setFieldValue("captureSource", "window");
    studio.toggleRecordingMutation.mutate({
      captureSourceOverride: "window",
      preferCurrentWindow: true,
    });
  };

  const startRecordingWithWindowPicker = () => {
    studio.settingsForm.setFieldValue("captureSource", "window");
    studio.toggleRecordingMutation.mutate({
      captureSourceOverride: "window",
      preferWindowPicker: true,
    });
  };

  return (
    <header className="gg-shell-header px-4 py-2">
      <TooltipProvider delay={500}>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex shrink-0 items-center gap-3">
            <div className="mr-2 min-w-0 max-w-52">
              <h1
                className="truncate text-sm font-medium"
                title={studio.projectQuery.data?.projectPath ?? undefined}
              >
                {studio.projectQuery.data?.projectPath
                  ?.split(/[\\/]/)
                  .filter(Boolean)
                  .pop()
                  ?.replace(/\.gglassproj$/i, "") || studio.ui.values.untitled}
              </h1>
              <p className="text-xs text-muted-foreground">
                {studio.hasUnsavedProjectEdits
                  ? m.ui_workflow_unsaved(undefined, { locale: studio.locale })
                  : studio.projectQuery.data?.projectPath
                    ? m.ui_workflow_saved(undefined, { locale: studio.locale })
                    : studio.ui.labels.notSaved}
              </p>
            </div>
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
                        onClick={() => studio.setLastRoute(item.route)}
                      />
                    }
                  >
                    <item.icon
                      className={`h-3.5 w-3.5 ${studioIconToneClass(item.active ? "selected" : "neutral")}`}
                    />
                    <span>{item.label}</span>
                  </TooltipTrigger>
                  <TooltipContent>{item.label}</TooltipContent>
                </Tooltip>
              ))}
            </ButtonGroup>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <ButtonGroup className="gg-capture-button-group gg-toolbar-group gap-1 rounded-lg border p-1">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      size="icon-sm"
                      variant="outline"
                      className={studioButtonToneClass("neutral")}
                      onClick={studio.toggleTimelinePlayback}
                      disabled={
                        !studio.recordingURL ||
                        studio.timelineDuration <= 0 ||
                        studio.isRunningAction
                      }
                    />
                  }
                >
                  {isTimelinePlaying ? (
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
                      overrides: studio.shortcutOverrides,
                      spaceKeyLabel: studio.ui.shortcuts.playPause,
                    })}
                  />
                </TooltipContent>
              </Tooltip>

              {isRecording ? (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        size="sm"
                        variant="outline"
                        className={studioButtonToneClass("record")}
                        onClick={() => studio.toggleRecordingMutation.mutate(undefined)}
                        disabled={isCaptureActionDisabled}
                      />
                    }
                  >
                    <Video className={`h-4 w-4 ${studioIconToneClass("record")}`} />
                    <span>{studio.ui.actions.stopRecording}</span>
                    <span className="gg-numeric">
                      {studio.formatDuration(
                        studio.captureStatusQuery.data?.recordingDurationSeconds ?? 0,
                      )}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <ShortcutHint
                      label={studio.ui.actions.stopRecording}
                      keys={studioShortcutDisplayTokens("record", {
                        platform: shortcutPlatform,
                        overrides: studio.shortcutOverrides,
                      })}
                    />
                  </TooltipContent>
                </Tooltip>
              ) : (
                <DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          size="sm"
                          variant="outline"
                          className={studioButtonToneClass("neutral")}
                          onClick={startConfiguredRecording}
                          disabled={isCaptureActionDisabled}
                          aria-label={`${studio.ui.actions.startRecording} ${activeCaptureSourceLabel}`}
                        />
                      }
                    >
                      <Video className={`h-4 w-4 ${studioIconToneClass("neutral")}`} />
                      <span>{studio.ui.actions.startRecording}</span>
                      <span className="sr-only">{studio.ui.actions.startRecording}</span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <ShortcutHint
                        label={`${studio.ui.actions.startRecording} (${activeCaptureSourceLabel})`}
                        keys={studioShortcutDisplayTokens("record", {
                          platform: shortcutPlatform,
                          overrides: studio.shortcutOverrides,
                        })}
                      />
                    </TooltipContent>
                  </Tooltip>

                  <DropdownMenuTrigger
                    render={
                      <Button
                        size="icon-sm"
                        variant="outline"
                        className={studioButtonToneClass("neutral")}
                        disabled={isCaptureActionDisabled}
                        aria-label={studio.ui.actions.startRecording}
                      />
                    }
                  >
                    <ChevronDown className={`h-3 w-3 ${studioIconToneClass("neutral")}`} />
                    <span className="sr-only">{studio.ui.actions.startRecording}</span>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="center" sideOffset={6} className="w-auto min-w-30">
                    <DropdownMenuItem
                      onClick={startDisplayRecording}
                      disabled={isCaptureActionDisabled}
                    >
                      {studio.ui.actions.recordDisplay}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={startCurrentWindowRecording}
                      disabled={isCaptureActionDisabled}
                    >
                      {studio.ui.actions.recordCurrentWindow}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={startRecordingWithWindowPicker}
                      disabled={isCaptureActionDisabled}
                    >
                      {studio.ui.actions.recordChooseWindow}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </ButtonGroup>
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
                  <ShieldCheck className={`h-3.5 w-3.5 ${studioIconToneClass(permissionTone)}`} />
                ) : (
                  <ShieldAlert className={`h-3.5 w-3.5 ${studioIconToneClass(permissionTone)}`} />
                )}
                <span className="sr-only">{permissionLabel}</span>
              </TooltipTrigger>
              <TooltipContent>{permissionLabel}</TooltipContent>
            </Tooltip>

            {studio.inputMonitoringDenied && studio.settingsForm.state.values.trackInputEvents ? (
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

            <Button
              size="sm"
              variant="ghost"
              disabled={studio.isRunningAction}
              onClick={() => void studio.openProjectMutation.mutateAsync()}
            >
              {studio.ui.actions.openProject}
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={m.ui_workflow_undo(undefined, { locale: studio.locale })}
              title={m.ui_workflow_undo(undefined, { locale: studio.locale })}
              disabled={
                !studio.canUndoTimeline ||
                studio.isRunningAction ||
                Boolean(studio.captureStatusQuery.data?.isRecording)
              }
              onClick={studio.undoTimeline}
            >
              <Undo2 className="size-4" />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={m.ui_workflow_redo(undefined, { locale: studio.locale })}
              title={m.ui_workflow_redo(undefined, { locale: studio.locale })}
              disabled={
                !studio.canRedoTimeline ||
                studio.isRunningAction ||
                Boolean(studio.captureStatusQuery.data?.isRecording)
              }
              onClick={studio.redoTimeline}
            >
              <Redo2 className="size-4" />
            </Button>
            <StudioPreferences />
            {utilityActions.map((action) => (
              <HeaderIconButton
                key={action.id}
                showLabel={action.id === "save" || action.id === "export"}
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
  );
}

export function StudioPreferences() {
  const studio = useStudio();
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={m.ui_workflow_preferences(undefined, { locale: studio.locale })}
          />
        }
      >
        <Settings className="size-4" />
      </DialogTrigger>
      <DialogContent
        showCloseButton
        closeLabel={m.ui_workflow_close(undefined, { locale: studio.locale })}
        className="max-h-[80svh] overflow-y-auto sm:max-w-xl"
      >
        <DialogTitle>{m.ui_workflow_preferences(undefined, { locale: studio.locale })}</DialogTitle>
        <label className="flex items-center gap-2">
          <Checkbox
            checked={studio.settingsForm.state.values.singleKeyShortcutsEnabled}
            onCheckedChange={(checked) =>
              studio.settingsForm.setFieldValue("singleKeyShortcutsEnabled", checked === true)
            }
          />
          {studio.ui.labels.singleKeyShortcuts}
        </label>
        <label className="grid gap-2">
          {studio.ui.labels.language}
          <NativeSelect
            value={studio.locale}
            onChange={(event) =>
              studio.setLocale(event.target.value === "de-DE" ? "de-DE" : "en-US")
            }
          >
            <NativeSelectOption value="en-US">{studio.ui.labels.localeEnglish}</NativeSelectOption>
            <NativeSelectOption value="de-DE">{studio.ui.labels.localeGerman}</NativeSelectOption>
          </NativeSelect>
        </label>
        <label className="grid gap-2">
          {studio.ui.labels.density}
          <NativeSelect
            value={studio.densityMode}
            onChange={(event) =>
              studio.setDensityMode(event.target.value === "compact" ? "compact" : "comfortable")
            }
          >
            <NativeSelectOption value="comfortable">
              {studio.ui.labels.densityComfortable}
            </NativeSelectOption>
            <NativeSelectOption value="compact">
              {studio.ui.labels.densityCompact}
            </NativeSelectOption>
          </NativeSelect>
        </label>
        <ShortcutOverridesSection />
        <DialogClose render={<Button variant="outline" />}>
          {m.ui_workflow_close(undefined, { locale: studio.locale })}
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
