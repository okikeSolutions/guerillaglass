import type { ReplacementKind } from "../useReplacementConfirmation";
import * as m from "../../../../../paraglide/messages.js";
import { useCallback, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import type { CaptureStatusResult } from "@guerillaglass/engine-contract/domains/capture";
import type { ExportPreset } from "@guerillaglass/engine-contract/domains/export";
import type { PermissionsResult } from "@guerillaglass/engine-contract/domains/permissions";
import type {
  ProjectRecentsResult,
  ProjectState,
} from "@guerillaglass/engine-contract/domains/project";
import type {
  CaptureFrameRate,
  SourcesResult,
} from "@guerillaglass/engine-contract/domains/sources";
import type { PingResult } from "@guerillaglass/engine-contract/domains/system";
import type {
  AutoZoomSettings,
  BackgroundFramingSettings,
  TimelineDocument,
} from "@guerillaglass/engine-contract/shared/valueObjects";
import type { StudioMessages, StudioLocale } from "@shared/localization";
import { engineApi } from "@lib/engine";
import type { HostPathPickerMode } from "@shared/bridge/desktopBridgeContract";
import {
  CaptureWindowPickerUnsupportedError,
  StudioActionError,
} from "@shared/errors/desktopErrors";
import { EngineResponseError } from "@guerillaglass/engine-client/errors";
import { resolveSelectedDisplayId } from "../../domain/preferredDisplaySelection";
import { resolveSelectedWindowId } from "../../domain/preferredWindowSelection";
import { studioQueryKeys } from "./useStudioDataQueries";

import { compileTimelineItems, timelineDurationSeconds } from "../../domain/timelineDomainModel";

class ExportRangeError extends Error {}

const captureStatusSyncAttempts = 4;
const captureStatusSyncDelayMs = 120;

type CaptureSourceMode = "display" | "window";
type Notice = { kind: "error" | "success" | "info"; message: string } | null;

type RefetchableQuery<TData> = {
  data: TData | undefined;
  isPending: boolean;
  refetch: () => Promise<{ data: TData | undefined }>;
};

type ToggleRecordingOptions = {
  captureSourceOverride?: CaptureSourceMode;
  preferWindowPicker?: boolean;
  preferCurrentWindow?: boolean;
};

export function resolveCompletedRecordingTelemetry(
  status: Pick<CaptureStatusResult, "lastRecordingTelemetry">,
  project: Pick<ProjectState, "lastRecordingTelemetry"> | null | undefined,
) {
  return status.lastRecordingTelemetry ?? project?.lastRecordingTelemetry ?? null;
}

export function mergeFinishedCaptureStatus(
  stoppedStatus: CaptureStatusResult,
  recordingStopStatus: Pick<CaptureStatusResult, "lastRecordingTelemetry"> | null | undefined,
): CaptureStatusResult {
  if (stoppedStatus.lastRecordingTelemetry || !recordingStopStatus?.lastRecordingTelemetry) {
    return stoppedStatus;
  }

  return {
    ...stoppedStatus,
    lastRecordingTelemetry: recordingStopStatus.lastRecordingTelemetry,
  };
}

export type SettingsFormApi = {
  getValues: () => {
    captureSource: CaptureSourceMode;
    selectedDisplayId: number;
    selectedWindowId: number;
    captureFps: CaptureFrameRate;
    micEnabled: boolean;
    trackInputEvents: boolean;
    autoZoom: AutoZoomSettings;
    backgroundFraming: BackgroundFramingSettings;
  };
  setSelectedDisplayId: (value: number) => void;
  setSelectedWindowId: (value: number) => void;
};

export type ExportFormApi = {
  getValues: () => {
    presetId: string;
    fileName: string;
    rangeMode: "full" | "selected";
    trimStartSeconds: number;
    trimEndSeconds: number;
  };
  setRangeMode: (value: "full" | "selected") => void;
  setTrimStartSeconds: (value: number) => void;
  setTrimEndSeconds: (value: number) => void;
};

type UseStudioActionsOptions = {
  queryClient: QueryClient;
  ui: StudioMessages;
  locale?: StudioLocale;
  mapActionErrorMessage: (error: unknown) => string;
  setNotice: (next: Notice) => void;
  setTimelinePlayback: (isPlaying: boolean) => void;
  resetPlayhead: () => void;
  clearInspectorSelection: () => void;
  pickPathSafely: (params: {
    mode: HostPathPickerMode;
    startingFolder?: string;
  }) => Promise<string | null>;
  selectedDisplayId: number;
  selectedWindowId: number;
  inputMonitoringDenied: boolean;
  recordingURL: string | null;
  timelineDocument: TimelineDocument;
  hasUnsavedProjectEdits?: boolean;
  requestReplacementConfirmation: (kind: ReplacementKind) => Promise<boolean>;
  onProjectOpened?: () => void;
  onProjectSaved?: (project: ProjectState) => void;
  onRecordingStarted?: () => void;
  selectedPreset: ExportPreset | undefined;
  recentsLimit: number;
  settingsForm: SettingsFormApi;
  exportForm: ExportFormApi;
  pingQuery: RefetchableQuery<PingResult>;
  permissionsQuery: RefetchableQuery<PermissionsResult>;
  sourcesQuery: RefetchableQuery<SourcesResult>;
  captureStatusQuery: RefetchableQuery<CaptureStatusResult>;
  exportInfoQuery: RefetchableQuery<{ presets: ReadonlyArray<ExportPreset> }>;
  projectQuery: RefetchableQuery<ProjectState>;
  projectRecentsQuery: RefetchableQuery<ProjectRecentsResult>;
  eventsQuery: RefetchableQuery<unknown[]>;
};

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export function isSelectedWindowUnavailableError(error: unknown): boolean {
  return (
    error instanceof EngineResponseError &&
    error.code === "runtime_error" &&
    /selected window is no longer available for capture/i.test(error.description)
  );
}

export function useStudioMutations({
  queryClient,
  ui,
  locale = "en-US",
  mapActionErrorMessage,
  setNotice,
  setTimelinePlayback,
  resetPlayhead,
  clearInspectorSelection,
  pickPathSafely,
  selectedDisplayId,
  selectedWindowId,
  inputMonitoringDenied,
  recordingURL,
  timelineDocument,
  hasUnsavedProjectEdits = false,
  requestReplacementConfirmation,
  onProjectOpened,
  onProjectSaved,
  onRecordingStarted,
  selectedPreset,
  recentsLimit,
  settingsForm,
  exportForm,
  pingQuery,
  permissionsQuery,
  sourcesQuery,
  captureStatusQuery,
  exportInfoQuery,
  projectQuery,
  projectRecentsQuery,
  eventsQuery,
}: UseStudioActionsOptions) {
  const confirmReplacement = useCallback(
    async (kind: ReplacementKind) => {
      if (queryClient.isMutating() > 1) {
        return false;
      }
      const existingWork = Boolean(recordingURL || projectQuery.data?.projectPath);
      if (!hasUnsavedProjectEdits || (kind === "recording" && !existingWork)) {
        return true;
      }
      return await requestReplacementConfirmation(kind);
    },
    [
      hasUnsavedProjectEdits,
      recordingURL,
      projectQuery.data?.projectPath,
      queryClient,
      requestReplacementConfirmation,
    ],
  );

  const reconcileSourcesAndSelection = useCallback(
    (
      nextSources: SourcesResult,
      baselineSelectedDisplayId = selectedDisplayId,
      baselineSelectedWindowId = selectedWindowId,
    ) => {
      queryClient.setQueryData(studioQueryKeys.sources(), nextSources);
      const nextSelectedDisplayId = resolveSelectedDisplayId(
        nextSources.displays,
        baselineSelectedDisplayId,
      );
      if (nextSelectedDisplayId !== baselineSelectedDisplayId) {
        settingsForm.setSelectedDisplayId(nextSelectedDisplayId);
      }
      const nextSelectedWindowId = resolveSelectedWindowId(
        nextSources.windows,
        baselineSelectedWindowId,
      );
      if (nextSelectedWindowId !== baselineSelectedWindowId) {
        settingsForm.setSelectedWindowId(nextSelectedWindowId);
      }
      return {
        selectedDisplayId: nextSelectedDisplayId,
        selectedWindowId: nextSelectedWindowId,
      };
    },
    [queryClient, selectedDisplayId, selectedWindowId, settingsForm],
  );

  const reconcileSourcesAndSelectedWindow = useCallback(
    (nextSources: SourcesResult, baselineSelectedWindowId = selectedWindowId): number => {
      return reconcileSourcesAndSelection(nextSources, selectedDisplayId, baselineSelectedWindowId)
        .selectedWindowId;
    },
    [reconcileSourcesAndSelection, selectedDisplayId, selectedWindowId],
  );

  const ensureScreenRecordingPermission = useCallback(async (): Promise<void> => {
    let permissions = await engineApi.getPermissions();
    queryClient.setQueryData(studioQueryKeys.permissions(), permissions);
    if (permissions.screenRecordingGranted) {
      return;
    }

    await engineApi.requestScreenRecordingPermission();
    permissions = await engineApi.getPermissions();
    queryClient.setQueryData(studioQueryKeys.permissions(), permissions);
    if (!permissions.screenRecordingGranted) {
      throw new StudioActionError({ reason: "screen_permission_required" });
    }

    const nextSources = await engineApi.listSources().catch(() => null);
    if (nextSources) {
      reconcileSourcesAndSelection(nextSources);
    }
  }, [queryClient, reconcileSourcesAndSelection]);

  const syncCaptureStatus = useCallback(
    async (options?: { expectRunning?: boolean }): Promise<CaptureStatusResult | null> => {
      for (let attempt = 0; attempt < captureStatusSyncAttempts; attempt += 1) {
        const nextStatus = await engineApi.captureStatus();
        queryClient.setQueryData(studioQueryKeys.captureStatus(), nextStatus);

        if (
          options?.expectRunning === undefined ||
          nextStatus.isRunning === options.expectRunning
        ) {
          return nextStatus;
        }

        if (attempt < captureStatusSyncAttempts - 1) {
          await delay(captureStatusSyncDelayMs);
        }
      }
      return null;
    },
    [queryClient],
  );

  const startCaptureInternal = useCallback(
    async (options?: {
      captureSourceOverride?: CaptureSourceMode;
      preferWindowPicker?: boolean;
      preferCurrentWindow?: boolean;
    }): Promise<CaptureStatusResult> => {
      await ensureScreenRecordingPermission();

      const {
        captureSource: configuredCaptureSource,
        selectedDisplayId: configuredDisplayId,
        micEnabled,
        captureFps,
      } = settingsForm.getValues();
      const captureSource = options?.captureSourceOverride ?? configuredCaptureSource;
      if (captureSource === "window") {
        if (options?.preferCurrentWindow) {
          return await engineApi.startCurrentWindowCapture(micEnabled, captureFps);
        }

        let resolvedWindowId = selectedWindowId;
        const refreshedSources = await engineApi.listSources().catch(() => null);
        if (refreshedSources) {
          resolvedWindowId = reconcileSourcesAndSelectedWindow(refreshedSources, resolvedWindowId);
        }

        if (resolvedWindowId !== 0 && !options?.preferWindowPicker) {
          try {
            return await engineApi.startWindowCapture(resolvedWindowId, micEnabled, captureFps);
          } catch (error) {
            if (!isSelectedWindowUnavailableError(error)) {
              throw error;
            }

            const retriedSources = await engineApi.listSources().catch(() => null);
            if (retriedSources) {
              const retriedWindowId = reconcileSourcesAndSelectedWindow(
                retriedSources,
                resolvedWindowId,
              );
              if (retriedWindowId !== 0 && retriedWindowId !== resolvedWindowId) {
                return await engineApi.startWindowCapture(retriedWindowId, micEnabled, captureFps);
              }
            }

            return await engineApi.startCurrentWindowCapture(micEnabled, captureFps);
          }
        }

        if (resolvedWindowId === 0 && !options?.preferWindowPicker) {
          return await engineApi.startCurrentWindowCapture(micEnabled, captureFps);
        }

        try {
          return await engineApi.startWindowCapture(0, micEnabled, captureFps);
        } catch (error) {
          if (!(error instanceof CaptureWindowPickerUnsupportedError)) {
            throw error;
          }
          if (resolvedWindowId === 0) {
            throw new StudioActionError({ reason: "window_selection_required" });
          }
          return await engineApi.startWindowCapture(resolvedWindowId, micEnabled, captureFps);
        }
      }
      let resolvedDisplayId = configuredDisplayId || selectedDisplayId;
      if (resolvedDisplayId === 0) {
        const refreshedSources = await engineApi.listSources().catch(() => null);
        if (refreshedSources) {
          resolvedDisplayId = reconcileSourcesAndSelection(
            refreshedSources,
            resolvedDisplayId,
            selectedWindowId,
          ).selectedDisplayId;
        }
      }
      return await engineApi.startDisplayCapture(
        micEnabled,
        captureFps,
        resolvedDisplayId === 0 ? undefined : resolvedDisplayId,
      );
    },
    [
      ensureScreenRecordingPermission,
      reconcileSourcesAndSelection,
      reconcileSourcesAndSelectedWindow,
      selectedDisplayId,
      selectedWindowId,
      settingsForm,
    ],
  );

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
        projectRecents: projectRecents.data ?? { items: [] },
      };
    },
    onError: (error) => {
      setNotice({
        kind: "error",
        message: mapActionErrorMessage(error),
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
      const [nextPermissions, nextSources] = await Promise.all([
        engineApi.getPermissions(),
        kind === "screen" ? engineApi.listSources().catch(() => null) : Promise.resolve(null),
      ]);
      queryClient.setQueryData(studioQueryKeys.permissions(), nextPermissions);
      if (nextSources) {
        reconcileSourcesAndSelectedWindow(nextSources);
      }
      return nextPermissions;
    },
    onSuccess: () => {
      setNotice({ kind: "success", message: ui.notices.permissionsRefreshed });
    },
    onError: (error) => {
      setNotice({ kind: "error", message: mapActionErrorMessage(error) });
    },
  });

  const startPreviewMutation = useMutation({
    mutationFn: async () => await startCaptureInternal(),
    onSuccess: async (nextStatus) => {
      queryClient.setQueryData(studioQueryKeys.captureStatus(), nextStatus);
      const syncedStatus = await syncCaptureStatus({ expectRunning: true });
      if (!syncedStatus?.isRunning) {
        setNotice({
          kind: "error",
          message: ui.notices.previewStateMismatch,
        });
        return;
      }
      setNotice({ kind: "success", message: ui.notices.captureStarted });
    },
    onError: (error) => {
      setNotice({ kind: "error", message: mapActionErrorMessage(error) });
    },
  });

  const stopPreviewMutation = useMutation({
    mutationFn: async () => await engineApi.stopCapture(),
    onSuccess: async (nextStatus) => {
      queryClient.setQueryData(studioQueryKeys.captureStatus(), nextStatus);
      setTimelinePlayback(false);
      await syncCaptureStatus({ expectRunning: false });
      setNotice({ kind: "info", message: ui.notices.captureStopped });
    },
    onError: (error) => {
      setNotice({ kind: "error", message: mapActionErrorMessage(error) });
    },
  });

  const recordingTransitionActive = useRef(false);
  const toggleRecordingMutation = useMutation({
    mutationFn: async (options?: ToggleRecordingOptions) => {
      if (recordingTransitionActive.current) {
        return null;
      }
      recordingTransitionActive.current = true;
      try {
        let status = captureStatusQuery.data;
        if (!status?.isRecording && !(await confirmReplacement("recording"))) {
          recordingTransitionActive.current = false;
          return null;
        }
        const visualSettings = {
          autoZoom: settingsForm.getValues().autoZoom,
          backgroundFraming: settingsForm.getValues().backgroundFraming,
        };
        if (!status?.isRecording) {
          // Preview configuration is immutable in the native engine. Record
          // must acquire the requested source/audio setup, including header
          // shortcuts that choose another source while preview is running.
          if (status?.isRunning) {
            status = await engineApi.stopCapture();
            queryClient.setQueryData(studioQueryKeys.captureStatus(), status);
          }
          status = await startCaptureInternal({
            captureSourceOverride: options?.captureSourceOverride,
            preferWindowPicker:
              options?.preferWindowPicker ??
              (settingsForm.getValues().captureSource === "window" && selectedWindowId === 0),
            preferCurrentWindow: options?.preferCurrentWindow,
          });
        }
        if (status?.isRecording) {
          const recordingStopStatus = await engineApi.stopRecording();
          // The take is finished even if stopping the live preview fails.
          queryClient.setQueryData(studioQueryKeys.captureStatus(), recordingStopStatus);
          let stoppedStatus = recordingStopStatus;
          let previewStopFailed = false;
          try {
            stoppedStatus = mergeFinishedCaptureStatus(
              await engineApi.stopCapture(),
              recordingStopStatus,
            );
          } catch {
            previewStopFailed = true;
          }
          return {
            nextStatus: stoppedStatus,
            recordingStopStatus,
            finished: true as const,
            visualSettings,
            previewStopFailed,
          };
        }
        const recordingStatus = await engineApi.startRecording(
          settingsForm.getValues().trackInputEvents,
        );
        return { nextStatus: recordingStatus, finished: false as const, visualSettings };
      } catch (error) {
        recordingTransitionActive.current = false;
        throw error;
      }
    },
    onSuccess: async (data) => {
      if (!data) {
        return;
      }
      try {
        const { nextStatus, finished, visualSettings } = data;
        queryClient.setQueryData(studioQueryKeys.captureStatus(), nextStatus);
        // The successful native result establishes new ownership. Commit it
        // before any status/project reconciliation can fail or block.
        if (!finished) {
          exportMutation.reset();
          queryClient.setQueryData<ProjectState>(studioQueryKeys.projectCurrent(), {
            ...(nextStatus.recordingURL ? { recordingURL: nextStatus.recordingURL } : {}),
            ...(nextStatus.eventsURL ? { eventsURL: nextStatus.eventsURL } : {}),
            ...(nextStatus.captureMetadata ? { captureMetadata: nextStatus.captureMetadata } : {}),
            ...visualSettings,
            timeline: { version: 2, items: [] },
          });
          onRecordingStarted?.();
          clearInspectorSelection();
          setTimelinePlayback(false);
          exportForm.setRangeMode("full");
          exportForm.setTrimStartSeconds(0);
          exportForm.setTrimEndSeconds(0);
          resetPlayhead();
        }
        const [statusRefresh, projectRefresh] = await Promise.allSettled([
          syncCaptureStatus({ expectRunning: !finished }),
          engineApi.projectCurrent(),
        ]);
        const refreshedProject =
          projectRefresh.status === "fulfilled"
            ? { ...projectRefresh.value, ...visualSettings }
            : null;
        if (refreshedProject) {
          queryClient.setQueryData(studioQueryKeys.projectCurrent(), refreshedProject);
        }
        if (finished) {
          const completedRecordingTelemetry = resolveCompletedRecordingTelemetry(
            data.recordingStopStatus ?? nextStatus,
            refreshedProject,
          );
          if (!refreshedProject) {
            queryClient.setQueryData(
              studioQueryKeys.projectCurrent(),
              (current: ProjectState | undefined) =>
                current
                  ? {
                      ...current,
                      ...visualSettings,
                      recordingURL: nextStatus.recordingURL,
                      eventsURL: nextStatus.eventsURL,
                      captureMetadata: nextStatus.captureMetadata,
                      lastRecordingTelemetry: completedRecordingTelemetry,
                    }
                  : current,
            );
          }
          setTimelinePlayback(false);
          clearInspectorSelection();
          setNotice(
            data.previewStopFailed
              ? {
                  kind: "info",
                  message: m.ui_capture_finished_preview_failed(undefined, { locale }),
                }
              : statusRefresh.status === "rejected" || projectRefresh.status === "rejected"
                ? {
                    kind: "info",
                    message: m.ui_capture_finished_refresh_failed(undefined, { locale }),
                  }
                : completedRecordingTelemetry
                  ? null
                  : { kind: "success", message: ui.notices.recordingFinished },
          );
          return;
        }
        if (statusRefresh.status === "rejected" || projectRefresh.status === "rejected") {
          setNotice({
            kind: "info",
            message: m.ui_capture_started_refresh_failed(undefined, { locale }),
          });
        } else if (settingsForm.getValues().trackInputEvents && inputMonitoringDenied) {
          setNotice({ kind: "info", message: ui.notices.inputTrackingDegraded });
        } else {
          setNotice({ kind: "success", message: ui.notices.recordingStarted });
        }
      } finally {
        recordingTransitionActive.current = false;
      }
    },
    onError: (error) => {
      setNotice({ kind: "error", message: mapActionErrorMessage(error) });
    },
  });

  const openProjectAtPath = useCallback(async (projectPath: string) => {
    const nextProject = await engineApi.projectOpen(projectPath);
    // Project Open already committed. A failed status poll must not hide that
    // authoritative document or leave the replaced draft attached to it.
    const nextStatus = await engineApi.captureStatus().catch(() => null);
    return { nextProject, nextStatus };
  }, []);

  const openProjectMutation = useMutation({
    mutationFn: async () => {
      if (!(await confirmReplacement("project"))) {
        return null;
      }
      const pickedPath = await pickPathSafely({
        mode: "openProject",
        startingFolder: projectQuery.data?.projectPath ?? undefined,
      });
      if (!pickedPath) {
        return null;
      }
      return await openProjectAtPath(pickedPath);
    },
    onSuccess: (data) => {
      if (!data) {
        return;
      }
      onProjectOpened?.();
      exportMutation.reset();
      exportForm.setRangeMode("full");
      exportForm.setTrimStartSeconds(0);
      exportForm.setTrimEndSeconds(0);
      setTimelinePlayback(false);
      resetPlayhead();
      queryClient.setQueryData(studioQueryKeys.projectCurrent(), data.nextProject);
      if (data.nextStatus) {
        queryClient.setQueryData(studioQueryKeys.captureStatus(), data.nextStatus);
      } else {
        void queryClient.invalidateQueries({ queryKey: studioQueryKeys.captureStatus() });
      }
      void queryClient.invalidateQueries({
        queryKey: studioQueryKeys.projectRecents(recentsLimit),
      });
      clearInspectorSelection();
      setNotice({
        kind: data.nextStatus ? "success" : "info",
        message: data.nextStatus
          ? ui.notices.projectOpened
          : m.ui_project_opened_status_unavailable(undefined, { locale }),
      });
    },
    onError: (error) => {
      setNotice({ kind: "error", message: mapActionErrorMessage(error) });
    },
  });

  const openRecentProjectMutation = useMutation({
    mutationFn: async (projectPath: string) => {
      if (!(await confirmReplacement("project"))) {
        return null;
      }
      // Recent metadata is not filesystem authority. A native picker must grant
      // the package again in this host session before opening it.
      const selected = await pickPathSafely({ mode: "openProject", startingFolder: projectPath });
      return selected ? await openProjectAtPath(selected) : null;
    },
    onSuccess: (data) => {
      if (!data) {
        return;
      }
      onProjectOpened?.();
      exportMutation.reset();
      exportForm.setRangeMode("full");
      exportForm.setTrimStartSeconds(0);
      exportForm.setTrimEndSeconds(0);
      setTimelinePlayback(false);
      resetPlayhead();
      queryClient.setQueryData(studioQueryKeys.projectCurrent(), data.nextProject);
      if (data.nextStatus) {
        queryClient.setQueryData(studioQueryKeys.captureStatus(), data.nextStatus);
      } else {
        void queryClient.invalidateQueries({ queryKey: studioQueryKeys.captureStatus() });
      }
      void queryClient.invalidateQueries({
        queryKey: studioQueryKeys.projectRecents(recentsLimit),
      });
      clearInspectorSelection();
      setNotice({
        kind: data.nextStatus ? "success" : "info",
        message: data.nextStatus
          ? ui.notices.projectOpened
          : m.ui_project_opened_status_unavailable(undefined, { locale }),
      });
    },
    onError: (error) => {
      setNotice({ kind: "error", message: mapActionErrorMessage(error) });
    },
  });

  const saveProjectMutation = useMutation({
    mutationFn: async (saveAs: boolean) => {
      if (recordingURL && timelineDocument.items.length === 0) {
        throw new Error(m.ui_safety_empty_save(undefined, { locale }));
      }
      let projectPath: string | undefined = projectQuery.data?.projectPath ?? undefined;
      if (saveAs || !projectPath) {
        const pickedPath = await pickPathSafely({
          mode: "saveProjectAs",
          startingFolder: projectQuery.data?.projectPath ?? undefined,
        });
        if (!pickedPath) {
          return null;
        }
        projectPath = pickedPath;
        setNotice({ kind: "info", message: ui.notices.projectSaveTarget(projectPath) });
      }
      if (!projectPath) {
        return null;
      }
      const nextProject = await engineApi.projectSave({
        projectPath,
        autoZoom: settingsForm.getValues().autoZoom,
        backgroundFraming: settingsForm.getValues().backgroundFraming,
        timeline: timelineDocument,
      });
      return nextProject;
    },
    onSuccess: (nextProject) => {
      if (!nextProject) {
        return;
      }
      onProjectSaved?.(nextProject);
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
      setNotice({ kind: "error", message: mapActionErrorMessage(error) });
    },
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      if (!recordingURL) {
        throw new StudioActionError({ reason: "export_missing_recording" });
      }
      if (!selectedPreset) {
        throw new StudioActionError({ reason: "export_missing_preset" });
      }

      const values = exportForm.getValues();
      const duration = timelineDurationSeconds(compileTimelineItems(timelineDocument));
      const trimStart = values.rangeMode === "selected" ? values.trimStartSeconds : undefined;
      const trimEnd = values.rangeMode === "selected" ? values.trimEndSeconds : undefined;
      if (
        duration <= 0 ||
        (values.rangeMode === "selected" &&
          (!Number.isFinite(values.trimStartSeconds) ||
            !Number.isFinite(values.trimEndSeconds) ||
            values.trimStartSeconds < 0 ||
            values.trimEndSeconds <= values.trimStartSeconds ||
            values.trimEndSeconds > duration))
      ) {
        throw new ExportRangeError(m.ui_workflow_invalid_range(undefined, { locale }));
      }

      const targetDirectory = await pickPathSafely({
        mode: "export",
        startingFolder: projectQuery.data?.projectPath ?? undefined,
      });
      if (!targetDirectory) {
        return null;
      }

      const extension = selectedPreset.fileType;
      const safeFileName =
        values.fileName.trim().length > 0 ? values.fileName.trim() : "guerillaglass-export";

      const outputURL = `${targetDirectory.replace(/[\\/]$/, "")}/${safeFileName}.${extension}`;
      const result = await engineApi.runExport({
        outputURL,
        presetId: selectedPreset.id,
        ...(trimStart === undefined ? {} : { trimStartSeconds: trimStart }),
        ...(trimEnd === undefined ? {} : { trimEndSeconds: trimEnd }),
        timeline: timelineDocument,
        autoZoom: settingsForm.getValues().autoZoom,
        backgroundFraming: settingsForm.getValues().backgroundFraming,
      });
      return { ...result, outputURL: result.outputURL ?? outputURL };
    },
    onSuccess: (result) => {
      if (!result) {
        return;
      }
      setNotice({
        kind:
          result.status === "failed" ? "error" : result.status === "succeeded" ? "success" : "info",
        message:
          result.status === "succeeded"
            ? m.ui_io_export_complete(undefined, { locale })
            : result.status === "failed"
              ? m.ui_io_export_failed(undefined, { locale })
              : result.status === "queued"
                ? m.ui_io_export_queued(undefined, { locale })
                : m.ui_io_export_running(undefined, { locale }),
      });
    },
    onError: (error) => {
      setNotice({
        kind: "error",
        message: error instanceof ExportRangeError ? error.message : mapActionErrorMessage(error),
      });
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

  const refreshAll = useCallback(async () => {
    await refreshMutation.mutateAsync();
  }, [refreshMutation]);

  return {
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
  };
}
