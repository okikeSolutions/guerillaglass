import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FolderOpen,
  HardDriveDownload,
  Keyboard,
  Mic,
  MonitorCog,
  MousePointer,
  Pause,
  Play,
  RefreshCcw,
  Save,
  Scissors,
  ScreenShare,
  ShieldCheck,
  Sparkles,
  Video,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { enUS } from "@/i18n/en";
import { desktopApi, engineApi } from "@/lib/engine";
import type {
  AutoZoomSettings,
  CaptureStatusResult,
  ExportPreset,
  PermissionsResult,
  ProjectState,
  SourcesResult,
} from "@guerillaglass/engine-protocol";

type CaptureSourceMode = "display" | "window";
type InspectorTab = "capture" | "effects" | "export" | "project" | "advanced";
type Notice = { kind: "error" | "success" | "info"; message: string } | null;

const ui = enUS;

const defaultAutoZoom: AutoZoomSettings = {
  isEnabled: true,
  intensity: 1,
  minimumKeyframeInterval: 1 / 30,
};

const playbackRates = [0.5, 1, 1.5, 2] as const;

function formatDuration(seconds: number): string {
  const clamped = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(clamped / 3600)
    .toString()
    .padStart(2, "0");
  const minutes = Math.floor((clamped % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const remainder = (clamped % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}:${remainder}`;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function permissionBadgeVariant(
  permissions: PermissionsResult | null,
): "default" | "secondary" | "destructive" {
  if (!permissions) {
    return "secondary";
  }
  if (!permissions.screenRecordingGranted) {
    return "destructive";
  }
  return "default";
}

function formatAspectRatio(width: number, height: number): string {
  if (width === 0 || height === 0) {
    return "-";
  }
  const ratio = width / height;
  if (Math.abs(ratio - 16 / 9) < 0.01) {
    return "16:9";
  }
  if (Math.abs(ratio - 9 / 16) < 0.01) {
    return "9:16";
  }
  return `${width}:${height}`;
}

export default function App() {
  const [permissions, setPermissions] = useState<PermissionsResult | null>(null);
  const [sources, setSources] = useState<SourcesResult | null>(null);
  const [status, setStatus] = useState<CaptureStatusResult | null>(null);
  const [project, setProject] = useState<ProjectState | null>(null);
  const [presets, setPresets] = useState<ExportPreset[]>([]);

  const [captureSource, setCaptureSource] = useState<CaptureSourceMode>("display");
  const [selectedWindowId, setSelectedWindowId] = useState<number>(0);
  const [micEnabled, setMicEnabled] = useState(false);
  const [trackInputEvents, setTrackInputEvents] = useState(true);

  const [trimStartSeconds, setTrimStartSeconds] = useState(0);
  const [trimEndSeconds, setTrimEndSeconds] = useState(0);
  const [playheadSeconds, setPlayheadSeconds] = useState(0);
  const [isTimelinePlaying, setIsTimelinePlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<(typeof playbackRates)[number]>(1);

  const [selectedPresetId, setSelectedPresetId] = useState<string>("h264-1080p-30");
  const [exportFileName, setExportFileName] = useState("guerillaglass-export");
  const [autoZoom, setAutoZoom] = useState<AutoZoomSettings>(defaultAutoZoom);

  const [backgroundFramingEnabled, setBackgroundFramingEnabled] = useState(false);
  const [backgroundPadding, setBackgroundPadding] = useState(16);
  const [cornerRoundness, setCornerRoundness] = useState(0.4);
  const [shadowStrength, setShadowStrength] = useState(0.35);
  const [motionBlurAmount, setMotionBlurAmount] = useState(0.25);
  const [simulatorAutoCrop, setSimulatorAutoCrop] = useState(false);
  const [segmentOverridesEnabled, setSegmentOverridesEnabled] = useState(false);

  const [activeInspectorTab, setActiveInspectorTab] = useState<InspectorTab>("capture");

  const [isRefreshing, setIsRefreshing] = useState(true);
  const [isRunningAction, setIsRunningAction] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const recordingURL = status?.recordingURL ?? project?.recordingURL ?? null;

  const selectedPreset = useMemo(
    () => presets.find((preset) => preset.id === selectedPresetId) ?? presets[0],
    [presets, selectedPresetId],
  );

  const windowChoices = useMemo(() => sources?.windows ?? [], [sources?.windows]);

  const timelineDuration = useMemo(
    () =>
      Math.max(
        status?.recordingDurationSeconds ?? 0,
        trimStartSeconds,
        trimEndSeconds,
        playheadSeconds,
        1,
      ),
    [status?.recordingDurationSeconds, trimStartSeconds, trimEndSeconds, playheadSeconds],
  );

  const captureStatusLabel = status?.isRecording
    ? ui.labels.recording
    : status?.isRunning
      ? ui.labels.previewing
      : ui.labels.idle;

  const inputMonitoringDenied = permissions?.inputMonitoring === "denied";

  useEffect(() => {
    if (captureSource === "window") {
      const match = windowChoices.find((windowItem) => windowItem.id === selectedWindowId);
      if (!match && windowChoices.length > 0) {
        setSelectedWindowId(windowChoices[0]!.id);
      }
      if (windowChoices.length === 0) {
        setSelectedWindowId(0);
      }
    }
  }, [captureSource, selectedWindowId, windowChoices]);

  useEffect(() => {
    setPlayheadSeconds((current) => clamp(current, 0, timelineDuration));
  }, [timelineDuration]);

  useEffect(() => {
    if (!isTimelinePlaying) {
      return;
    }

    const timer = setInterval(() => {
      setPlayheadSeconds((previous) => {
        const next = previous + 0.05 * playbackRate;
        if (next >= timelineDuration) {
          setIsTimelinePlaying(false);
          return timelineDuration;
        }
        return next;
      });
    }, 50);

    return () => clearInterval(timer);
  }, [isTimelinePlaying, playbackRate, timelineDuration]);

  const refreshStatusOnly = useCallback(async () => {
    try {
      setStatus(await engineApi.captureStatus());
    } catch {
      // keep latest status
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [ping, nextPermissions, nextSources, nextStatus, exportInfo, currentProject] =
        await Promise.all([
          engineApi.ping(),
          engineApi.getPermissions(),
          engineApi.listSources(),
          engineApi.captureStatus(),
          engineApi.exportInfo(),
          engineApi.projectCurrent(),
        ]);

      setPermissions(nextPermissions);
      setSources(nextSources);
      setStatus(nextStatus);
      setPresets(exportInfo.presets);
      setProject(currentProject);
      setAutoZoom(currentProject.autoZoom);
      if (
        exportInfo.presets.length > 0 &&
        !exportInfo.presets.some((preset) => preset.id === selectedPresetId)
      ) {
        setSelectedPresetId(exportInfo.presets[0]!.id);
      }
      setNotice({
        kind: "info",
        message: ui.app.connectionMessage(ping.platform, ping.engineVersion),
      });
    } catch (error) {
      setNotice({
        kind: "error",
        message: error instanceof Error ? error.message : ui.notices.refreshFailed,
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [selectedPresetId]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    const timer = setInterval(() => {
      void refreshStatusOnly();
    }, 1000);
    return () => clearInterval(timer);
  }, [refreshStatusOnly]);

  async function runAction(action: () => Promise<void>) {
    setIsRunningAction(true);
    try {
      await action();
    } catch (error) {
      setNotice({
        kind: "error",
        message: error instanceof Error ? error.message : ui.notices.actionFailed,
      });
    } finally {
      setIsRunningAction(false);
    }
  }

  async function handlePermissionRequest(kind: "screen" | "mic" | "input") {
    await runAction(async () => {
      if (kind === "screen") {
        await engineApi.requestScreenRecordingPermission();
      }
      if (kind === "mic") {
        await engineApi.requestMicrophonePermission();
      }
      if (kind === "input") {
        await engineApi.requestInputMonitoringPermission();
      }
      const nextPermissions = await engineApi.getPermissions();
      setPermissions(nextPermissions);
      setNotice({ kind: "success", message: ui.notices.permissionsRefreshed });
    });
  }

  async function startCaptureInternal(): Promise<CaptureStatusResult> {
    if (captureSource === "window" && selectedWindowId === 0) {
      throw new Error(ui.notices.selectWindowFirst);
    }
    if (captureSource === "display") {
      return await engineApi.startDisplayCapture(micEnabled);
    }
    return await engineApi.startWindowCapture(selectedWindowId, micEnabled);
  }

  async function startCapture() {
    await runAction(async () => {
      const nextStatus = await startCaptureInternal();
      setStatus(nextStatus);
      setNotice({ kind: "success", message: ui.notices.captureStarted });
    });
  }

  async function stopCapture() {
    await runAction(async () => {
      setStatus(await engineApi.stopCapture());
      setIsTimelinePlaying(false);
      setNotice({ kind: "info", message: ui.notices.captureStopped });
    });
  }

  async function toggleRecording() {
    await runAction(async () => {
      if (!status?.isRunning) {
        const nextStatus = await startCaptureInternal();
        setStatus(nextStatus);
      }

      if (status?.isRecording) {
        await engineApi.stopRecording();
        const nextStatus = await engineApi.stopCapture();
        setStatus(nextStatus);
        setIsTimelinePlaying(false);
        setNotice({ kind: "success", message: ui.notices.recordingFinished });
      } else {
        const nextStatus = await engineApi.startRecording(trackInputEvents);
        setStatus(nextStatus);
        setTrimStartSeconds(0);
        setTrimEndSeconds(0);
        setPlayheadSeconds(0);

        if (trackInputEvents && inputMonitoringDenied) {
          setNotice({ kind: "info", message: ui.notices.inputTrackingDegraded });
        } else {
          setNotice({ kind: "success", message: ui.notices.recordingStarted });
        }
      }
    });
  }

  async function runExport() {
    await runAction(async () => {
      if (!recordingURL) {
        throw new Error(ui.notices.exportMissingRecording);
      }
      if (!selectedPreset) {
        throw new Error(ui.notices.exportMissingPreset);
      }

      const targetDirectory = await desktopApi.pickDirectory(project?.projectPath ?? undefined);
      if (!targetDirectory) {
        return;
      }

      const extension = selectedPreset.fileType;
      const safeFileName =
        exportFileName.trim().length > 0 ? exportFileName.trim() : "guerillaglass-export";
      const outputURL = `${targetDirectory.replace(/[\\/]$/, "")}/${safeFileName}.${extension}`;

      const trimEnd = trimEndSeconds > 0 ? trimEndSeconds : undefined;
      const trimStart = trimStartSeconds > 0 ? trimStartSeconds : undefined;

      const result = await engineApi.runExport({
        outputURL,
        presetId: selectedPreset.id,
        trimStartSeconds: trimStart,
        trimEndSeconds: trimEnd,
      });

      setNotice({ kind: "success", message: ui.notices.exportComplete(result.outputURL) });
    });
  }

  async function openProject() {
    await runAction(async () => {
      const pickedPath = await desktopApi.pickDirectory(project?.projectPath ?? undefined);
      if (!pickedPath) {
        return;
      }
      const nextProject = await engineApi.projectOpen(pickedPath);
      setProject(nextProject);
      setAutoZoom(nextProject.autoZoom);
      setStatus(await engineApi.captureStatus());
      setNotice({ kind: "success", message: ui.notices.projectOpened });
    });
  }

  async function saveProject(saveAs: boolean) {
    await runAction(async () => {
      let projectPath = project?.projectPath ?? undefined;
      if (saveAs || !projectPath) {
        projectPath =
          (await desktopApi.pickDirectory(project?.projectPath ?? undefined)) ?? undefined;
      }
      if (!projectPath) {
        return;
      }

      const nextProject = await engineApi.projectSave({
        projectPath,
        autoZoom,
      });
      setProject(nextProject);
      setNotice({
        kind: "success",
        message: ui.notices.projectSaved(nextProject.projectPath ?? ui.labels.notSaved),
      });
    });
  }

  const setTrimInFromPlayhead = useCallback(() => {
    setTrimStartSeconds((previous) => {
      const nextTrimStart = clamp(playheadSeconds, 0, timelineDuration);
      if (trimEndSeconds > 0 && nextTrimStart > trimEndSeconds) {
        setTrimEndSeconds(nextTrimStart);
      }
      return previous === nextTrimStart ? previous : nextTrimStart;
    });
  }, [playheadSeconds, timelineDuration, trimEndSeconds]);

  const setTrimOutFromPlayhead = useCallback(() => {
    const nextTrimEnd = clamp(playheadSeconds, 0, timelineDuration);
    setTrimEndSeconds(nextTrimEnd);
    setTrimStartSeconds((previous) => (previous > nextTrimEnd ? nextTrimEnd : previous));
  }, [playheadSeconds, timelineDuration]);

  const toggleTimelinePlayback = useCallback(() => {
    setIsTimelinePlaying((previous) => !previous);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      const hasCommandModifier = event.metaKey || event.ctrlKey;

      if (hasCommandModifier && key === "s") {
        event.preventDefault();
        if (event.shiftKey) {
          void saveProject(true);
        } else {
          void saveProject(false);
        }
        return;
      }

      if (hasCommandModifier && key === "e") {
        event.preventDefault();
        void runExport();
        return;
      }

      if (key === " ") {
        event.preventDefault();
        toggleTimelinePlayback();
        return;
      }

      if (key === "r") {
        event.preventDefault();
        void toggleRecording();
        return;
      }

      if (key === "i") {
        event.preventDefault();
        setTrimInFromPlayhead();
        return;
      }

      if (key === "o") {
        event.preventDefault();
        setTrimOutFromPlayhead();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    runExport,
    saveProject,
    setTrimInFromPlayhead,
    setTrimOutFromPlayhead,
    toggleRecording,
    toggleTimelinePlayback,
  ]);

  return (
    <div className="min-h-screen bg-background px-4 py-4 lg:px-6">
      <div className="mx-auto flex max-w-[1680px] flex-col gap-3">
        <header className="gg-panel border-border/80 p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-[0.68rem] tracking-[0.2em] text-muted-foreground uppercase">
                {ui.app.shellState}
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">{ui.app.title}</h1>
              <p className="text-sm text-muted-foreground">{ui.app.subtitle}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={permissionBadgeVariant(permissions)}>
                {permissions?.screenRecordingGranted
                  ? ui.labels.permissionReady
                  : ui.labels.permissionRequired}
              </Badge>
              <Badge variant="secondary">{`${ui.labels.status}: ${captureStatusLabel}`}</Badge>
              {inputMonitoringDenied && trackInputEvents ? (
                <Badge variant="destructive">{ui.helper.degradedModeTitle}</Badge>
              ) : null}
              <Button onClick={() => void refreshAll()} disabled={isRefreshing || isRunningAction}>
                <RefreshCcw className="mr-2 h-4 w-4" /> {ui.actions.refresh}
              </Button>
              <Button onClick={() => void toggleRecording()} disabled={isRunningAction}>
                <Video className="mr-2 h-4 w-4" />
                {status?.isRecording ? ui.actions.stopRecording : ui.actions.startRecording}
              </Button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
              <Keyboard className="h-3.5 w-3.5" /> {ui.shortcuts.title}
            </span>
            <span className="gg-keycap">{ui.shortcuts.playPause}</span>
            <span className="gg-keycap">{ui.shortcuts.record}</span>
            <span className="gg-keycap">{ui.shortcuts.trimIn}</span>
            <span className="gg-keycap">{ui.shortcuts.trimOut}</span>
            <span className="gg-keycap">{ui.shortcuts.save}</span>
            <span className="gg-keycap">{ui.shortcuts.saveAs}</span>
            <span className="gg-keycap">{ui.shortcuts.export}</span>
          </div>
        </header>

        {notice ? (
          <Card className={notice.kind === "error" ? "border-destructive/60" : "border-border/70"}>
            <CardContent className="pt-5 text-sm">{notice.message}</CardContent>
          </Card>
        ) : null}

        <section className="grid gap-3 xl:grid-cols-[280px_minmax(0,1fr)_330px]">
          <aside className="space-y-3">
            <Card className="gg-panel">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="h-4 w-4" /> {ui.sections.leftRail}
                </CardTitle>
                <CardDescription>{ui.labels.inputMonitoring}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1 text-sm">
                  <div>{`Screen: ${permissions?.screenRecordingGranted ? ui.values.granted : ui.values.notGranted}`}</div>
                  <div>{`Mic: ${permissions?.microphoneGranted ? ui.values.granted : ui.values.notGranted}`}</div>
                  <div>{`${ui.labels.inputMonitoring}: ${permissions?.inputMonitoring ?? ui.values.unknown}`}</div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void handlePermissionRequest("screen")}
                  >
                    {ui.actions.requestScreen}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void handlePermissionRequest("mic")}
                  >
                    {ui.actions.requestMic}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void handlePermissionRequest("input")}
                  >
                    {ui.actions.requestInput}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void engineApi.openInputMonitoringSettings()}
                  >
                    {ui.actions.openSettings}
                  </Button>
                </div>

                <div className="space-y-2 border-t border-border/70 pt-3 text-sm">
                  <div className="font-medium">{ui.labels.captureSource}</div>
                  <div className="flex gap-3">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        checked={captureSource === "display"}
                        onChange={() => setCaptureSource("display")}
                      />
                      {ui.labels.display}
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        checked={captureSource === "window"}
                        onChange={() => setCaptureSource("window")}
                      />
                      {ui.labels.window}
                    </label>
                  </div>

                  {captureSource === "window" ? (
                    <select
                      className="gg-input"
                      value={selectedWindowId}
                      onChange={(event) => setSelectedWindowId(Number(event.target.value))}
                    >
                      {windowChoices.length === 0 ? (
                        <option value={0}>{ui.labels.noWindows}</option>
                      ) : null}
                      {windowChoices.map((windowItem) => (
                        <option key={windowItem.id} value={windowItem.id}>
                          {windowItem.appName} - {windowItem.title || ui.values.untitled}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => void startCapture()}
                    disabled={isRunningAction || status?.isRunning}
                  >
                    {ui.actions.startPreview}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void stopCapture()}
                    disabled={isRunningAction || !status?.isRunning}
                  >
                    {ui.actions.stopPreview}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="gg-panel">
              <CardHeader>
                <CardTitle className="text-base">{ui.labels.sourceWindowList}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-56 overflow-auto rounded-md border border-border/70">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-secondary/70 text-muted-foreground">
                      <tr>
                        <th className="px-2 py-2 font-medium">{ui.labels.sourceWindowApp}</th>
                        <th className="px-2 py-2 font-medium">{ui.labels.sourceWindowTitle}</th>
                        <th className="px-2 py-2 font-medium">{ui.labels.sourceWindowSize}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {windowChoices.slice(0, 8).map((windowItem) => (
                        <tr key={windowItem.id} className="border-t border-border/70">
                          <td className="px-2 py-1.5">{windowItem.appName}</td>
                          <td className="px-2 py-1.5">{windowItem.title || ui.values.untitled}</td>
                          <td className="px-2 py-1.5 text-muted-foreground">
                            {Math.round(windowItem.width)} x {Math.round(windowItem.height)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </aside>

          <section className="space-y-3">
            <Card className="gg-panel">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ScreenShare className="h-4 w-4" /> {ui.sections.center}
                </CardTitle>
                <CardDescription>
                  {status?.isRunning ? ui.helper.activePreviewBody : ui.helper.emptyPreviewBody}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {inputMonitoringDenied && trackInputEvents ? (
                  <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                    <p className="font-medium">{ui.helper.degradedModeTitle}</p>
                    <p className="mt-1 text-destructive/90">{ui.helper.degradedModeBody}</p>
                  </div>
                ) : null}

                <div className="gg-preview-stage">
                  {status?.isRunning ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">{ui.helper.activePreviewTitle}</p>
                      <p className="text-xs text-muted-foreground">{ui.helper.activePreviewBody}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">{ui.helper.emptyPreviewTitle}</p>
                      <p className="text-xs text-muted-foreground">{ui.helper.emptyPreviewBody}</p>
                    </div>
                  )}
                </div>

                <div className="grid gap-2 text-sm md:grid-cols-3">
                  <div>{`${ui.labels.status}: ${captureStatusLabel}`}</div>
                  <div>{`${ui.labels.duration}: ${formatDuration(status?.recordingDurationSeconds ?? 0)}`}</div>
                  <div className="truncate">{`${ui.labels.recordingURL}: ${recordingURL ?? "-"}`}</div>
                </div>
              </CardContent>
            </Card>
          </section>

          <aside>
            <Card className="gg-panel">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <MonitorCog className="h-4 w-4" /> {ui.sections.inspector}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-5 gap-1 rounded-md bg-secondary/50 p-1">
                  {(Object.entries(ui.inspectorTabs) as [InspectorTab, string][]).map(
                    ([tab, label]) => (
                      <button
                        key={tab}
                        type="button"
                        className={`rounded px-2 py-1 text-xs transition ${
                          activeInspectorTab === tab
                            ? "bg-background text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                        onClick={() => setActiveInspectorTab(tab)}
                      >
                        {label}
                      </button>
                    ),
                  )}
                </div>

                {activeInspectorTab === "capture" ? (
                  <div className="space-y-3 text-sm">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={micEnabled}
                        onChange={(event) => setMicEnabled(event.target.checked)}
                      />
                      <Mic className="h-4 w-4" /> {ui.labels.includeMic}
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={trackInputEvents}
                        onChange={(event) => setTrackInputEvents(event.target.checked)}
                      />
                      <MousePointer className="h-4 w-4" /> {ui.labels.trackInput}
                    </label>
                  </div>
                ) : null}

                {activeInspectorTab === "effects" ? (
                  <div className="space-y-3 text-sm">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={autoZoom.isEnabled}
                        onChange={(event) =>
                          setAutoZoom((previous) => ({
                            ...previous,
                            isEnabled: event.target.checked,
                          }))
                        }
                      />
                      <Sparkles className="h-4 w-4" /> {ui.labels.autoZoomEnabled}
                    </label>
                    <label className="grid gap-1">
                      {ui.labels.autoZoomIntensity(Math.round(autoZoom.intensity * 100))}
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={autoZoom.intensity}
                        onChange={(event) =>
                          setAutoZoom((previous) => ({
                            ...previous,
                            intensity: Number(event.target.value),
                          }))
                        }
                      />
                    </label>
                    <label className="grid gap-1">
                      {ui.labels.minimumKeyframeInterval}
                      <input
                        className="gg-input"
                        type="number"
                        min={0.01}
                        step={0.01}
                        value={autoZoom.minimumKeyframeInterval}
                        onChange={(event) =>
                          setAutoZoom((previous) => ({
                            ...previous,
                            minimumKeyframeInterval: Math.max(
                              0.01,
                              Number(event.target.value) || 0.01,
                            ),
                          }))
                        }
                      />
                    </label>

                    <div className="rounded-md border border-border/70 bg-background/70 p-3">
                      <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                        {ui.labels.phaseTwoLabel}
                      </p>
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={backgroundFramingEnabled}
                          onChange={(event) => setBackgroundFramingEnabled(event.target.checked)}
                        />
                        {ui.labels.backgroundFraming}
                      </label>
                      <label className="mt-2 grid gap-1">
                        {ui.labels.backgroundPadding}
                        <input
                          type="range"
                          min={0}
                          max={64}
                          step={1}
                          value={backgroundPadding}
                          onChange={(event) => setBackgroundPadding(Number(event.target.value))}
                        />
                      </label>
                      <label className="mt-2 grid gap-1">
                        {ui.labels.cornerRoundness}
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={cornerRoundness}
                          onChange={(event) => setCornerRoundness(Number(event.target.value))}
                        />
                      </label>
                      <label className="mt-2 grid gap-1">
                        {ui.labels.shadowStrength}
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={shadowStrength}
                          onChange={(event) => setShadowStrength(Number(event.target.value))}
                        />
                      </label>
                    </div>

                    <div className="rounded-md border border-border/70 bg-background/70 p-3">
                      <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                        {ui.labels.phaseThreeLabel}
                      </p>
                      <label className="grid gap-1">
                        {ui.labels.motionBlur}
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={motionBlurAmount}
                          onChange={(event) => setMotionBlurAmount(Number(event.target.value))}
                        />
                      </label>
                      <label className="mt-2 inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={simulatorAutoCrop}
                          onChange={(event) => setSimulatorAutoCrop(event.target.checked)}
                        />
                        {ui.labels.simulatorAutoCrop}
                      </label>
                      <label className="mt-2 inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={segmentOverridesEnabled}
                          onChange={(event) => setSegmentOverridesEnabled(event.target.checked)}
                        />
                        {ui.labels.segmentOverrides}
                      </label>
                    </div>
                  </div>
                ) : null}

                {activeInspectorTab === "export" ? (
                  <div className="space-y-3 text-sm">
                    <label className="grid gap-1">
                      {ui.labels.preset}
                      <select
                        className="gg-input"
                        value={selectedPresetId}
                        onChange={(event) => setSelectedPresetId(event.target.value)}
                      >
                        {presets.map((preset) => (
                          <option
                            key={preset.id}
                            value={preset.id}
                          >{`${preset.name} · ${formatAspectRatio(
                            preset.width,
                            preset.height,
                          )}`}</option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1">
                      {ui.labels.fileName}
                      <input
                        className="gg-input"
                        value={exportFileName}
                        onChange={(event) => setExportFileName(event.target.value)}
                      />
                    </label>
                    <label className="grid gap-1">
                      {ui.labels.trimInSeconds}
                      <input
                        className="gg-input"
                        type="number"
                        min={0}
                        value={trimStartSeconds}
                        onChange={(event) =>
                          setTrimStartSeconds(
                            clamp(Number(event.target.value) || 0, 0, timelineDuration),
                          )
                        }
                      />
                    </label>
                    <label className="grid gap-1">
                      {ui.labels.trimOutSeconds}
                      <input
                        className="gg-input"
                        type="number"
                        min={0}
                        value={trimEndSeconds}
                        onChange={(event) =>
                          setTrimEndSeconds(
                            clamp(Number(event.target.value) || 0, 0, timelineDuration),
                          )
                        }
                      />
                    </label>
                    <Button
                      onClick={() => void runExport()}
                      disabled={isRunningAction || !recordingURL}
                    >
                      <HardDriveDownload className="mr-2 h-4 w-4" /> {ui.actions.exportNow}
                    </Button>
                  </div>
                ) : null}

                {activeInspectorTab === "project" ? (
                  <div className="space-y-3 text-sm">
                    <div className="truncate">{`${ui.labels.projectPath}: ${project?.projectPath ?? ui.labels.notSaved}`}</div>
                    <div className="truncate">{`${ui.labels.eventsURL}: ${project?.eventsURL ?? status?.eventsURL ?? "-"}`}</div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void openProject()}
                        disabled={isRunningAction}
                      >
                        <FolderOpen className="mr-2 h-4 w-4" /> {ui.actions.openProject}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void saveProject(false)}
                        disabled={isRunningAction || !recordingURL}
                      >
                        <Save className="mr-2 h-4 w-4" /> {ui.actions.saveProject}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void saveProject(true)}
                        disabled={isRunningAction || !recordingURL}
                      >
                        {ui.actions.saveProjectAs}
                      </Button>
                    </div>
                  </div>
                ) : null}

                {activeInspectorTab === "advanced" ? (
                  <div className="space-y-3 text-sm">
                    <p className="rounded-md border border-border/70 bg-background/70 p-3 text-muted-foreground">
                      {ui.helper.phaseScaffoldBody}
                    </p>
                    <div>{`${ui.labels.backgroundPadding}: ${backgroundPadding}`}</div>
                    <div>{`${ui.labels.cornerRoundness}: ${Math.round(cornerRoundness * 100)}%`}</div>
                    <div>{`${ui.labels.shadowStrength}: ${Math.round(shadowStrength * 100)}%`}</div>
                    <div>{`${ui.labels.motionBlur}: ${Math.round(motionBlurAmount * 100)}%`}</div>
                    <div>{`${ui.labels.simulatorAutoCrop}: ${simulatorAutoCrop ? ui.values.on : ui.values.off}`}</div>
                    <div>{`${ui.labels.segmentOverrides}: ${segmentOverridesEnabled ? ui.values.on : ui.values.off}`}</div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </aside>
        </section>

        <Card className="gg-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Scissors className="h-4 w-4" /> {ui.sections.timeline}
            </CardTitle>
            <CardDescription>{ui.helper.activePreviewBody}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" onClick={toggleTimelinePlayback}>
                {isTimelinePlaying ? (
                  <Pause className="mr-2 h-4 w-4" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                {ui.actions.playPause}
              </Button>
              <Button size="sm" variant="outline" onClick={setTrimInFromPlayhead}>
                {ui.actions.setTrimIn}
              </Button>
              <Button size="sm" variant="outline" onClick={setTrimOutFromPlayhead}>
                {ui.actions.setTrimOut}
              </Button>
              <label className="ml-auto inline-flex items-center gap-2 text-sm">
                {ui.labels.playbackRate}
                <select
                  className="gg-input w-28"
                  value={playbackRate}
                  onChange={(event) =>
                    setPlaybackRate(Number(event.target.value) as (typeof playbackRates)[number])
                  }
                >
                  {playbackRates.map((rate) => (
                    <option key={rate} value={rate}>{`${rate.toFixed(1)}x`}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="space-y-2">
              <input
                type="range"
                min={0}
                max={timelineDuration}
                step={0.01}
                value={playheadSeconds}
                onChange={(event) => setPlayheadSeconds(Number(event.target.value))}
                className="w-full"
                aria-label={ui.labels.playhead}
              />

              <div className="grid grid-cols-3 text-xs text-muted-foreground">
                <span>{`${ui.labels.trimInSeconds}: ${trimStartSeconds.toFixed(2)}`}</span>
                <span className="text-center">{`${ui.labels.playhead}: ${playheadSeconds.toFixed(2)}`}</span>
                <span className="text-right">{`${ui.labels.trimOutSeconds}: ${trimEndSeconds.toFixed(2)}`}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
