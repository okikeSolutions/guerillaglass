import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FolderOpen,
  HardDriveDownload,
  Mic,
  MousePointer,
  RefreshCcw,
  Save,
  ScreenShare,
  ShieldCheck,
  Video,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
type Notice = { kind: "error" | "success" | "info"; message: string } | null;

const defaultAutoZoom: AutoZoomSettings = {
  isEnabled: true,
  intensity: 1,
  minimumKeyframeInterval: 1 / 30,
};

function formatDuration(seconds: number): string {
  const clamped = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(clamped / 60)
    .toString()
    .padStart(2, "0");
  const remainder = (clamped % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
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
  const [selectedPresetId, setSelectedPresetId] = useState<string>("h264-1080p-30");
  const [exportFileName, setExportFileName] = useState("guerillaglass-export");
  const [autoZoom, setAutoZoom] = useState<AutoZoomSettings>(defaultAutoZoom);

  const [isRefreshing, setIsRefreshing] = useState(true);
  const [isRunningAction, setIsRunningAction] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const recordingURL = status?.recordingURL ?? project?.recordingURL ?? null;

  const selectedPreset = useMemo(
    () => presets.find((preset) => preset.id === selectedPresetId) ?? presets[0],
    [presets, selectedPresetId],
  );

  const windowChoices = useMemo(() => sources?.windows ?? [], [sources?.windows]);

  useEffect(() => {
    if (captureSource === "window") {
      const match = windowChoices.find((window) => window.id === selectedWindowId);
      if (!match && windowChoices.length > 0) {
        setSelectedWindowId(windowChoices[0]!.id);
      }
      if (windowChoices.length === 0) {
        setSelectedWindowId(0);
      }
    }
  }, [captureSource, selectedWindowId, windowChoices]);

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
        message: `Connected to ${ping.platform} engine v${ping.engineVersion}.`,
      });
    } catch (error) {
      setNotice({
        kind: "error",
        message: error instanceof Error ? error.message : "Failed to refresh app state.",
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
        message: error instanceof Error ? error.message : "Action failed.",
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
      setNotice({ kind: "success", message: "Permissions refreshed." });
    });
  }

  async function startCaptureInternal(): Promise<CaptureStatusResult> {
    if (captureSource === "window" && selectedWindowId === 0) {
      throw new Error("Select a window before starting capture.");
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
      setNotice({ kind: "success", message: "Capture preview started." });
    });
  }

  async function stopCapture() {
    await runAction(async () => {
      setStatus(await engineApi.stopCapture());
      setNotice({ kind: "info", message: "Capture stopped." });
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
        setNotice({ kind: "success", message: "Recording finished." });
      } else {
        const nextStatus = await engineApi.startRecording(trackInputEvents);
        setStatus(nextStatus);
        setTrimStartSeconds(0);
        setTrimEndSeconds(Math.max(nextStatus.recordingDurationSeconds, trimEndSeconds));
        setNotice({ kind: "success", message: "Recording started." });
      }
    });
  }

  async function runExport() {
    await runAction(async () => {
      if (!recordingURL) {
        throw new Error("No recording available to export.");
      }
      if (!selectedPreset) {
        throw new Error("No export preset selected.");
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

      setNotice({ kind: "success", message: `Export complete: ${result.outputURL}` });
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
      setNotice({ kind: "success", message: "Project opened." });
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
      setNotice({ kind: "success", message: `Project saved to ${nextProject.projectPath}` });
    });
  }

  return (
    <div className="min-h-screen p-6 lg:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-2xl border border-white/10 bg-gradient-to-r from-cyan-500/15 via-teal-500/10 to-sky-500/15 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-cyan-300">
                Phase 1 parity migration
              </p>
              <h1 className="mt-2 text-3xl font-semibold">Guerillaglass Desktop Shell</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Capture source picker, permission UX, recording controls, export flow, and project
                bridge.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={permissionBadgeVariant(permissions)}>
                {permissions?.screenRecordingGranted
                  ? "Screen permission ready"
                  : "Screen permission required"}
              </Badge>
              <Button onClick={() => void refreshAll()} disabled={isRefreshing || isRunningAction}>
                <RefreshCcw className="mr-2 h-4 w-4" /> Refresh
              </Button>
            </div>
          </div>
        </header>

        {notice ? (
          <Card className={notice.kind === "error" ? "border-destructive/60" : "border-border/70"}>
            <CardContent className="pt-6 text-sm">{notice.message}</CardContent>
          </Card>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4" /> Permissions
              </CardTitle>
              <CardDescription>Request only what is needed for each feature.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 text-sm">
                <div>
                  Screen Recording:{" "}
                  {permissions?.screenRecordingGranted ? "granted" : "not granted"}
                </div>
                <div>Microphone: {permissions?.microphoneGranted ? "granted" : "not granted"}</div>
                <div>Input Monitoring: {permissions?.inputMonitoring ?? "unknown"}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void handlePermissionRequest("screen")}
                >
                  Request Screen
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void handlePermissionRequest("mic")}
                >
                  Request Mic
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void handlePermissionRequest("input")}
                >
                  Request Input
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void engineApi.openInputMonitoringSettings()}
                >
                  Open Settings
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ScreenShare className="h-4 w-4" /> Capture Source
              </CardTitle>
              <CardDescription>Choose display or window before preview/record.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-3 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    checked={captureSource === "display"}
                    onChange={() => setCaptureSource("display")}
                  />
                  Display
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    checked={captureSource === "window"}
                    onChange={() => setCaptureSource("window")}
                  />
                  Window
                </label>
              </div>

              {captureSource === "window" ? (
                <select
                  className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
                  value={selectedWindowId}
                  onChange={(event) => setSelectedWindowId(Number(event.target.value))}
                >
                  {windowChoices.length === 0 ? (
                    <option value={0}>No windows available</option>
                  ) : null}
                  {windowChoices.map((window) => (
                    <option key={window.id} value={window.id}>
                      {window.appName} - {window.title || "(untitled)"}
                    </option>
                  ))}
                </select>
              ) : null}

              <div className="grid gap-2 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={micEnabled}
                    onChange={(e) => setMicEnabled(e.target.checked)}
                  />
                  <Mic className="h-4 w-4" /> Include microphone
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={trackInputEvents}
                    onChange={(e) => setTrackInputEvents(e.target.checked)}
                  />
                  <MousePointer className="h-4 w-4" /> Track cursor + clicks
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => void startCapture()}
                  disabled={isRunningAction || status?.isRunning}
                >
                  Start Preview
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void stopCapture()}
                  disabled={isRunningAction || !status?.isRunning}
                >
                  Stop Preview
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Video className="h-4 w-4" /> Recording
              </CardTitle>
              <CardDescription>
                Drive native capture + recording through protocol commands.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm">
                <div>
                  Status:{" "}
                  {status?.isRecording ? "recording" : status?.isRunning ? "previewing" : "idle"}
                </div>
                <div>Duration: {formatDuration(status?.recordingDurationSeconds ?? 0)}</div>
                <div className="truncate">Recording URL: {recordingURL ?? "-"}</div>
              </div>
              <Button onClick={() => void toggleRecording()} disabled={isRunningAction}>
                {status?.isRecording ? "Stop Recording" : "Start Recording"}
              </Button>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <HardDriveDownload className="h-4 w-4" /> Export
              </CardTitle>
              <CardDescription>
                Export current recording through the native export pipeline.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 text-sm">
                <label className="grid gap-1">
                  Preset
                  <select
                    className="rounded-md border border-input bg-background px-2 py-2"
                    value={selectedPresetId}
                    onChange={(event) => setSelectedPresetId(event.target.value)}
                  >
                    {presets.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1">
                  File name
                  <input
                    className="rounded-md border border-input bg-background px-2 py-2"
                    value={exportFileName}
                    onChange={(event) => setExportFileName(event.target.value)}
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="grid gap-1">
                    Trim in (s)
                    <input
                      type="number"
                      min={0}
                      className="rounded-md border border-input bg-background px-2 py-2"
                      value={trimStartSeconds}
                      onChange={(event) => setTrimStartSeconds(Number(event.target.value) || 0)}
                    />
                  </label>
                  <label className="grid gap-1">
                    Trim out (s)
                    <input
                      type="number"
                      min={0}
                      className="rounded-md border border-input bg-background px-2 py-2"
                      value={trimEndSeconds}
                      onChange={(event) => setTrimEndSeconds(Number(event.target.value) || 0)}
                    />
                  </label>
                </div>
              </div>
              <Button onClick={() => void runExport()} disabled={isRunningAction || !recordingURL}>
                Export Recording
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FolderOpen className="h-4 w-4" /> Project Bridge
              </CardTitle>
              <CardDescription>
                Open/save `.gglassproj` directories via protocol-backed bridge.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm">
                <div className="truncate">
                  Project path: {project?.projectPath ?? "(not saved)"}
                </div>
                <div className="truncate">
                  Events URL: {project?.eventsURL ?? status?.eventsURL ?? "-"}
                </div>
              </div>

              <div className="grid gap-2 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={autoZoom.isEnabled}
                    onChange={(event) =>
                      setAutoZoom((prev) => ({ ...prev, isEnabled: event.target.checked }))
                    }
                  />
                  Auto-zoom enabled
                </label>
                <label className="grid gap-1">
                  Auto-zoom intensity ({Math.round(autoZoom.intensity * 100)}%)
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={autoZoom.intensity}
                    onChange={(event) =>
                      setAutoZoom((prev) => ({ ...prev, intensity: Number(event.target.value) }))
                    }
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={() => void openProject()}
                  disabled={isRunningAction}
                >
                  Open Project
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void saveProject(false)}
                  disabled={isRunningAction || !recordingURL}
                >
                  <Save className="mr-2 h-4 w-4" /> Save Project
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void saveProject(true)}
                  disabled={isRunningAction || !recordingURL}
                >
                  Save Project As
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Detected Windows</CardTitle>
            <CardDescription>
              Live window list from ScreenCaptureKit through the native engine.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-left text-sm">
                <thead className="bg-secondary/60 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">App</th>
                    <th className="px-3 py-2 font-medium">Title</th>
                    <th className="px-3 py-2 font-medium">Size</th>
                  </tr>
                </thead>
                <tbody>
                  {windowChoices.slice(0, 10).map((window) => (
                    <tr key={window.id} className="border-t border-border/70">
                      <td className="px-3 py-2">{window.appName}</td>
                      <td className="px-3 py-2">{window.title || "(untitled)"}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {Math.round(window.width)} x {Math.round(window.height)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
