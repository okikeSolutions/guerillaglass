import { capturePermissionState } from "../view-model/capturePermissionState";
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
  Settings,
  Undo2,
  Redo2,
  ChevronDown,
  HardDriveDownload,
  LayoutPanelTop,
  PanelLeftClose,
  PanelRightClose,
  RefreshCcw,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@guerillaglass/ui/components/tooltip";
import type { StudioShortcutOverrides } from "@shared/shortcuts";
import { useStudioRenderDiagnostics } from "@lib/studioDiagnostics";
import { useStudio } from "../state/StudioProvider";
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
  activeRoute: StudioLayoutRoute,
): HeaderIconButtonModel[] {
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
    actions.splice(3, 0, {
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
  useStudioRenderDiagnostics("StudioShellHeader", { route: activeRoute });
  const modeItems = buildModeItems(studio, activeRoute);
  const utilityActions = buildUtilityActions(studio, activeRoute);
  const isRecording = Boolean(studio.captureStatusQuery.data?.isRecording);
  const captureMode = activeRoute === "/capture";
  const permissionState = capturePermissionState(studio.permissionsQuery);
  const permissionLabel =
    permissionState === "checking"
      ? m.ui_capture_permission_checking(undefined, { locale: studio.locale })
      : permissionState === "failed"
        ? m.ui_capture_permission_check_failed(undefined, { locale: studio.locale })
        : permissionState === "unknown"
          ? m.ui_capture_permission_unknown(undefined, { locale: studio.locale })
          : permissionState === "granted"
            ? studio.ui.labels.permissionReady
            : studio.ui.labels.permissionRequired;
  const permissionTone =
    permissionState === "granted"
      ? "live"
      : permissionState === "denied" || permissionState === "failed"
        ? "error"
        : "neutral";
  const captureBlocked =
    studio.isRunningAction || permissionState === "checking" || permissionState === "failed";
  const blocked = studio.isRunningAction || isRecording;
  const record = (options: {
    captureSourceOverride: "display" | "window";
    preferCurrentWindow?: true;
    preferWindowPicker?: true;
  }) => {
    studio.settingsForm.setFieldValue("captureSource", options.captureSourceOverride);
    studio.toggleRecordingMutation.mutate(options);
  };
  return (
    <header className="gg-shell-header px-4 py-2">
      <TooltipProvider delay={500}>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <div className="min-w-0 max-w-52">
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
            <nav className="flex items-center gap-1" aria-label={studio.ui.app.title}>
              {modeItems.map((item) => (
                <Link
                  key={item.route}
                  to={item.to}
                  params={{ locale: activeLocale }}
                  className={modeIconClass(item.active)}
                  aria-current={item.active ? "page" : undefined}
                  onClick={() => studio.setLastRoute(item.route)}
                >
                  <item.icon className="size-3.5" />
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {captureMode || isRecording ? (
              <ButtonGroup>
                {isRecording ? (
                  <Button
                    size="sm"
                    className={studioButtonToneClass("record")}
                    disabled={studio.isRunningAction}
                    onClick={() => studio.toggleRecordingMutation.mutate(undefined)}
                  >
                    <Video className="size-4" />
                    {studio.ui.actions.stopRecording}
                    <span className="gg-numeric">
                      {studio.formatDuration(
                        studio.captureStatusQuery.data?.recordingDurationSeconds ?? 0,
                      )}
                    </span>
                  </Button>
                ) : (
                  <>
                    <Button
                      size="sm"
                      disabled={captureBlocked}
                      onClick={() =>
                        record(
                          resolveConfiguredRecordingOptions(
                            studio.settingsForm.state.values.captureSource,
                          ),
                        )
                      }
                    >
                      <Video className="size-4" />
                      {studio.ui.actions.startRecording}
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            size="icon-sm"
                            variant="outline"
                            aria-label={studio.ui.labels.captureSource}
                            disabled={captureBlocked}
                          />
                        }
                      >
                        <ChevronDown className="size-3" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem
                          onClick={() => record({ captureSourceOverride: "display" })}
                        >
                          {studio.ui.actions.recordDisplay}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            record({ captureSourceOverride: "window", preferCurrentWindow: true })
                          }
                        >
                          {studio.ui.actions.recordCurrentWindow}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            record({ captureSourceOverride: "window", preferWindowPicker: true })
                          }
                        >
                          {studio.ui.actions.recordChooseWindow}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
              </ButtonGroup>
            ) : null}
            {captureMode || isRecording ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Badge variant="outline" className={studioBadgeToneClass(permissionTone)} />
                  }
                >
                  <span className="sr-only">{permissionLabel}</span>
                  {studio.permissionsQuery.isSuccess &&
                  studio.permissionsQuery.data.screenRecordingGranted ? (
                    <ShieldCheck className="size-4" />
                  ) : (
                    <ShieldAlert className="size-4" />
                  )}
                </TooltipTrigger>
                <TooltipContent>{permissionLabel}</TooltipContent>
              </Tooltip>
            ) : null}
            {!captureMode ? (
              <>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={m.ui_workflow_undo(undefined, { locale: studio.locale })}
                  title={m.ui_workflow_undo(undefined, { locale: studio.locale })}
                  disabled={!studio.canUndoTimeline || blocked}
                  onClick={studio.undoTimeline}
                >
                  <Undo2 className="size-4" />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={m.ui_workflow_redo(undefined, { locale: studio.locale })}
                  title={m.ui_workflow_redo(undefined, { locale: studio.locale })}
                  disabled={!studio.canRedoTimeline || blocked}
                  onClick={studio.redoTimeline}
                >
                  <Redo2 className="size-4" />
                </Button>
              </>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button size="sm" variant="outline" />}>
                {m.ui_workflow_project_files(undefined, { locale: studio.locale })}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  disabled={blocked}
                  onClick={() => void studio.openProjectMutation.mutateAsync()}
                >
                  {studio.ui.actions.openProject}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={blocked || !studio.recordingURL}
                  onClick={() => void studio.saveProjectMutation.mutateAsync(false)}
                >
                  {studio.ui.actions.saveProject}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={blocked || !studio.recordingURL}
                  onClick={() => void studio.saveProjectMutation.mutateAsync(true)}
                >
                  {studio.ui.actions.saveProjectAs}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button size="sm" variant="ghost" />}>
                {m.ui_workflow_view(undefined, { locale: studio.locale })}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {utilityActions.map((action) => (
                  <DropdownMenuItem
                    key={action.id}
                    disabled={action.disabled}
                    onClick={action.onClick}
                  >
                    {action.icon}
                    {action.srLabel}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <StudioPreferences />
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
