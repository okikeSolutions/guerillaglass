import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AutoZoomSettings,
  CaptureStatusResult,
  ExportPreset,
  InputEvent,
  PermissionsResult,
  PingResult,
  ProjectState,
  SourcesResult,
} from "@guerillaglass/engine-protocol";
import { enUS } from "@/i18n/en";
import { desktopApi, engineApi, parseInputEventLog } from "@/lib/engine";
import type { HostMenuCommand } from "../../../shared/bridgeRpc";
import { buildTimelineLanes } from "./timelineModel";

const hostMenuCommandEventName = "gg-host-menu-command";
const playbackRates = [0.5, 1, 1.5, 2] as const;

export type CaptureSourceMode = "display" | "window";
export type Notice = { kind: "error" | "success" | "info"; message: string } | null;

export const defaultAutoZoom: AutoZoomSettings = {
  isEnabled: true,
  intensity: 1,
  minimumKeyframeInterval: 1 / 30,
};

const studioQueryKeys = {
  ping: () => ["studio", "ping"] as const,
  permissions: () => ["studio", "permissions"] as const,
  sources: () => ["studio", "sources"] as const,
  captureStatus: () => ["studio", "captureStatus"] as const,
  exportInfo: () => ["studio", "exportInfo"] as const,
  projectCurrent: () => ["studio", "projectCurrent"] as const,
  eventsLog: (eventsURL: string | null) => ["studio", "eventsLog", eventsURL] as const,
};

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return enUS.notices.actionFailed;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

