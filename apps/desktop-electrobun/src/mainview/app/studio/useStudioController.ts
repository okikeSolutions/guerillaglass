import { useForm } from "@tanstack/react-form";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AutoZoomSettings,
  CaptureStatusResult,
  ExportPreset,
  InputEvent,
  PermissionsResult,
  PingResult,
  ProjectRecentsResult,
  ProjectState,
  SourcesResult,
} from "@guerillaglass/engine-protocol";
import { getStudioMessages, type StudioLocale } from "@guerillaglass/localization";
import { desktopApi, engineApi, parseInputEventLog } from "@/lib/engine";
import type { HostMenuCommand } from "../../../shared/bridgeRpc";
import {
  emptyInspectorSelection,
  type InspectorSelection,
  normalizeInspectorSelection,
  selectionFromPreset,
  type StudioMode,
} from "./inspectorContext";
import {
  defaultStudioLayoutState,
  loadStudioLayoutState,
  modeForStudioRoute,
  normalizeStudioLayoutRoute,
  saveStudioLayoutState,
  studioLayoutBounds,
} from "./studioLayoutState";
import { buildTimelineLanes } from "./timelineModel";

const hostMenuCommandEventName = "gg-host-menu-command";
const playbackRates = [0.5, 1, 1.5, 2] as const;
const emptyExportPresets: ExportPreset[] = [];
const emptySourceWindows: SourcesResult["windows"] = [];

export type CaptureSourceMode = "display" | "window";
export type Notice = { kind: "error" | "success" | "info"; message: string } | null;
const emptyProjectRecents: ProjectRecentsResult = { items: [] };

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
  projectRecents: (limit: number) => ["studio", "projectRecents", limit] as const,
  eventsLog: (eventsURL: string | null) => ["studio", "eventsLog", eventsURL] as const,
};

function formatError(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error) {
    return error.message;
  }
  return fallbackMessage;
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

const interactiveGlobalHotkeySelector = [
  "input",
  "textarea",
  "select",
  "button",
  "a[href]",
  "[contenteditable]:not([contenteditable='false'])",
  "[role='button']",
  "[role='link']",
  "[role='menuitem']",
  "[role='tab']",
  "[role='checkbox']",
  "[role='radio']",
  "[role='switch']",
].join(",");

function shouldBlockGlobalSingleKeyHotkey(target: EventTarget | null): boolean {
  if (target == null || typeof target !== "object") {
    return false;
  }
  const elementLike = target as { closest?: (selector: string) => Element | null };
  if (typeof elementLike.closest !== "function") {
    return false;
  }
  return elementLike.closest(interactiveGlobalHotkeySelector) != null;
}

