import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  defaultCaptureFrameRate,
  AutoZoomSettings,
  ExportPreset,
} from "@guerillaglass/engine-protocol";
import { getStudioMessages } from "@guerillaglass/localization";
import { desktopApi, sendHostMenuState } from "@/lib/engine";
import type { HostMenuCommand } from "../../../../../shared/bridgeRpc";
import { createHostCommandRunnerFromHandlers } from "../../../../../shared/hostCommandRegistry";
import {
  emptyInspectorSelection,
  type InspectorSelection,
  normalizeInspectorSelection,
  selectionFromPreset,
} from "../../model/inspectorSelectionModel";
import { useStudioHotkeys } from "./useStudioHotkeys";
import { useStudioLayoutController } from "./useStudioLayoutController";
import { useStudioMutations, type ExportFormApi, type SettingsFormApi } from "./useStudioMutations";
import { studioRecentsLimit, useStudioDataQueries } from "./useStudioDataQueries";
import { useStudioTimeline } from "../timeline/useStudioTimeline";

const hostMenuCommandEventName = "gg-host-menu-command";

export type CaptureSourceMode = "display" | "window";
export type Notice = { kind: "error" | "success" | "info"; message: string } | null;

export const defaultAutoZoom: AutoZoomSettings = {
  isEnabled: true,
  intensity: 1,
  minimumKeyframeInterval: 1 / 30,
};

function formatError(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error) {
    return error.message;
  }
  return fallbackMessage;
}

function isBridgeTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return /rpc request timed out/i.test(error.message.trim());
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

