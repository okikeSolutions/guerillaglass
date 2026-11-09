import { useReplacementConfirmation } from "../useReplacementConfirmation";
import { fileActionErrorMessage } from "../../view-model/fileActionErrorMessage";
import { editorStateSignature, timelineContentSignature } from "../../domain/editorStateSignature";
import { useForm, useStore } from "@tanstack/react-form";
import { useQueryClient, useIsMutating, useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { type ExportPreset } from "@guerillaglass/engine-contract/domains/export";
import {
  defaultCaptureFrameRate,
  type CaptureFrameRate,
} from "@guerillaglass/engine-contract/domains/sources";
import {
  type AutoZoomSettings,
  type BackgroundFramingSettings,
  defaultBackgroundFramingSettings,
  type TimelineDocument,
} from "@guerillaglass/engine-contract/shared/valueObjects";
import { getStudioMessages, type StudioMessages } from "@shared/localization";
import { desktopApi, sendHostMenuState } from "@lib/engine";
import { recordStudioDiagnosticsEvent } from "@lib/studioDiagnostics";
import type { HostMenuCommand, HostPathPickerMode } from "@shared/bridge/desktopBridgeContract";
import { hostBridgeEventNames } from "@shared/bridge/desktopBridgeContract";
import {
  BridgeInvocationError,
  BridgeUnavailableError,
  StudioActionError,
} from "@shared/errors/desktopErrors";
import {
  ContractDecodeError,
  EngineClientError,
  EngineResponseError,
  JsonParseError,
  messageFromUnknownError,
} from "@guerillaglass/engine-client/errors";
import { createHostCommandRunnerFromHandlers } from "@shared/hostCommandRegistry";
import {
  detectStudioShortcutPlatform,
  sanitizeStudioShortcutOverrides,
  validateStudioShortcutOverride,
  type ShortcutDisplayPlatform,
  type StudioShortcutId,
  type StudioShortcutOverrides,
} from "@shared/shortcuts";
import {
  emptyInspectorSelection,
  type InspectorSelection,
  normalizeInspectorSelection,
  selectionFromPreset,
} from "../../domain/inspectorSelectionModel";
import {
  compileTimelineItems,
  createEmptyTimelineDocument,
  createSingleSegmentTimelineDocument,
} from "../../domain/timelineDomainModel";
import {
  deleteTimelineItems,
  liftTimelineItems,
  moveTimelineItems,
  splitTimelineClipAtProgramTime,
  resetTimelineClipCamera,
} from "../../domain/timelineCommands";
import {
  normalizeTimelineFrameRate,
  quantizeSecondsToFrame,
} from "../../domain/timelineFrameTimebase";
import { resolveSelectedDisplayId } from "../../domain/preferredDisplaySelection";
import { resolveSelectedWindowId } from "../../domain/preferredWindowSelection";
import {
  loadStudioShortcutOverrides,
  saveStudioShortcutOverrides,
} from "../../contracts/studioShortcutOverridesModel";
import { useStudioHotkeys } from "./useStudioHotkeys";
import { useStudioLayoutController } from "./useStudioLayoutController";
import { useStudioMutations, type ExportFormApi, type SettingsFormApi } from "./useStudioMutations";
import { studioRecentsLimit, useStudioDataQueries, studioQueryKeys } from "./useStudioDataQueries";
import { useStudioTimeline } from "../timeline/useStudioTimeline";

import {
  useEditorDocumentHistory,
  type EditorSettingsAdapter,
} from "../timeline/useEditorDocumentHistory";

export type CaptureSourceMode = "display" | "window";
export type Notice = { kind: "error" | "success" | "info"; message: string } | null;

export const defaultAutoZoom: AutoZoomSettings = {
  isEnabled: true,
  intensity: 1,
  minimumKeyframeInterval: 1 / 30,
};

export const defaultBackgroundFraming: BackgroundFramingSettings = {
  ...defaultBackgroundFramingSettings,
};

export function formatDuration(seconds: number): string {
  const millis = Math.round(Math.max(0, Number.isFinite(seconds) ? seconds : 0) * 1000);
  const clamped = Math.floor(millis / 1000);
  const hours = Math.floor(clamped / 3600)
    .toString()
    .padStart(2, "0");
  const minutes = Math.floor((clamped % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const remainder = (clamped % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}:${remainder}${millis % 1000 ? `.${String(millis % 1000).padStart(3, "0")}` : ""}`;
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

export function mapStudioActionErrorMessage(ui: StudioMessages, error: unknown): string {
  const fileActionMessage = fileActionErrorMessage(ui, error);
  if (fileActionMessage !== undefined) {
    return fileActionMessage;
  }
  if (error instanceof StudioActionError) {
    switch (error.reason) {
      case "screen_permission_required":
        return ui.notices.screenPermissionRequired;
      case "capture_permission_required":
        return ui.notices.capturePermissionRequired;
      case "window_selection_failed":
        return ui.notices.windowSelectionFailed;
      case "window_selection_required":
        return ui.notices.selectWindowFirst;
      case "export_missing_recording":
        return ui.notices.exportMissingRecording;
      case "export_missing_preset":
        return ui.notices.exportMissingPreset;
    }
  }
  if (error instanceof EngineClientError && error.code === "ENGINE_REQUEST_TIMEOUT") {
    return ui.notices.rpcTimedOut;
  }
  if (error instanceof EngineResponseError) {
    if (error.description.startsWith("project_busy:")) {
      return ui.notices.projectBusy;
    }
    if (error.description.startsWith("project_unsafe_path:")) {
      return ui.notices.projectUnsafePath;
    }
    if (
      error.code === "runtime_error" &&
      /capture did not stabilize quickly enough/i.test(error.description)
    ) {
      return ui.notices.recordingStartNotReady;
    }
    return error.message;
  }
  if (
    error instanceof BridgeUnavailableError ||
    error instanceof BridgeInvocationError ||
    error instanceof ContractDecodeError ||
    error instanceof EngineClientError ||
    error instanceof JsonParseError
  ) {
    return error.message;
  }
  return messageFromUnknownError(error, ui.notices.actionFailed);
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
  const shortcutPlatform = useMemo<ShortcutDisplayPlatform>(
    () => detectStudioShortcutPlatform(),
    [],
  );
  const [shortcutOverrides, setShortcutOverrides] = useState<StudioShortcutOverrides>(() =>
    loadStudioShortcutOverrides(shortcutPlatform),
  );
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
    (error: unknown): string => mapStudioActionErrorMessage(ui, error),
    [ui],
  );

  const settingsForm = useForm({
    defaultValues: {
      captureSource: "window" as CaptureSourceMode,
      selectedDisplayId: 0,
      selectedWindowId: 0,
      captureFps: defaultCaptureFrameRate,
      micEnabled: false,
      trackInputEvents: true,
      singleKeyShortcutsEnabled: true,
      autoZoom: defaultAutoZoom,
      backgroundFraming: defaultBackgroundFraming,
    },
  });

  const exportForm = useForm({
    defaultValues: {
      presetId: "",
      fileName: "guerillaglass-export",
      rangeMode: "full" as "full" | "selected",
      trimStartSeconds: 0,
      trimEndSeconds: 0,
    },
  });

  const settingsValues = useStore(settingsForm.store, (state) => state.values);
  const exportValues = useStore(exportForm.store, (state) => state.values);

  const settingsFormApi = useMemo<SettingsFormApi>(
    () => ({
      getValues: () => settingsForm.state.values,
      setSelectedDisplayId: (value) => settingsForm.setFieldValue("selectedDisplayId", value),
      setSelectedWindowId: (value) => settingsForm.setFieldValue("selectedWindowId", value),
    }),
    [settingsForm],
  );
  const exportFormApi = useMemo<ExportFormApi>(
    () => ({
      getValues: () => exportForm.state.values,
      setRangeMode: (value) => exportForm.setFieldValue("rangeMode", value),
      setTrimStartSeconds: (value) => exportForm.setFieldValue("trimStartSeconds", value),
      setTrimEndSeconds: (value) => exportForm.setFieldValue("trimEndSeconds", value),
    }),
    [exportForm],
  );

  const {
    capabilitiesQuery,
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
    displayChoices,
    windowChoices,
  } = useStudioDataQueries({
    recentsLimit: studioRecentsLimit,
    subscribeToCaptureStatus: activeMode === "capture",
  });
  const recentsLimit = studioRecentsLimit;

  const diagnosticsRenderSignatureRef = useRef<Record<
    string,
    string | number | boolean | null
  > | null>(null);

  useEffect(() => {
    saveStudioShortcutOverrides(shortcutOverrides, shortcutPlatform);
  }, [shortcutOverrides, shortcutPlatform]);

  const [mediaDuration, setMediaDuration] = useState<{
    source: string | null;
    seconds: number;
    width: number;
    height: number;
    embeddedAudioTrackCount: number | null;
  } | null>(null);
  const recordingMediaDuration = mediaDuration?.source === recordingURL ? mediaDuration.seconds : 0;
  const setRecordingMediaDurationSeconds = useCallback(
    (
      seconds: number,
      size?: { width: number; height: number },
      embeddedAudioTrackCount: number | null = null,
    ) => {
      if (Number.isFinite(seconds) && seconds > 0) {
        setMediaDuration({
          source: recordingURL,
          seconds,
          width: size && Number.isFinite(size.width) ? Math.max(0, size.width) : 0,
          height: size && Number.isFinite(size.height) ? Math.max(0, size.height) : 0,
          embeddedAudioTrackCount:
            embeddedAudioTrackCount !== null &&
            Number.isInteger(embeddedAudioTrackCount) &&
            embeddedAudioTrackCount >= 0
              ? embeddedAudioTrackCount
              : null,
        });
      }
    },
    [recordingURL],
  );

  // Preview listening preferences are session UI state, never saved/exported edits.
  const [previewAudio, setPreviewAudio] = useState({ volume: 1, muted: false });
  const setPreviewVolume = useCallback((volume: number) => {
    if (!Number.isFinite(volume)) {
      return;
    }
    const bounded = Math.min(1, Math.max(0, volume));
    setPreviewAudio({ volume: bounded, muted: bounded === 0 });
  }, []);
  const togglePreviewMuted = useCallback(
    () => setPreviewAudio((current) => ({ ...current, muted: !current.muted })),
    [],
  );

  const baselineTimelineDocument = useMemo<TimelineDocument>(() => {
    const projectTimeline = projectQuery.data?.timeline;
    const recordingDurationSeconds =
      recordingMediaDuration ||
      (projectQuery.data?.projectPath ? 0 : captureStatusQuery.data?.recordingDurationSeconds) ||
      0;
    if (projectTimeline && projectTimeline.items.length > 0) {
      return projectTimeline;
    }

    if (recordingURL && recordingDurationSeconds > 0) {
      return createSingleSegmentTimelineDocument(recordingDurationSeconds);
    }

    return createEmptyTimelineDocument();
  }, [
    recordingMediaDuration,
    captureStatusQuery.data?.recordingDurationSeconds,
    projectQuery.data?.timeline,
    projectQuery.data?.projectPath,
    recordingURL,
  ]);
  const baselineTimelineSignature = useMemo(
    () => timelineContentSignature(baselineTimelineDocument),
    [baselineTimelineDocument],
  );
  const projectIdentity = editorStateSignature([projectQuery.data?.projectPath, recordingURL]);
  const editorSettings = useMemo<EditorSettingsAdapter>(
    () => ({
      getValues: () => settingsForm.state.values,
      restore: (settings) => {
        settingsForm.setFieldValue("autoZoom", settings.autoZoom);
        settingsForm.setFieldValue("backgroundFraming", settings.backgroundFraming);
      },
      subscribe: (listener) => {
        const subscription = settingsForm.store.subscribe(listener);
        return () => subscription.unsubscribe();
      },
    }),
    [settingsForm],
  );
  const canEditDocument = useCallback(
    () =>
      queryClient.isMutating() === 0 &&
      !(
        queryClient.getQueryData<NonNullable<typeof captureStatusQuery.data>>(
          studioQueryKeys.captureStatus(),
        ) ?? captureStatusQuery.data
      )?.isRecording,
    [queryClient, captureStatusQuery.data],
  );
  const documentHistory = useEditorDocumentHistory({
    baseline: {
      timeline: baselineTimelineDocument,
      autoZoom: projectQuery.data?.autoZoom ?? defaultAutoZoom,
      backgroundFraming: projectQuery.data?.backgroundFraming ?? defaultBackgroundFraming,
    },
    projectIdentity,
    generatedTimeline: !projectQuery.data?.timeline?.items.length,
    settings: editorSettings,
    canEdit: canEditDocument,
  });
  const { currentHistory, timelineDocument, updateTimelineDocument, undoTimeline, redoTimeline } =
    documentHistory;
  const timelineDocumentRef = useRef(timelineDocument);
  useLayoutEffect(() => {
    timelineDocumentRef.current = timelineDocument;
  }, [timelineDocument]);
  const currentTimelineSignature = timelineContentSignature(timelineDocument);
  const timelineChanged = currentTimelineSignature !== baselineTimelineSignature;
  const autoZoomChanged =
    editorStateSignature(settingsValues.autoZoom) !==
    editorStateSignature(projectQuery.data?.autoZoom ?? defaultAutoZoom);
  const backgroundChanged =
    editorStateSignature(settingsValues.backgroundFraming) !==
    editorStateSignature(projectQuery.data?.backgroundFraming ?? defaultBackgroundFraming);
  const hasSavedProject = Boolean(projectQuery.data?.projectPath);
  const hasUnsavedProjectEdits =
    (Boolean(recordingURL) && !hasSavedProject) ||
    timelineChanged ||
    autoZoomChanged ||
    backgroundChanged;
  const sourceIdentityMatches = recordingURL === (projectQuery.data?.recordingURL ?? null);
  const currentItemCount = timelineDocument.items.length;
  const baselineItemCount = baselineTimelineDocument.items.length;
  const currentSignatureLength = currentTimelineSignature.length;
  const baselineSignatureLength = baselineTimelineSignature.length;
  useEffect(() => {
    recordStudioDiagnosticsEvent("editor dirty state", {
      timelineChanged,
      autoZoomChanged,
      backgroundChanged,
      hasSavedProject,
      sourceIdentityMatches,
      currentItemCount,
      baselineItemCount,
      currentSignatureLength,
      baselineSignatureLength,
    });
  }, [
    timelineChanged,
    autoZoomChanged,
    backgroundChanged,
    hasSavedProject,
    sourceIdentityMatches,
    currentItemCount,
    baselineItemCount,
    currentSignatureLength,
    baselineSignatureLength,
  ]);

  const selectedDisplayId = useMemo(() => {
    return resolveSelectedDisplayId(displayChoices, settingsValues.selectedDisplayId);
  }, [displayChoices, settingsValues.selectedDisplayId]);
  const selectedWindowId = useMemo(() => {
    return resolveSelectedWindowId(windowChoices, settingsValues.selectedWindowId);
  }, [settingsValues.selectedWindowId, windowChoices]);
  const selectedDisplaySource = useMemo(
    () => displayChoices.find((displayItem) => displayItem.id === selectedDisplayId) ?? null,
    [displayChoices, selectedDisplayId],
  );
  const selectedWindowSource = useMemo(() => {
    return windowChoices.find((windowItem) => windowItem.id === selectedWindowId) ?? null;
  }, [selectedWindowId, windowChoices]);
  const supportedCaptureFrameRates = useMemo<ReadonlyArray<CaptureFrameRate>>(() => {
    const source =
      settingsValues.captureSource === "display" ? selectedDisplaySource : selectedWindowSource;
    return source?.supportedCaptureFrameRates ?? [];
  }, [selectedDisplaySource, selectedWindowSource, settingsValues.captureSource]);
  const preferredSupportedCaptureFrameRate = useMemo(() => {
    if (supportedCaptureFrameRates.length === 0) {
      return null;
    }
    if (supportedCaptureFrameRates.includes(defaultCaptureFrameRate)) {
      return defaultCaptureFrameRate;
    }
    const [lastSupportedCaptureFrameRate] = supportedCaptureFrameRates.slice(-1);
    return lastSupportedCaptureFrameRate ?? null;
  }, [supportedCaptureFrameRates]);

  useEffect(() => {
    if (supportedCaptureFrameRates.length === 0 || preferredSupportedCaptureFrameRate == null) {
      return;
    }
    const currentCaptureFrameRate = settingsValues.captureFps;
    if (supportedCaptureFrameRates.includes(currentCaptureFrameRate)) {
      return;
    }
    settingsForm.setFieldValue("captureFps", preferredSupportedCaptureFrameRate);
  }, [
    preferredSupportedCaptureFrameRate,
    settingsForm,
    settingsValues.captureFps,
    supportedCaptureFrameRates,
  ]);

  const metadataFrameRate = projectQuery.data?.projectPath
    ? projectQuery.data.captureMetadata?.fps
    : (captureStatusQuery.data?.captureMetadata?.fps ?? projectQuery.data?.captureMetadata?.fps);
  const timelineFrameRate =
    metadataFrameRate && Number.isFinite(metadataFrameRate) && metadataFrameRate > 0
      ? metadataFrameRate
      : settingsValues.captureFps;

  const timeline = useStudioTimeline({
    activeMode,
    recordingURL,
    recordingDurationSeconds: captureStatusQuery.data?.recordingDurationSeconds ?? 0,
    embeddedAudioTrackCount:
      mediaDuration?.source === recordingURL ? mediaDuration.embeddedAudioTrackCount : null,
    timelineDocument,
    timelineFrameRate,
    timelineEvents,
    laneLabels: {
      video: ui.labels.timelineLaneVideo,
      audio: ui.labels.timelineLaneAudio,
      events: ui.labels.timelineLaneEvents,
    },
  });
  const {
    sourceAudioPresentation,
    audioMixer,
    nudgePlayheadSeconds,
    playbackStore,
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
    timelineDuration,
    timelineLaneControlState,
    timelineLanes,
    timelineItems,
    timelineSegments,
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

  useEffect(() => {
    const nextSignature: Record<string, string | number | boolean | null> = {
      activeMode,
      locale,
      densityMode: layout.densityMode,
      lastRoute: layout.lastRoute,
      noticeKind: notice?.kind ?? null,
      noticeMessage: notice?.message ?? null,
      recordingURL,
      recordingDurationSeconds: captureStatusQuery.data?.recordingDurationSeconds ?? 0,
      captureIsRunning: captureStatusQuery.data?.isRunning ?? false,
      captureIsRecording: captureStatusQuery.data?.isRecording ?? false,
      projectPath: projectQuery.data?.projectPath ?? null,
      projectTimelineSegments: projectQuery.data?.timeline?.items.length ?? 0,
      timelineDocumentSegments: timelineDocument.items.length,
      timelineDuration,
      selectedDisplayId,
      selectedWindowId,
      eventsCount: timelineEvents.length,
      playbackIsPlaying: playbackStore.getSnapshot().isPlaying,
      playbackRate: playbackStore.getSnapshot().playbackRate,
    };

    const previousSignature = diagnosticsRenderSignatureRef.current;
    diagnosticsRenderSignatureRef.current = nextSignature;
    if (!previousSignature) {
      return;
    }

    const changedKeys = Object.keys(nextSignature).filter(
      (key) => previousSignature[key] !== nextSignature[key],
    );
    if (changedKeys.length === 0) {
      recordStudioDiagnosticsEvent("studio controller render without tracked state change", {
        activeMode,
      });
      return;
    }

    recordStudioDiagnosticsEvent("studio controller render drivers", {
      activeMode,
      changedKeys: changedKeys.join(","),
    });
  }, undefined);

  const setExportRangeMode = useCallback(
    (mode: "full" | "selected") => {
      if (mode === "selected" && exportForm.state.values.rangeMode === "full") {
        exportForm.setFieldValue("trimStartSeconds", 0);
        exportForm.setFieldValue(
          "trimEndSeconds",
          timelineItems.slice(-1)[0]?.programEndSeconds ?? 0,
        );
      }
      exportForm.setFieldValue("rangeMode", mode);
    },
    [exportForm, timelineItems],
  );

  const setTrimStartSeconds = useCallback(
    (seconds: number) => {
      if (!Number.isFinite(seconds)) {
        return;
      }
      setExportRangeMode("selected");
      const duration = timelineItems.slice(-1)[0]?.programEndSeconds ?? 0;
      const next = timelineSnapEnabled
        ? quantizeSecondsToFrame(seconds, normalizeTimelineFrameRate(timelineFrameRate))
        : seconds;
      exportForm.setFieldValue("trimStartSeconds", Math.min(Math.max(next, 0), duration));
    },
    [exportForm, setExportRangeMode, timelineItems, timelineFrameRate, timelineSnapEnabled],
  );

  const setTrimEndSeconds = useCallback(
    (seconds: number) => {
      if (!Number.isFinite(seconds)) {
        return;
      }
      setExportRangeMode("selected");
      const duration = timelineItems.slice(-1)[0]?.programEndSeconds ?? 0;
      const next = timelineSnapEnabled
        ? quantizeSecondsToFrame(seconds, normalizeTimelineFrameRate(timelineFrameRate))
        : seconds;
      exportForm.setFieldValue("trimEndSeconds", Math.min(Math.max(next, 0), duration));
    },
    [exportForm, setExportRangeMode, timelineItems, timelineFrameRate, timelineSnapEnabled],
  );

  const setTrimInFromPlayhead = useCallback(() => {
    if (activeMode === "capture") {
      return;
    }
    setTrimStartSeconds(playbackStore.getSnapshot().playheadSeconds);
  }, [activeMode, playbackStore, setTrimStartSeconds]);

  const setTrimOutFromPlayhead = useCallback(() => {
    if (activeMode === "capture") {
      return;
    }
    setTrimEndSeconds(playbackStore.getSnapshot().playheadSeconds);
  }, [activeMode, playbackStore, setTrimEndSeconds]);

  const selectedPreset = useMemo<ExportPreset | undefined>(() => {
    const selected = presets.find((preset) => preset.id === exportValues.presetId);
    return selected ?? presets[0];
  }, [exportValues.presetId, presets]);
  const selectedPresetId = selectedPreset?.id ?? "";

  const inputMonitoringDenied = permissionsQuery.data?.inputMonitoring === "denied";
  const inspectorSelection = useMemo(
    () => normalizeInspectorSelection(activeMode, rawInspectorSelection),
    [activeMode, rawInspectorSelection],
  );
  const selectedTimelineClip =
    inspectorSelection.kind === "timelineClip" ? inspectorSelection : null;
  const clearInspectorSelection = useCallback(() => {
    setRawInspectorSelection(emptyInspectorSelection);
  }, []);

  const resetSelectedSceneCamera = useCallback(() => {
    if (!selectedTimelineClip) {
      return;
    }
    updateTimelineDocument(
      (timeline) => resetTimelineClipCamera(timeline, selectedTimelineClip.clipId).timeline,
    );
  }, [selectedTimelineClip, updateTimelineDocument]);

  const splitSelectedTimelineClipAtPlayhead = useCallback(() => {
    if (!selectedTimelineClip) {
      return;
    }

    let didChange = false;
    updateTimelineDocument((currentTimeline) => {
      const result = splitTimelineClipAtProgramTime(
        currentTimeline,
        playbackStore.getSnapshot().playheadSeconds,
      );
      didChange = result.changed;
      return result.timeline;
    });
    if (didChange) {
      clearInspectorSelection();
      setTimelineTool("select");
    }
  }, [
    clearInspectorSelection,
    playbackStore,
    selectedTimelineClip,
    setTimelineTool,
    updateTimelineDocument,
  ]);

  const splitTimelineClipAtSeconds = useCallback(
    (seconds: number) => {
      let didChange = false;
      updateTimelineDocument((currentTimeline) => {
        const result = splitTimelineClipAtProgramTime(currentTimeline, seconds);
        didChange = result.changed;
        return result.timeline;
      });
      if (didChange) {
        clearInspectorSelection();
        setPlayheadSecondsClamped(seconds);
        setTimelineTool("select");
      }
    },
    [clearInspectorSelection, setPlayheadSecondsClamped, setTimelineTool, updateTimelineDocument],
  );

  const deleteSelectedTimelineClip = useCallback(() => {
    if (!selectedTimelineClip) {
      return;
    }

    let didChange = false;
    updateTimelineDocument((currentTimeline) => {
      const result = deleteTimelineItems(currentTimeline, [selectedTimelineClip.clipId], {
        ripple: timelineRippleEnabled,
      });
      didChange = result.changed;
      return result.timeline;
    });
    if (didChange) {
      clearInspectorSelection();
    }
  }, [
    clearInspectorSelection,
    selectedTimelineClip,
    timelineRippleEnabled,
    updateTimelineDocument,
  ]);

  const liftSelectedTimelineClip = useCallback(() => {
    if (!selectedTimelineClip) {
      return;
    }

    let didChange = false;
    updateTimelineDocument((currentTimeline) => {
      const result = liftTimelineItems(currentTimeline, [selectedTimelineClip.clipId]);
      didChange = result.changed;
      return result.timeline;
    });
    if (didChange) {
      clearInspectorSelection();
    }
  }, [clearInspectorSelection, selectedTimelineClip, updateTimelineDocument]);

  const moveSelectedTimelineClipEarlier = useCallback(() => {
    if (!selectedTimelineClip) {
      return;
    }

    let didChange = false;
    updateTimelineDocument((currentTimeline) => {
      const selectedIndex = currentTimeline.items.findIndex(
        (item) => item.id === selectedTimelineClip.clipId,
      );
      if (selectedIndex <= 0) {
        return currentTimeline;
      }

      const previousItem = currentTimeline.items[selectedIndex - 1] ?? null;
      const result =
        timelineRippleEnabled || previousItem?.kind !== "gap"
          ? moveTimelineItems(currentTimeline, [selectedTimelineClip.clipId], {
              ripple: true,
              destinationIndex: Math.max(0, selectedIndex - 1),
            })
          : moveTimelineItems(currentTimeline, [selectedTimelineClip.clipId], {
              ripple: false,
              destinationGapId: previousItem.id,
            });
      didChange = result.changed;
      return result.timeline;
    });
    if (didChange) {
      clearInspectorSelection();
    }
  }, [
    clearInspectorSelection,
    selectedTimelineClip,
    timelineRippleEnabled,
    updateTimelineDocument,
  ]);

  const moveSelectedTimelineClipLater = useCallback(() => {
    if (!selectedTimelineClip) {
      return;
    }

    let didChange = false;
    updateTimelineDocument((currentTimeline) => {
      const selectedIndex = currentTimeline.items.findIndex(
        (item) => item.id === selectedTimelineClip.clipId,
      );
      if (selectedIndex === -1 || selectedIndex >= currentTimeline.items.length - 1) {
        return currentTimeline;
      }

      const nextItem = currentTimeline.items[selectedIndex + 1] ?? null;
      const result =
        timelineRippleEnabled || nextItem?.kind !== "gap"
          ? moveTimelineItems(currentTimeline, [selectedTimelineClip.clipId], {
              ripple: true,
              destinationIndex: Math.min(currentTimeline.items.length, selectedIndex + 2),
            })
          : moveTimelineItems(currentTimeline, [selectedTimelineClip.clipId], {
              ripple: false,
              destinationGapId: nextItem.id,
            });
      didChange = result.changed;
      return result.timeline;
    });
    if (didChange) {
      clearInspectorSelection();
    }
  }, [
    clearInspectorSelection,
    selectedTimelineClip,
    timelineRippleEnabled,
    updateTimelineDocument,
  ]);

  const moveTimelineClipByDrop = useCallback(
    (
      params:
        | { clipId: string; destinationIndex: number }
        | {
            clipId: string;
            destinationGapId: string;
            destinationOffsetSeconds: number;
          },
    ) => {
      const result =
        "destinationGapId" in params
          ? moveTimelineItems(timelineDocumentRef.current, [params.clipId], {
              ripple: false,
              destinationGapId: params.destinationGapId,
              destinationOffsetSeconds: params.destinationOffsetSeconds,
            })
          : moveTimelineItems(timelineDocumentRef.current, [params.clipId], {
              ripple: true,
              destinationIndex: params.destinationIndex,
            });
      if (!result.changed) {
        return;
      }

      updateTimelineDocument(() => result.timeline);
      clearInspectorSelection();
      const destinationSeconds = compileTimelineItems(result.timeline).find(
        (item) => item.id === params.clipId,
      )?.programStartSeconds;
      if (destinationSeconds != null) {
        setPlayheadSecondsClamped(destinationSeconds);
      }
    },
    [clearInspectorSelection, setPlayheadSecondsClamped, updateTimelineDocument],
  );

  const pickPathSafely = useCallback(
    async (params: { mode: HostPathPickerMode; startingFolder?: string }): Promise<string | null> =>
      await desktopApi.pickPath(params),
    [],
  );

  const replacementConfirmation = useReplacementConfirmation();
  const {
    exportMutation,
    isRefreshing,
    isRunningAction: hasRunningMutation,
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
    locale,
    queryClient,
    ui,
    mapActionErrorMessage,
    setNotice,
    setTimelinePlayback: setIsTimelinePlaying,
    resetPlayhead: () => setPlayheadSeconds(0),
    clearInspectorSelection,
    pickPathSafely,
    selectedDisplayId,
    selectedWindowId,
    inputMonitoringDenied,
    recordingURL,
    timelineDocument,
    hasUnsavedProjectEdits,
    requestReplacementConfirmation: replacementConfirmation.request,
    onProjectOpened: documentHistory.reset,
    onRecordingStarted: documentHistory.reset,
    onProjectSaved: (project) => {
      documentHistory.markSaved(
        editorStateSignature([project.projectPath, project.recordingURL ?? null]),
        {
          timeline: project.timeline ?? timelineDocumentRef.current,
          autoZoom: project.autoZoom ?? settingsForm.state.values.autoZoom,
          backgroundFraming:
            project.backgroundFraming ?? settingsForm.state.values.backgroundFraming,
        },
      );
    },
    selectedPreset,
    recentsLimit,
    settingsForm: settingsFormApi,
    exportForm: exportFormApi,
    pingQuery,
    permissionsQuery,
    sourcesQuery,
    captureStatusQuery,
    exportInfoQuery,
    projectQuery,
    projectRecentsQuery,
    eventsQuery,
  });

  const exportResultAction = useMutation({
    mutationFn: (action: "open" | "reveal") => desktopApi.openExportResult(action),
    onError: (error) => setNotice({ kind: "error", message: mapActionErrorMessage(error) }),
  });

  const proposalActionCount = useIsMutating({ mutationKey: studioQueryKeys.agentProposal() });
  const isRunningAction = hasRunningMutation || proposalActionCount > 0;

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

  const runHostCommandUncoordinated = useCallback(
    (command: HostMenuCommand) => {
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
          void toggleRecordingMutation.mutateAsync(undefined);
        },
        captureStartPreview: () => {
          void startPreviewMutation.mutateAsync();
        },
        captureStopPreview: () => {
          void stopPreviewMutation.mutateAsync();
        },
        editUndo: () => {
          const focused = document.activeElement;
          if (focused?.matches("input,textarea,[contenteditable]:not([contenteditable='false'])")) {
            document.execCommand("undo");
          } else {
            undoTimeline();
          }
        },
        editRedo: () => {
          const focused = document.activeElement;
          if (focused?.matches("input,textarea,[contenteditable]:not([contenteditable='false'])")) {
            document.execCommand("redo");
          } else {
            redoTimeline();
          }
        },
        timelinePlayPause: () => {
          toggleTimelinePlayback();
        },
        timelineTrimIn: () => {
          if (activeMode === "capture") {
            return;
          }
          setTrimInFromPlayhead();
        },
        timelineTrimOut: () => {
          if (activeMode === "capture") {
            return;
          }
          setTrimOutFromPlayhead();
        },
        timelineTogglePanel: () => {
          if (activeMode === "capture") {
            return;
          }
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
      })(command);
    },
    [
      undoTimeline,
      redoTimeline,
      exportMutation,
      openProjectMutation,
      refreshMutation,
      saveProjectMutation,
      activeMode,
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

  const runHostCommand = useCallback(
    (command: HostMenuCommand) => {
      if (queryClient.isMutating({ mutationKey: studioQueryKeys.agentProposal() }) > 0) {
        return;
      }
      runHostCommandUncoordinated(command);
    },
    [queryClient, runHostCommandUncoordinated],
  );

  useEffect(() => {
    if (!hasUnsavedProjectEdits) {
      return;
    }
    const protectDraft = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", protectDraft);
    return () => window.removeEventListener("beforeunload", protectDraft);
  }, [hasUnsavedProjectEdits]);

  const clearNotice = useCallback(() => {
    setNotice(null);
  }, []);

  const applyShortcutOverride = useCallback(
    (shortcutId: StudioShortcutId, hotkey: string) => {
      const validation = validateStudioShortcutOverride({
        shortcutId,
        hotkey,
        platform: shortcutPlatform,
        overrides: shortcutOverrides,
      });
      if (!validation.ok) {
        return validation;
      }
      setShortcutOverrides((currentOverrides) =>
        sanitizeStudioShortcutOverrides(
          {
            ...currentOverrides,
            [shortcutId]: validation.hotkey,
          },
          shortcutPlatform,
        ),
      );
      return validation;
    },
    [shortcutOverrides, shortcutPlatform],
  );

  const resetShortcutOverride = useCallback(
    (shortcutId: StudioShortcutId) => {
      setShortcutOverrides((currentOverrides) => {
        if (!currentOverrides[shortcutId]) {
          return currentOverrides;
        }
        const nextOverrides = { ...currentOverrides };
        delete nextOverrides[shortcutId];
        return sanitizeStudioShortcutOverrides(nextOverrides, shortcutPlatform);
      });
    },
    [shortcutPlatform],
  );

  useStudioHotkeys({
    undoTimeline,
    redoTimeline,
    canChangeTimelineHistory:
      Boolean(recordingURL) && !isRunningAction && !captureStatusQuery.data?.isRecording,
    runHostCommand,
    canTrimTimeline: activeMode !== "capture" && Boolean(recordingURL),
    canEditSelectedTimelineClip: activeMode === "edit" && selectedTimelineClip != null,
    singleKeyShortcutsEnabled: settingsValues.singleKeyShortcutsEnabled,
    shortcutOverrides,
    shortcutPlatform,
    clearInspectorSelection,
    clearNotice,
    deleteSelectedTimelineClip,
    liftSelectedTimelineClip,
    setTimelineTool,
  });

  useEffect(() => {
    sendHostMenuState({
      hasUnsavedProjectEdits,
      canSave: !isRunningAction && Boolean(recordingURL),
      canExport: !isRunningAction && Boolean(recordingURL),
      canTrimTimeline: activeMode !== "capture" && !isRunningAction && Boolean(recordingURL),
      canToggleTimeline: activeMode !== "capture",
      isRecording: Boolean(captureStatusQuery.data?.isRecording),
      recordingURL,
      locale,
      densityMode: layout.densityMode,
      shortcutOverrides,
    });
  }, [
    captureStatusQuery.data?.isRecording,
    activeMode,
    isRunningAction,
    hasUnsavedProjectEdits,
    layout.densityMode,
    locale,
    recordingURL,
    shortcutOverrides,
  ]);

  useEffect(() => {
    if (activeMode === "capture" && timelineTool === "trim") {
      setTimelineTool("select");
    }
  }, [activeMode, setTimelineTool, timelineTool]);

  useEffect(() => {
    const onHostMenuCommand = (event: Event) => {
      const customEvent = event as CustomEvent<{ command: HostMenuCommand }>;
      const command = customEvent.detail?.command;
      if (!command) {
        return;
      }
      runHostCommand(command);
    };

    window.addEventListener(hostBridgeEventNames.menuCommand, onHostMenuCommand as EventListener);
    return () =>
      window.removeEventListener(
        hostBridgeEventNames.menuCommand,
        onHostMenuCommand as EventListener,
      );
  }, [runHostCommand]);

  const captureStatusLabel = captureStatusQuery.data?.isRecording
    ? ui.labels.recording
    : captureStatusQuery.data?.isRunning
      ? ui.labels.previewing
      : ui.labels.idle;

  return {
    replacementConfirmation,
    clearNotice,
    recordingMediaSize:
      mediaDuration?.source === recordingURL && mediaDuration.width > 0 && mediaDuration.height > 0
        ? { width: mediaDuration.width, height: mediaDuration.height }
        : null,
    setRecordingMediaDurationSeconds,
    canUndoTimeline: Boolean(recordingURL) && currentHistory.past.length > 0,
    canRedoTimeline: Boolean(recordingURL) && currentHistory.future.length > 0,
    beginVisualEdit: documentHistory.beginVisualEdit,
    commitVisualEdit: documentHistory.commitVisualEdit,
    undoTimeline,
    redoTimeline,
    hasUnsavedProjectEdits,
    backgroundFramingSupported: capabilitiesQuery.data?.export.backgroundFraming === true,
    capabilitiesQuery,
    captureStatusLabel,
    captureStatusQuery,
    exportForm,
    exportMutation,
    exportResultAction,
    exportPresets: presets,
    formatAspectRatio,
    formatDateTime,
    formatDecimal,
    formatDuration,
    formatInteger,
    inputMonitoringDenied,
    isRefreshing,
    isRunningAction,
    sourceAudioPresentation,
    timelineFrameRate,
    previewAudio,
    setPreviewVolume,
    togglePreviewMuted,
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
    playbackStore,
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
    applyShortcutOverride,
    saveProjectMutation,
    selectedPreset,
    selectedPresetId,
    selectedDisplayId,
    selectedWindowId,
    setNotice,
    setAudioMixerGain,
    toggleAudioMixerMuted,
    setPlayheadSeconds: setPlayheadSecondsClamped,
    setDisplayPlayheadSecondsFromMedia,
    setPlayheadSecondsFromMedia,
    setPlaybackRate,
    setTimelinePlaybackActive,
    splitTimelineClipAtSeconds,
    splitSelectedTimelineClipAtPlayhead,
    resetSelectedSceneCamera,
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
    setExportRangeMode,
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
    shortcutOverrides,
    shortcutPlatform,
    supportedCaptureFrameRates,
    deleteSelectedTimelineClip,
    liftSelectedTimelineClip,
    moveSelectedTimelineClipEarlier,
    moveSelectedTimelineClipLater,
    moveTimelineClipByDrop,
    timelineDuration,
    timelineLanes,
    timelineDocument,
    hasUnsavedTimelineEdits:
      timelineContentSignature(timelineDocument) !== baselineTimelineSignature,
    timelineItems,
    timelineSegments,
    toggleRecordingMutation,
    resetShortcutOverride,
    toggleRightPaneCollapsed,
    toggleTimelineCollapsed,
    toggleTimelinePlayback,
    ui,
    displayChoices,
    windowChoices,
    setLeftPaneCollapsed,
  };
}

export type StudioController = ReturnType<typeof useStudioController>;