export function useStudioController() {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<Notice>(null);
  const [playheadSeconds, setPlayheadSeconds] = useState(0);
  const [isTimelinePlaying, setIsTimelinePlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<(typeof playbackRates)[number]>(1);
  const [rawInspectorSelection, setRawInspectorSelection] =
    useState<InspectorSelection>(emptyInspectorSelection);
  const [layout, setLayout] = useState(() => loadStudioLayoutState());
  const activeMode = useMemo<StudioMode>(
    () => modeForStudioRoute(layout.lastRoute),
    [layout.lastRoute],
  );
  const locale = layout.locale;
  const ui = useMemo(() => getStudioMessages(locale), [locale]);
  const integerFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        maximumFractionDigits: 0,
      }),
    [locale],
  );
  const decimalFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [locale],
  );
  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [locale],
  );

  const formatInteger = useCallback(
    (value: number): string => integerFormatter.format(value),
    [integerFormatter],
  );
  const formatDecimal = useCallback(
    (value: number): string => decimalFormatter.format(value),
    [decimalFormatter],
  );
  const formatDateTime = useCallback(
    (value: string): string => {
      const parsed = new Date(value);
      if (Number.isNaN(parsed.valueOf())) {
        return value;
      }
      return dateTimeFormatter.format(parsed);
    },
    [dateTimeFormatter],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      saveStudioLayoutState(layout);
    }, 120);
    return () => clearTimeout(timer);
  }, [layout]);

  const settingsForm = useForm({
    defaultValues: {
      captureSource: "display" as CaptureSourceMode,
      selectedWindowId: 0,
      micEnabled: false,
      trackInputEvents: true,
      singleKeyShortcutsEnabled: true,
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
    staleTime: 5000,
  });

  const captureStatusQuery = useQuery<CaptureStatusResult>({
    queryKey: studioQueryKeys.captureStatus(),
    queryFn: () => engineApi.captureStatus(),
    refetchInterval: 1000,
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

  const recentsLimit = 10;
  const projectRecentsQuery = useQuery<ProjectRecentsResult>({
    queryKey: studioQueryKeys.projectRecents(recentsLimit),
    queryFn: async () => {
      try {
        return await engineApi.projectRecents(recentsLimit);
      } catch {
        // Recents are non-critical. If RPC wiring is unavailable, keep core workflows unblocked.
        return emptyProjectRecents;
      }
    },
    staleTime: 10_000,
    retry: false,
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

  const presets = exportInfoQuery.data?.presets ?? emptyExportPresets;

  const windowChoices = sourcesQuery.data?.windows ?? emptySourceWindows;
  const selectedWindowId = useMemo(() => {
    const selectedId = settingsForm.state.values.selectedWindowId;
    if (windowChoices.some((windowItem) => windowItem.id === selectedId)) {
      return selectedId;
    }
    return windowChoices[0]?.id ?? 0;
  }, [settingsForm.state.values.selectedWindowId, windowChoices]);

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
        1,
      ),
    [
      captureStatusQuery.data?.recordingDurationSeconds,
      exportForm.state.values.trimEndSeconds,
      exportForm.state.values.trimStartSeconds,
    ],
  );
  const boundedPlayheadSeconds = useMemo(
    () => clamp(playheadSeconds, 0, timelineDuration),
    [playheadSeconds, timelineDuration],
  );

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
        labels: {
          video: ui.labels.timelineLaneVideo,
          audio: ui.labels.timelineLaneAudio,
          events: ui.labels.timelineLaneEvents,
        },
      }),
    [
      laneRecordingDurationSeconds,
      timelineEvents,
      ui.labels.timelineLaneAudio,
      ui.labels.timelineLaneEvents,
      ui.labels.timelineLaneVideo,
    ],
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
  const selectedPresetId = selectedPreset?.id ?? "";

  const inputMonitoringDenied = permissionsQuery.data?.inputMonitoring === "denied";
  const inspectorSelection = useMemo(
    () => normalizeInspectorSelection(activeMode, rawInspectorSelection),
    [activeMode, rawInspectorSelection],
  );

  const startCaptureInternal = useCallback(async (): Promise<CaptureStatusResult> => {
    const { captureSource, micEnabled } = settingsForm.state.values;

    if (captureSource === "window") {
      if (selectedWindowId === 0) {
        throw new Error(ui.notices.selectWindowFirst);
      }
      return await engineApi.startWindowCapture(selectedWindowId, micEnabled);
    }

    return await engineApi.startDisplayCapture(micEnabled);
  }, [selectedWindowId, settingsForm.state.values, ui.notices.selectWindowFirst]);

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
      const projectRecents = await projectRecentsQuery.refetch();

      return {
        ping: ping.data,
        permissions: permissions.data,
        sources: sources.data,
        captureStatus: captureStatus.data,
        exportInfo: exportInfo.data,
        project: project.data,
        projectRecents: projectRecents.data ?? emptyProjectRecents,
      };
    },
    onError: (error) => {
      setNotice({
        kind: "error",
        message: error instanceof Error ? error.message : ui.notices.refreshFailed,
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
      setNotice({ kind: "success", message: ui.notices.permissionsRefreshed });
    },
    onError: (error) => {
      setNotice({ kind: "error", message: formatError(error, ui.notices.actionFailed) });
    },
  });

  const startPreviewMutation = useMutation({
    mutationFn: async () => await startCaptureInternal(),
    onSuccess: (nextStatus) => {
      queryClient.setQueryData(studioQueryKeys.captureStatus(), nextStatus);
      setNotice({ kind: "success", message: ui.notices.captureStarted });
    },
    onError: (error) => {
      setNotice({ kind: "error", message: formatError(error, ui.notices.actionFailed) });
    },
  });

  const stopPreviewMutation = useMutation({
    mutationFn: async () => await engineApi.stopCapture(),
    onSuccess: (nextStatus) => {
      queryClient.setQueryData(studioQueryKeys.captureStatus(), nextStatus);
      setIsTimelinePlaying(false);
      setNotice({ kind: "info", message: ui.notices.captureStopped });
    },
    onError: (error) => {
      setNotice({ kind: "error", message: formatError(error, ui.notices.actionFailed) });
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
        setNotice({ kind: "success", message: ui.notices.recordingFinished });
        return;
      }

      exportForm.setFieldValue("trimStartSeconds", 0);
      exportForm.setFieldValue("trimEndSeconds", 0);
      setPlayheadSeconds(0);

      if (settingsForm.state.values.trackInputEvents && inputMonitoringDenied) {
        setNotice({ kind: "info", message: ui.notices.inputTrackingDegraded });
      } else {
        setNotice({ kind: "success", message: ui.notices.recordingStarted });
      }
    },
    onError: (error) => {
      setNotice({ kind: "error", message: formatError(error, ui.notices.actionFailed) });
    },
  });

  const openProjectAtPath = useCallback(async (projectPath: string) => {
    const nextProject = await engineApi.projectOpen(projectPath);
    const nextStatus = await engineApi.captureStatus();
    return { nextProject, nextStatus };
  }, []);

  const openProjectMutation = useMutation({
    mutationFn: async () => {
      const pickedPath = await desktopApi.pickDirectory(
        projectQuery.data?.projectPath ?? undefined,
      );
      if (!pickedPath) {
        return null;
      }
      return await openProjectAtPath(pickedPath);
    },
    onSuccess: (data) => {
      if (!data) {
        return;
      }
      queryClient.setQueryData(studioQueryKeys.projectCurrent(), data.nextProject);
      queryClient.setQueryData(studioQueryKeys.captureStatus(), data.nextStatus);
      void queryClient.invalidateQueries({
        queryKey: studioQueryKeys.projectRecents(recentsLimit),
      });
      setNotice({ kind: "success", message: ui.notices.projectOpened });
    },
    onError: (error) => {
      setNotice({ kind: "error", message: formatError(error, ui.notices.actionFailed) });
    },
  });

  const openRecentProjectMutation = useMutation({
    mutationFn: async (projectPath: string) => await openProjectAtPath(projectPath),
    onSuccess: (data) => {
      queryClient.setQueryData(studioQueryKeys.projectCurrent(), data.nextProject);
      queryClient.setQueryData(studioQueryKeys.captureStatus(), data.nextStatus);
      void queryClient.invalidateQueries({
        queryKey: studioQueryKeys.projectRecents(recentsLimit),
      });
      setNotice({ kind: "success", message: ui.notices.projectOpened });
    },
    onError: (error) => {
      setNotice({ kind: "error", message: formatError(error, ui.notices.actionFailed) });
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
      void queryClient.invalidateQueries({
        queryKey: studioQueryKeys.projectRecents(recentsLimit),
      });
      setNotice({
        kind: "success",
        message: ui.notices.projectSaved(nextProject.projectPath ?? ui.labels.notSaved),
      });
    },
    onError: (error) => {
      setNotice({ kind: "error", message: formatError(error, ui.notices.actionFailed) });
    },
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      if (!recordingURL) {
        throw new Error(ui.notices.exportMissingRecording);
      }
      if (!selectedPreset) {
        throw new Error(ui.notices.exportMissingPreset);
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
      setNotice({ kind: "success", message: ui.notices.exportComplete(result.outputURL) });
    },
    onError: (error) => {
      setNotice({ kind: "error", message: formatError(error, ui.notices.actionFailed) });
    },
  });

  const busyMutations = [
    refreshMutation,
    requestPermissionMutation,
    startPreviewMutation,
    stopPreviewMutation,
    toggleRecordingMutation,
    openProjectMutation,
    openRecentProjectMutation,
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
    [exportForm, timelineDuration],
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
    [exportForm, timelineDuration],
  );

  const setTrimInFromPlayhead = useCallback(() => {
    setTrimStartSeconds(boundedPlayheadSeconds);
  }, [boundedPlayheadSeconds, setTrimStartSeconds]);

  const setTrimOutFromPlayhead = useCallback(() => {
    setTrimEndSeconds(boundedPlayheadSeconds);
  }, [boundedPlayheadSeconds, setTrimEndSeconds]);

  const selectTimelineClip = useCallback(
    (params: {
      laneId: "video" | "audio";
      clipId: string;
      startSeconds: number;
      endSeconds: number;
    }) => {
      setRawInspectorSelection({
        kind: "timelineClip",
        laneId: params.laneId,
        clipId: params.clipId,
        startSeconds: params.startSeconds,
        endSeconds: params.endSeconds,
      });
    },
    [],
  );

  const selectTimelineMarker = useCallback(
    (params: {
      markerId: string;
      markerKind: "move" | "click" | "mixed";
      density: number;
      timestampSeconds: number;
    }) => {
      setRawInspectorSelection({
        kind: "timelineMarker",
        markerId: params.markerId,
        markerKind: params.markerKind,
        density: params.density,
        timestampSeconds: params.timestampSeconds,
      });
    },
    [],
  );

  const selectCaptureWindow = useCallback(
    (params: { windowId: number; appName: string; title: string }) => {
      setRawInspectorSelection({
        kind: "captureWindow",
        windowId: params.windowId,
        appName: params.appName,
        title: params.title,
      });
    },
    [],
  );

  const selectExportPreset = useCallback(
    (presetId: string) => {
      const preset = presets.find((item) => item.id === presetId);
      if (!preset) {
        return;
      }
      setRawInspectorSelection(selectionFromPreset(preset));
    },
    [presets],
  );

  const clearInspectorSelection = useCallback(() => {
    setRawInspectorSelection(emptyInspectorSelection);
  }, []);

  const nudgePlayheadSeconds = useCallback(
    (deltaSeconds: number) => {
      setPlayheadSeconds((current) => clamp(current + deltaSeconds, 0, timelineDuration));
    },
    [timelineDuration],
  );

  const toggleTimelinePlayback = useCallback(() => {
    setIsTimelinePlaying((previous) => !previous);
  }, []);

  const setLeftPaneWidth = useCallback((widthPx: number) => {
    setLayout((current) => ({
      ...current,
      leftPaneWidthPx: clamp(
        Math.round(widthPx),
        studioLayoutBounds.leftPaneMinWidthPx,
        studioLayoutBounds.leftPaneMaxWidthPx,
      ),
      leftCollapsed: false,
    }));
  }, []);

  const setRightPaneWidth = useCallback((widthPx: number) => {
    setLayout((current) => ({
      ...current,
      rightPaneWidthPx: clamp(
        Math.round(widthPx),
        studioLayoutBounds.rightPaneMinWidthPx,
        studioLayoutBounds.rightPaneMaxWidthPx,
      ),
      rightCollapsed: false,
    }));
  }, []);

  const setTimelineHeight = useCallback((heightPx: number) => {
    setLayout((current) => ({
      ...current,
      timelineHeightPx: clamp(
        Math.round(heightPx),
        studioLayoutBounds.timelineMinHeightPx,
        studioLayoutBounds.timelineMaxHeightPx,
      ),
    }));
  }, []);

  const toggleLeftPaneCollapsed = useCallback(() => {
    setLayout((current) => ({
      ...current,
      leftCollapsed: !current.leftCollapsed,
    }));
  }, []);

  const toggleRightPaneCollapsed = useCallback(() => {
    setLayout((current) => ({
      ...current,
      rightCollapsed: !current.rightCollapsed,
    }));
  }, []);

  const setLastRoute = useCallback((route: string) => {
    setLayout((current) => ({
      ...current,
      lastRoute: normalizeStudioLayoutRoute(route),
    }));
  }, []);

  const setLocale = useCallback((nextLocale: StudioLocale) => {
    setLayout((current) => ({
      ...current,
      locale: nextLocale,
    }));
  }, []);

  const resetLayout = useCallback(() => {
    setLayout((current) => ({
      ...defaultStudioLayoutState,
      lastRoute: current.lastRoute,
      locale: current.locale,
    }));
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

  useHotkey(
    "Mod+S",
    (event) => {
      if (event.shiftKey) {
        return;
      }
      event.preventDefault();
      runHostCommand("file.saveProject");
    },
    {
      ignoreInputs: false,
      preventDefault: false,
      stopPropagation: false,
    },
  );

  useHotkey(
    "Mod+Shift+S",
    (event) => {
      event.preventDefault();
      runHostCommand("file.saveProjectAs");
    },
    {
      ignoreInputs: false,
      preventDefault: false,
      stopPropagation: false,
    },
  );

  useHotkey(
    "Mod+E",
    (event) => {
      event.preventDefault();
      runHostCommand("file.export");
    },
    {
      ignoreInputs: false,
      preventDefault: false,
      stopPropagation: false,
    },
  );

  useHotkey(
    "Escape",
    () => {
      clearInspectorSelection();
      setNotice(null);
    },
    { ignoreInputs: false },
  );

  useHotkey(
    "Space",
    (event) => {
      if (!settingsForm.state.values.singleKeyShortcutsEnabled) {
        return;
      }
      if (shouldBlockGlobalSingleKeyHotkey(event.target)) {
        return;
      }
      event.preventDefault();
      runHostCommand("timeline.playPause");
    },
    {
      ignoreInputs: true,
      preventDefault: false,
      stopPropagation: false,
    },
  );

  useHotkey(
    "R",
    (event) => {
      if (!settingsForm.state.values.singleKeyShortcutsEnabled) {
        return;
      }
      if (shouldBlockGlobalSingleKeyHotkey(event.target)) {
        return;
      }
      event.preventDefault();
      runHostCommand("capture.toggleRecording");
    },
    {
      ignoreInputs: true,
      preventDefault: false,
      stopPropagation: false,
    },
  );

  useHotkey(
    "I",
    (event) => {
      if (!settingsForm.state.values.singleKeyShortcutsEnabled) {
        return;
      }
      if (shouldBlockGlobalSingleKeyHotkey(event.target)) {
        return;
      }
      event.preventDefault();
      runHostCommand("timeline.trimIn");
    },
    {
      ignoreInputs: true,
      preventDefault: false,
      stopPropagation: false,
    },
  );

  useHotkey(
    "O",
    (event) => {
      if (!settingsForm.state.values.singleKeyShortcutsEnabled) {
        return;
      }
      if (shouldBlockGlobalSingleKeyHotkey(event.target)) {
        return;
      }
      event.preventDefault();
      runHostCommand("timeline.trimOut");
    },
    {
      ignoreInputs: true,
      preventDefault: false,
      stopPropagation: false,
    },
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
      locale,
    });
  }, [captureStatusQuery.data?.isRecording, isRunningAction, locale, recordingURL]);

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

  const captureStatusLabel = captureStatusQuery.data?.isRecording
    ? ui.labels.recording
    : captureStatusQuery.data?.isRunning
      ? ui.labels.previewing
      : ui.labels.idle;

  return {
    captureStatusLabel,
    captureStatusQuery,
    exportForm,
    exportMutation,
    exportPresets: presets,
    formatAspectRatio,
    formatDateTime,
    formatDecimal,
    formatDuration,
    formatInteger,
    inputMonitoringDenied,
    isRefreshing,
    isRunningAction,
    isTimelinePlaying,
    activeMode,
    locale,
    inspectorSelection,
    notice,
    nudgePlayheadSeconds,
    openProjectMutation,
    openRecentProjectMutation,
    permissionBadgeVariant,
    permissionsQuery,
    pingQuery,
    playheadSeconds: boundedPlayheadSeconds,
    playbackRate,
    playbackRates,
    layout,
    projectQuery,
    projectRecentsQuery,
    recordingURL,
    refreshAll,
    refreshMutation,
    requestPermissionMutation,
    resetLayout,
    runHostCommand,
    saveProjectMutation,
    selectedPreset,
    selectedPresetId,
    selectedWindowId,
    setNotice,
    setPlayheadSeconds: setPlayheadSecondsClamped,
    setPlaybackRate,
    setLocale,
    setLastRoute,
    setLeftPaneWidth,
    setInspectorSelection: setRawInspectorSelection,
    setRightPaneWidth,
    setTimelineHeight,
    setTrimEndSeconds,
    setTrimInFromPlayhead,
    setTrimStartSeconds,
    setTrimOutFromPlayhead,
    toggleLeftPaneCollapsed,
    clearInspectorSelection,
    selectCaptureWindow,
    selectExportPreset,
    selectTimelineClip,
    selectTimelineMarker,
    settingsForm,
    sourcesQuery,
    startPreviewMutation,
    stopPreviewMutation,
    timelineDuration,
    timelineLanes,
    toggleRecordingMutation,
    toggleRightPaneCollapsed,
    toggleTimelinePlayback,
    ui,
    windowChoices,
  };
}

export type StudioController = ReturnType<typeof useStudioController>;