export function useStudioController() {
  const queryClient = useQueryClient();
  const {
    activeMode,
    layout,
    resetLayout,
    setDensityMode,
    setLastRoute,
    setLeftPaneCollapsed,
    setLeftPaneWidth,
    setLocale,
    setRightPaneCollapsed,
    setRightPaneWidth,
    setTimelineCollapsed,
    setTimelineHeight,
    toggleLeftPaneCollapsed,
    toggleRightPaneCollapsed,
    toggleTimelineCollapsed,
  } = useStudioLayoutController();
  const [notice, setNotice] = useState<Notice>(null);
  const [rawInspectorSelection, setRawInspectorSelection] =
    useState<InspectorSelection>(emptyInspectorSelection);
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
  const mapActionErrorMessage = useCallback(
    (error: unknown): string => {
      if (isBridgeTimeoutError(error)) {
        return ui.notices.rpcTimedOut;
      }
      return formatError(error, ui.notices.actionFailed);
    },
    [ui.notices.actionFailed, ui.notices.rpcTimedOut],
  );

  const settingsForm = useForm({
    defaultValues: {
      captureSource: "window" as CaptureSourceMode,
      selectedWindowId: 0,
      captureFps: defaultCaptureFrameRate,
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

  const {
    captureStatusQuery,
    eventsQuery,
    exportInfoQuery,
    permissionsQuery,
    pingQuery,
    presets,
    projectQuery,
    projectRecentsQuery,
    recordingURL,
    sourcesQuery,
    timelineEvents,
    windowChoices,
  } = useStudioDataQueries(studioRecentsLimit);
  const recentsLimit = studioRecentsLimit;

  const lastHydratedProjectAutoZoomSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    const projectAutoZoom = projectQuery.data?.autoZoom;
    if (!projectAutoZoom) {
      return;
    }
    const nextSignature = JSON.stringify(projectAutoZoom);
    if (nextSignature === lastHydratedProjectAutoZoomSignatureRef.current) {
      return;
    }
    lastHydratedProjectAutoZoomSignatureRef.current = nextSignature;
    settingsForm.setFieldValue("autoZoom", projectAutoZoom);
  }, [projectQuery.data?.autoZoom, settingsForm]);

  const selectedWindowId = useMemo(() => {
    const selectedId = settingsForm.state.values.selectedWindowId;
    if (windowChoices.some((windowItem) => windowItem.id === selectedId)) {
      return selectedId;
    }
    return windowChoices[0]?.id ?? 0;
  }, [settingsForm.state.values.selectedWindowId, windowChoices]);
  const timelineFrameRate = useMemo(() => {
    const metadataFrameRate =
      captureStatusQuery.data?.captureMetadata?.fps ??
      projectQuery.data?.captureMetadata?.fps ??
      null;
    if (metadataFrameRate && Number.isFinite(metadataFrameRate) && metadataFrameRate > 0) {
      return metadataFrameRate;
    }
    return settingsForm.state.values.captureFps;
  }, [
    captureStatusQuery.data?.captureMetadata?.fps,
    projectQuery.data?.captureMetadata?.fps,
    settingsForm.state.values.captureFps,
  ]);

  const timeline = useStudioTimeline({
    activeMode,
    recordingURL,
    recordingDurationSeconds: captureStatusQuery.data?.recordingDurationSeconds ?? 0,
    timelineFrameRate,
    timelineEvents,
    laneLabels: {
      video: ui.labels.timelineLaneVideo,
      audio: ui.labels.timelineLaneAudio,
      events: ui.labels.timelineLaneEvents,
    },
    trimStartSeconds: exportForm.state.values.trimStartSeconds,
    trimEndSeconds: exportForm.state.values.trimEndSeconds,
    onTrimStartSecondsChange: (seconds) => exportForm.setFieldValue("trimStartSeconds", seconds),
    onTrimEndSecondsChange: (seconds) => exportForm.setFieldValue("trimEndSeconds", seconds),
  });
  const {
    audioMixer,
    isTimelinePlaying,
    nudgePlayheadSeconds,
    playheadSeconds: boundedPlayheadSeconds,
    playbackRate,
    playbackRates,
    resetTimelineZoom,
    setAudioMixerGain,
    setIsTimelinePlaying,
    setPlayheadSeconds,
    setPlayheadSecondsClamped,
    setDisplayPlayheadSecondsFromMedia,
    setPlayheadSecondsFromMedia,
    setPlaybackRate,
    setTimelinePlaybackActive,
    setTimelineTool,
    setTimelineZoom,
    setTrimEndSeconds,
    setTrimInFromPlayhead,
    setTrimOutFromPlayhead,
    setTrimStartSeconds,
    timelineDuration,
    timelineLaneControlState,
    timelineLanes,
    timelineRippleEnabled,
    timelineSnapEnabled,
    timelineTool,
    timelineZoomPercent,
    toggleAudioMixerMuted,
    toggleLaneControl,
    toggleTimelinePlayback,
    toggleTimelineRipple,
    toggleTimelineSnap,
    zoomTimelineIn,
    zoomTimelineOut,
  } = timeline;

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

  const pickDirectorySafely = useCallback(
    async (startingFolder?: string): Promise<string | null> => {
      try {
        return await desktopApi.pickDirectory(startingFolder);
      } catch (error) {
        if (isBridgeTimeoutError(error)) {
          setNotice({
            kind: "info",
            message: ui.notices.directoryPickerTimedOut,
          });
          return null;
        }
        throw error;
      }
    },
    [ui.notices.directoryPickerTimedOut],
  );

  const {
    exportMutation,
    isRefreshing,
    isRunningAction,
    openProjectMutation,
    openRecentProjectMutation,
    refreshAll,
    refreshMutation,
    requestPermissionMutation,
    saveProjectMutation,
    startPreviewMutation,
    stopPreviewMutation,
    toggleRecordingMutation,
  } = useStudioMutations({
    queryClient,
    ui,
    mapActionErrorMessage,
    setNotice,
    setTimelinePlayback: setIsTimelinePlaying,
    resetPlayhead: () => setPlayheadSeconds(0),
    pickDirectorySafely,
    selectedWindowId,
    inputMonitoringDenied,
    recordingURL,
    selectedPreset,
    recentsLimit,
    settingsForm: settingsForm as unknown as SettingsFormApi,
    exportForm: exportForm as unknown as ExportFormApi,
    pingQuery,
    permissionsQuery,
    sourcesQuery,
    captureStatusQuery,
    exportInfoQuery,
    projectQuery,
    projectRecentsQuery,
    eventsQuery,
  });

  const recordingRequiredNotice = ui.helper.recordToEnableAction;

  const selectTimelineClip = useCallback(
    (params: {
      laneId: "video" | "audio";
      clipId: string;
      startSeconds: number;
      endSeconds: number;
    }) => {
      if (timelineLaneControlState[params.laneId].locked) {
        return;
      }
      setRawInspectorSelection({
        kind: "timelineClip",
        laneId: params.laneId,
        clipId: params.clipId,
        startSeconds: params.startSeconds,
        endSeconds: params.endSeconds,
      });
    },
    [timelineLaneControlState],
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

  const runHostCommand = useMemo(
    () =>
      createHostCommandRunnerFromHandlers({
        appRefresh: () => {
          void refreshMutation.mutateAsync();
        },
        appLocaleEnUS: () => {
          setLocale("en-US");
        },
        appLocaleDeDE: () => {
          setLocale("de-DE");
        },
        captureToggleRecording: () => {
          void toggleRecordingMutation.mutateAsync();
        },
        captureStartPreview: () => {
          void startPreviewMutation.mutateAsync();
        },
        captureStopPreview: () => {
          void stopPreviewMutation.mutateAsync();
        },
        timelinePlayPause: () => {
          toggleTimelinePlayback();
        },
        timelineTrimIn: () => {
          setTrimInFromPlayhead();
        },
        timelineTrimOut: () => {
          setTrimOutFromPlayhead();
        },
        timelineTogglePanel: () => {
          toggleTimelineCollapsed();
        },
        viewDensityComfortable: () => {
          setDensityMode("comfortable");
        },
        viewDensityCompact: () => {
          setDensityMode("compact");
        },
        fileOpenProject: () => {
          void openProjectMutation.mutateAsync();
        },
        fileSaveProject: () => {
          void saveProjectMutation.mutateAsync(false);
        },
        fileSaveProjectAs: () => {
          void saveProjectMutation.mutateAsync(true);
        },
        fileExport: () => {
          void exportMutation.mutateAsync();
        },
      }),
    [
      exportMutation,
      openProjectMutation,
      refreshMutation,
      saveProjectMutation,
      setDensityMode,
      setLocale,
      setTrimInFromPlayhead,
      setTrimOutFromPlayhead,
      startPreviewMutation,
      stopPreviewMutation,
      toggleRecordingMutation,
      toggleTimelineCollapsed,
      toggleTimelinePlayback,
    ],
  );

  const clearNotice = useCallback(() => {
    setNotice(null);
  }, []);

  useStudioHotkeys({
    runHostCommand,
    singleKeyShortcutsEnabled: settingsForm.state.values.singleKeyShortcutsEnabled,
    clearInspectorSelection,
    clearNotice,
    setTimelineTool,
  });

  useEffect(() => {
    sendHostMenuState({
      canSave: !isRunningAction && Boolean(recordingURL),
      canExport: !isRunningAction && Boolean(recordingURL),
      isRecording: Boolean(captureStatusQuery.data?.isRecording),
      locale,
      densityMode: layout.densityMode,
    });
  }, [
    captureStatusQuery.data?.isRecording,
    isRunningAction,
    layout.densityMode,
    locale,
    recordingURL,
  ]);

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
    audioMixer,
    activeMode,
    locale,
    densityMode: layout.densityMode,
    inspectorSelection,
    notice,
    nudgePlayheadSeconds,
    openProjectMutation,
    openRecentProjectMutation,
    permissionsQuery,
    pingQuery,
    playheadSeconds: boundedPlayheadSeconds,
    playbackRate,
    playbackRates,
    recordingRequiredNotice,
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
    setAudioMixerGain,
    toggleAudioMixerMuted,
    setPlayheadSeconds: setPlayheadSecondsClamped,
    setDisplayPlayheadSecondsFromMedia,
    setPlayheadSecondsFromMedia,
    setPlaybackRate,
    setTimelinePlaybackActive,
    setTimelineTool,
    setTimelineZoom,
    setLocale,
    setDensityMode,
    setLastRoute,
    setLeftPaneWidth,
    setInspectorSelection: setRawInspectorSelection,
    setRightPaneWidth,
    setRightPaneCollapsed,
    setTimelineHeight,
    setTimelineCollapsed,
    setTrimEndSeconds,
    setTrimInFromPlayhead,
    setTrimStartSeconds,
    setTrimOutFromPlayhead,
    timelineLaneControlState,
    timelineRippleEnabled,
    timelineSnapEnabled,
    timelineTool,
    timelineZoomPercent,
    toggleLaneControl,
    toggleLeftPaneCollapsed,
    toggleTimelineRipple,
    toggleTimelineSnap,
    zoomTimelineIn,
    zoomTimelineOut,
    resetTimelineZoom,
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
    toggleTimelineCollapsed,
    toggleTimelinePlayback,
    ui,
    windowChoices,
    setLeftPaneCollapsed,
  };
}

export type StudioController = ReturnType<typeof useStudioController>;