export function formatDuration(seconds: number): string {
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

export function formatAspectRatio(width: number, height: number): string {
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

export function permissionBadgeVariant(
  permissions: PermissionsResult | undefined,
): "default" | "secondary" | "destructive" {
  if (!permissions) {
    return "secondary";
  }
  if (!permissions.screenRecordingGranted) {
    return "destructive";
  }
  return "default";
}

export function useStudioController() {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<Notice>(null);
  const [playheadSeconds, setPlayheadSeconds] = useState(0);
  const [isTimelinePlaying, setIsTimelinePlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<(typeof playbackRates)[number]>(1);

  const settingsForm = useForm({
    defaultValues: {
      captureSource: "display" as CaptureSourceMode,
      selectedWindowId: 0,
      micEnabled: false,
      trackInputEvents: true,
      autoZoom: defaultAutoZoom,
    },
  });

  const exportForm = useForm({
    defaultValues: {
      presetId: "",
      fileName: "guerillaglass-export",
      trimStartSeconds: 0,
      trimEndSeconds: 0,
    },
  });

  const pingQuery = useQuery<PingResult>({
    queryKey: studioQueryKeys.ping(),
    queryFn: () => engineApi.ping(),
    staleTime: 30_000,
  });

  const permissionsQuery = useQuery<PermissionsResult>({
    queryKey: studioQueryKeys.permissions(),
    queryFn: () => engineApi.getPermissions(),
    staleTime: 30_000,
  });

  const sourcesQuery = useQuery<SourcesResult>({
    queryKey: studioQueryKeys.sources(),
    queryFn: () => engineApi.listSources(),
    staleTime: 5_000,
  });

  const captureStatusQuery = useQuery<CaptureStatusResult>({
    queryKey: studioQueryKeys.captureStatus(),
    queryFn: () => engineApi.captureStatus(),
    refetchInterval: 1_000,
  });

  const exportInfoQuery = useQuery({
    queryKey: studioQueryKeys.exportInfo(),
    queryFn: () => engineApi.exportInfo(),
    staleTime: 60_000,
  });

  const projectQuery = useQuery<ProjectState>({
    queryKey: studioQueryKeys.projectCurrent(),
    queryFn: () => engineApi.projectCurrent(),
    staleTime: 10_000,
  });

  const isHydratingFromProjectRef = useRef(false);
  const autoZoomSyncSignatureRef = useRef("");

  useEffect(() => {
    const projectAutoZoom = projectQuery.data?.autoZoom;
    if (!projectAutoZoom) {
      return;
    }
    const nextSignature = JSON.stringify(projectAutoZoom);
    if (nextSignature === autoZoomSyncSignatureRef.current) {
      return;
    }
    autoZoomSyncSignatureRef.current = nextSignature;
    isHydratingFromProjectRef.current = true;
    settingsForm.setFieldValue("autoZoom", projectAutoZoom);
    isHydratingFromProjectRef.current = false;
  }, [projectQuery.data?.autoZoom, settingsForm]);

  const presets = exportInfoQuery.data?.presets ?? [];

  useEffect(() => {
    const currentPresetId = exportForm.state.values.presetId;
    if (presets.length === 0) {
      if (currentPresetId !== "") {
        exportForm.setFieldValue("presetId", "");
      }
      return;
    }
    if (!presets.some((preset) => preset.id === currentPresetId)) {
      exportForm.setFieldValue("presetId", presets[0]!.id);
    }
  }, [exportForm, exportForm.state.values.presetId, presets]);

  const windowChoices = sourcesQuery.data?.windows ?? [];

  useEffect(() => {
    const { captureSource, selectedWindowId } = settingsForm.state.values;
    if (captureSource !== "window") {
      return;
    }
    const selectedExists = windowChoices.some((windowItem) => windowItem.id === selectedWindowId);
    if (selectedExists) {
      return;
    }
    settingsForm.setFieldValue("selectedWindowId", windowChoices[0]?.id ?? 0);
  }, [settingsForm, settingsForm.state.values, windowChoices]);

  const recordingURL =
    captureStatusQuery.data?.recordingURL ?? projectQuery.data?.recordingURL ?? null;
  const eventsURL = captureStatusQuery.data?.eventsURL ?? projectQuery.data?.eventsURL ?? null;

  const eventsQuery = useQuery<InputEvent[]>({
    queryKey: studioQueryKeys.eventsLog(eventsURL),
    enabled:
      Boolean(eventsURL) &&
      !eventsURL?.startsWith("stub://") &&
      !eventsURL?.startsWith("native://"),
    queryFn: async () => {
      if (!eventsURL) {
        return [];
      }
      const raw = await desktopApi.readTextFile(eventsURL);
      return parseInputEventLog(raw);
    },
    staleTime: 10_000,
    retry: false,
  });

  const timelineDuration = useMemo(
    () =>
      Math.max(
        captureStatusQuery.data?.recordingDurationSeconds ?? 0,
        exportForm.state.values.trimStartSeconds,
        exportForm.state.values.trimEndSeconds,
        playheadSeconds,
        1,
      ),
    [
      captureStatusQuery.data?.recordingDurationSeconds,
      exportForm.state.values.trimEndSeconds,
      exportForm.state.values.trimStartSeconds,
      playheadSeconds,
    ],
  );

  useEffect(() => {
    setPlayheadSeconds((current) => clamp(current, 0, timelineDuration));
  }, [timelineDuration]);

  const timelineEvents = useMemo(
    () => (eventsQuery.isSuccess ? eventsQuery.data : []),
    [eventsQuery.data, eventsQuery.isSuccess],
  );

  const laneRecordingDurationSeconds = useMemo(() => {
    if (!recordingURL) {
      return 0;
    }
    return Math.max(captureStatusQuery.data?.recordingDurationSeconds ?? 0, timelineDuration);
  }, [captureStatusQuery.data?.recordingDurationSeconds, recordingURL, timelineDuration]);

  const timelineLanes = useMemo(
    () =>
      buildTimelineLanes({
        recordingDurationSeconds: laneRecordingDurationSeconds,
        events: timelineEvents,
      }),
    [laneRecordingDurationSeconds, timelineEvents],
  );

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

  const selectedPreset = useMemo<ExportPreset | undefined>(() => {
    const selected = presets.find((preset) => preset.id === exportForm.state.values.presetId);
    return selected ?? presets[0];
  }, [exportForm.state.values.presetId, presets]);

  const inputMonitoringDenied = permissionsQuery.data?.inputMonitoring === "denied";

  const startCaptureInternal = useCallback(async (): Promise<CaptureStatusResult> => {
    const { captureSource, selectedWindowId, micEnabled } = settingsForm.state.values;

    if (captureSource === "window") {
      if (selectedWindowId === 0) {
        throw new Error(enUS.notices.selectWindowFirst);
      }
      return await engineApi.startWindowCapture(selectedWindowId, micEnabled);
    }

    return await engineApi.startDisplayCapture(micEnabled);
  }, [settingsForm.state.values]);

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const [ping, permissions, sources, captureStatus, exportInfo, project] = await Promise.all([
        pingQuery.refetch(),
        permissionsQuery.refetch(),
        sourcesQuery.refetch(),
        captureStatusQuery.refetch(),
        exportInfoQuery.refetch(),
        projectQuery.refetch(),
        eventsQuery.refetch(),
      ]);

      return {
        ping: ping.data,
        permissions: permissions.data,
        sources: sources.data,
        captureStatus: captureStatus.data,
        exportInfo: exportInfo.data,
        project: project.data,
      };
    },
    onError: (error) => {
      setNotice({
        kind: "error",
        message: error instanceof Error ? error.message : enUS.notices.refreshFailed,
      });
    },
  });

  const requestPermissionMutation = useMutation({
    mutationFn: async (kind: "screen" | "mic" | "input") => {
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
      queryClient.setQueryData(studioQueryKeys.permissions(), nextPermissions);
      return nextPermissions;
    },
    onSuccess: () => {
      setNotice({ kind: "success", message: enUS.notices.permissionsRefreshed });
    },
    onError: (error) => {
      setNotice({ kind: "error", message: formatError(error) });
    },
  });

  const startPreviewMutation = useMutation({
    mutationFn: async () => await startCaptureInternal(),
    onSuccess: (nextStatus) => {
      queryClient.setQueryData(studioQueryKeys.captureStatus(), nextStatus);
      setNotice({ kind: "success", message: enUS.notices.captureStarted });
    },
    onError: (error) => {
      setNotice({ kind: "error", message: formatError(error) });
    },
  });

  const stopPreviewMutation = useMutation({
    mutationFn: async () => await engineApi.stopCapture(),
    onSuccess: (nextStatus) => {
      queryClient.setQueryData(studioQueryKeys.captureStatus(), nextStatus);
      setIsTimelinePlaying(false);
      setNotice({ kind: "info", message: enUS.notices.captureStopped });
    },
    onError: (error) => {
      setNotice({ kind: "error", message: formatError(error) });
    },
  });

  const toggleRecordingMutation = useMutation({
    mutationFn: async () => {
      let status = captureStatusQuery.data;
      if (!status?.isRunning) {
        status = await startCaptureInternal();
      }

      if (status?.isRecording) {
        await engineApi.stopRecording();
        const stoppedStatus = await engineApi.stopCapture();
        return {
          nextStatus: stoppedStatus,
          finished: true,
        };
      }

      const recordingStatus = await engineApi.startRecording(
        settingsForm.state.values.trackInputEvents,
      );
      return {
        nextStatus: recordingStatus,
        finished: false,
      };
    },
    onSuccess: ({ nextStatus, finished }) => {
      queryClient.setQueryData(studioQueryKeys.captureStatus(), nextStatus);

      if (finished) {
        setIsTimelinePlaying(false);
        setNotice({ kind: "success", message: enUS.notices.recordingFinished });
        return;
      }

      exportForm.setFieldValue("trimStartSeconds", 0);
      exportForm.setFieldValue("trimEndSeconds", 0);
      setPlayheadSeconds(0);

      if (settingsForm.state.values.trackInputEvents && inputMonitoringDenied) {
        setNotice({ kind: "info", message: enUS.notices.inputTrackingDegraded });
      } else {
        setNotice({ kind: "success", message: enUS.notices.recordingStarted });
      }
    },
    onError: (error) => {
      setNotice({ kind: "error", message: formatError(error) });
    },
  });

  const openProjectMutation = useMutation({
    mutationFn: async () => {
      const pickedPath = await desktopApi.pickDirectory(
        projectQuery.data?.projectPath ?? undefined,
      );
      if (!pickedPath) {
        return null;
      }
      const nextProject = await engineApi.projectOpen(pickedPath);
      const nextStatus = await engineApi.captureStatus();
      return { nextProject, nextStatus };
    },
    onSuccess: (data) => {
      if (!data) {
        return;
      }
      queryClient.setQueryData(studioQueryKeys.projectCurrent(), data.nextProject);
      queryClient.setQueryData(studioQueryKeys.captureStatus(), data.nextStatus);
      setNotice({ kind: "success", message: enUS.notices.projectOpened });
    },
    onError: (error) => {
      setNotice({ kind: "error", message: formatError(error) });
    },
  });

  const saveProjectMutation = useMutation({
    mutationFn: async (saveAs: boolean) => {
      let projectPath = projectQuery.data?.projectPath ?? undefined;
      if (saveAs || !projectPath) {
        projectPath =
          (await desktopApi.pickDirectory(projectQuery.data?.projectPath ?? undefined)) ??
          undefined;
      }
      if (!projectPath) {
        return null;
      }
      const nextProject = await engineApi.projectSave({
        projectPath,
        autoZoom: settingsForm.state.values.autoZoom,
      });
      return nextProject;
    },
    onSuccess: (nextProject) => {
      if (!nextProject) {
        return;
      }
      queryClient.setQueryData(studioQueryKeys.projectCurrent(), nextProject);
      setNotice({
        kind: "success",
        message: enUS.notices.projectSaved(nextProject.projectPath ?? enUS.labels.notSaved),
      });
    },
    onError: (error) => {
      setNotice({ kind: "error", message: formatError(error) });
    },
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      if (!recordingURL) {
        throw new Error(enUS.notices.exportMissingRecording);
      }
      if (!selectedPreset) {
        throw new Error(enUS.notices.exportMissingPreset);
      }

      const targetDirectory = await desktopApi.pickDirectory(
        projectQuery.data?.projectPath ?? undefined,
      );
      if (!targetDirectory) {
        return null;
      }

      const extension = selectedPreset.fileType;
      const safeFileName =
        exportForm.state.values.fileName.trim().length > 0
          ? exportForm.state.values.fileName.trim()
          : "guerillaglass-export";

      const outputURL = `${targetDirectory.replace(/[\\/]$/, "")}/${safeFileName}.${extension}`;
      const trimStart =
        exportForm.state.values.trimStartSeconds > 0
          ? exportForm.state.values.trimStartSeconds
          : undefined;
      const trimEnd =
        exportForm.state.values.trimEndSeconds > 0
          ? exportForm.state.values.trimEndSeconds
          : undefined;

      return await engineApi.runExport({
        outputURL,
        presetId: selectedPreset.id,
        trimStartSeconds: trimStart,
        trimEndSeconds: trimEnd,
      });
    },
    onSuccess: (result) => {
      if (!result) {
        return;
      }
      setNotice({ kind: "success", message: enUS.notices.exportComplete(result.outputURL) });
    },
    onError: (error) => {
      setNotice({ kind: "error", message: formatError(error) });
    },
  });

  const busyMutations = [
    refreshMutation,
    requestPermissionMutation,
    startPreviewMutation,
    stopPreviewMutation,
    toggleRecordingMutation,
    openProjectMutation,
    saveProjectMutation,
    exportMutation,
  ];

  const isRunningAction = busyMutations.some((mutation) => mutation.isPending);
  const isRefreshing = refreshMutation.isPending || pingQuery.isPending;

  const setPlayheadSecondsClamped = useCallback(
    (seconds: number) => {
      setPlayheadSeconds(clamp(seconds, 0, timelineDuration));
    },
    [timelineDuration],
  );

  const setTrimStartSeconds = useCallback(
    (seconds: number) => {
      const nextTrimStart = clamp(seconds, 0, timelineDuration);
      exportForm.setFieldValue("trimStartSeconds", nextTrimStart);

      const trimEndSeconds = exportForm.state.values.trimEndSeconds;
      if (trimEndSeconds > 0 && nextTrimStart > trimEndSeconds) {
        exportForm.setFieldValue("trimEndSeconds", nextTrimStart);
      }
    },
    [exportForm, exportForm.state.values.trimEndSeconds, timelineDuration],
  );

  const setTrimEndSeconds = useCallback(
    (seconds: number) => {
      const nextTrimEnd = clamp(seconds, 0, timelineDuration);
      exportForm.setFieldValue("trimEndSeconds", nextTrimEnd);

      const trimStartSeconds = exportForm.state.values.trimStartSeconds;
      if (trimStartSeconds > nextTrimEnd) {
        exportForm.setFieldValue("trimStartSeconds", nextTrimEnd);
      }
    },
    [exportForm, exportForm.state.values.trimStartSeconds, timelineDuration],
  );

  const setTrimInFromPlayhead = useCallback(() => {
    setTrimStartSeconds(playheadSeconds);
  }, [playheadSeconds, setTrimStartSeconds]);

  const setTrimOutFromPlayhead = useCallback(() => {
    setTrimEndSeconds(playheadSeconds);
  }, [playheadSeconds, setTrimEndSeconds]);

  const nudgePlayheadSeconds = useCallback(
    (deltaSeconds: number) => {
      setPlayheadSeconds((current) => clamp(current + deltaSeconds, 0, timelineDuration));
    },
    [timelineDuration],
  );

  const toggleTimelinePlayback = useCallback(() => {
    setIsTimelinePlaying((previous) => !previous);
  }, []);

  const refreshAll = useCallback(async () => {
    await refreshMutation.mutateAsync();
  }, [refreshMutation]);

  const runHostCommand = useCallback(
    (command: HostMenuCommand) => {
      switch (command) {
        case "app.refresh":
          void refreshMutation.mutateAsync();
          break;
        case "capture.toggleRecording":
          void toggleRecordingMutation.mutateAsync();
          break;
        case "capture.startPreview":
          void startPreviewMutation.mutateAsync();
          break;
        case "capture.stopPreview":
          void stopPreviewMutation.mutateAsync();
          break;
        case "timeline.playPause":
          toggleTimelinePlayback();
          break;
        case "timeline.trimIn":
          setTrimInFromPlayhead();
          break;
        case "timeline.trimOut":
          setTrimOutFromPlayhead();
          break;
        case "file.openProject":
          void openProjectMutation.mutateAsync();
          break;
        case "file.saveProject":
          void saveProjectMutation.mutateAsync(false);
          break;
        case "file.saveProjectAs":
          void saveProjectMutation.mutateAsync(true);
          break;
        case "file.export":
          void exportMutation.mutateAsync();
          break;
        default: {
          const _exhaustiveCheck: never = command;
          void _exhaustiveCheck;
          throw new Error("Unhandled host command");
        }
      }
    },
    [
      exportMutation,
      openProjectMutation,
      refreshMutation,
      saveProjectMutation,
      setTrimInFromPlayhead,
      setTrimOutFromPlayhead,
      startPreviewMutation,
      stopPreviewMutation,
      toggleRecordingMutation,
      toggleTimelinePlayback,
    ],
  );

  useEffect(() => {
    const menuStateSender = window.ggHostSendMenuState;
    if (!menuStateSender) {
      return;
    }

    menuStateSender({
      canSave: !isRunningAction && Boolean(recordingURL),
      canExport: !isRunningAction && Boolean(recordingURL),
      isRecording: Boolean(captureStatusQuery.data?.isRecording),
    });
  }, [captureStatusQuery.data?.isRecording, isRunningAction, recordingURL]);

  useEffect(() => {
    const onHostMenuCommand = (event: Event) => {
      const customEvent = event as CustomEvent<{ command: HostMenuCommand }>;
      const command = customEvent.detail?.command;
      if (!command) {
        return;
      }
      runHostCommand(command);
    };

    window.addEventListener(hostMenuCommandEventName, onHostMenuCommand as EventListener);
    return () =>
      window.removeEventListener(hostMenuCommandEventName, onHostMenuCommand as EventListener);
  }, [runHostCommand]);

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
          runHostCommand("file.saveProjectAs");
        } else {
          runHostCommand("file.saveProject");
        }
        return;
      }

      if (hasCommandModifier && key === "e") {
        event.preventDefault();
        runHostCommand("file.export");
        return;
      }

      if (key === " ") {
        event.preventDefault();
        runHostCommand("timeline.playPause");
        return;
      }

      if (key === "r") {
        event.preventDefault();
        runHostCommand("capture.toggleRecording");
        return;
      }

      if (key === "i") {
        event.preventDefault();
        runHostCommand("timeline.trimIn");
        return;
      }

      if (key === "o") {
        event.preventDefault();
        runHostCommand("timeline.trimOut");
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [runHostCommand]);

  useEffect(() => {
    if (pingQuery.isSuccess || pingQuery.isError) {
      return;
    }
    void refreshMutation.mutateAsync();
  }, [pingQuery.isError, pingQuery.isSuccess, refreshMutation]);

  const captureStatusLabel = captureStatusQuery.data?.isRecording
    ? enUS.labels.recording
    : captureStatusQuery.data?.isRunning
      ? enUS.labels.previewing
      : enUS.labels.idle;

  return {
    captureStatusLabel,
    captureStatusQuery,
    exportForm,
    exportMutation,
    exportPresets: presets,
    formatAspectRatio,
    formatDuration,
    inputMonitoringDenied,
    isRefreshing,
    isRunningAction,
    isTimelinePlaying,
    notice,
    nudgePlayheadSeconds,
    openProjectMutation,
    permissionBadgeVariant,
    permissionsQuery,
    pingQuery,
    playheadSeconds,
    playbackRate,
    playbackRates,
    projectQuery,
    recordingURL,
    refreshAll,
    refreshMutation,
    requestPermissionMutation,
    runHostCommand,
    saveProjectMutation,
    selectedPreset,
    setNotice,
    setPlayheadSeconds: setPlayheadSecondsClamped,
    setPlaybackRate,
    setTrimEndSeconds,
    setTrimInFromPlayhead,
    setTrimStartSeconds,
    setTrimOutFromPlayhead,
    settingsForm,
    sourcesQuery,
    startPreviewMutation,
    stopPreviewMutation,
    timelineDuration,
    timelineLanes,
    toggleRecordingMutation,
    toggleTimelinePlayback,
    ui: enUS,
    windowChoices,
  };
}

export type StudioController = ReturnType<typeof useStudioController>;
