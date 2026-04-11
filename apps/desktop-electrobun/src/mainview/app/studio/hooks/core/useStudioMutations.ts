import { useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import type {
  AutoZoomSettings,
  CaptureFrameRate,
  CaptureStatusResult,
  ExportPreset,
  PingResult,
  PermissionsResult,
  ProjectRecentsResult,
  ProjectState,
  SourcesResult,
  TimelineDocument,
} from "@guerillaglass/engine-protocol";
import type { StudioMessages } from "@guerillaglass/localization";
import { engineApi } from "@lib/engine";
import type { HostPathPickerMode } from "@shared/bridge";
import {
  CaptureWindowPickerUnsupportedError,
  EngineResponseError,
  StudioActionError,
} from "@shared/errors";
import { resolveSelectedDisplayId } from "../../domain/preferredDisplaySelection";
import { resolveSelectedWindowId } from "../../domain/preferredWindowSelection";
import { studioQueryKeys } from "./useStudioDataQueries";

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
  state: {
    values: {
      captureSource: CaptureSourceMode;
      selectedDisplayId: number;
      selectedWindowId: number;
      captureFps: CaptureFrameRate;
      micEnabled: boolean;
      trackInputEvents: boolean;
      autoZoom: AutoZoomSettings;
    };
  };
  setFieldValue: (...args: unknown[]) => void;
};

export type ExportFormApi = {
  state: {
    values: {
      presetId: string;
      fileName: string;
      trimStartSeconds: number;
      trimEndSeconds: number;
    };
  };
  setFieldValue: (...args: unknown[]) => void;
};

type UseStudioActionsOptions = {
  queryClient: QueryClient;
  ui: StudioMessages;
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
  selectedPreset: ExportPreset | undefined;
  recentsLimit: number;
  settingsForm: SettingsFormApi;
  exportForm: ExportFormApi;
  pingQuery: RefetchableQuery<PingResult>;
  permissionsQuery: RefetchableQuery<PermissionsResult>;
  sourcesQuery: RefetchableQuery<SourcesResult>;
  captureStatusQuery: RefetchableQuery<CaptureStatusResult>;
  exportInfoQuery: RefetchableQuery<{ presets: ExportPreset[] }>;
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
        settingsForm.setFieldValue("selectedDisplayId", nextSelectedDisplayId);
      }
      const nextSelectedWindowId = resolveSelectedWindowId(
        nextSources.windows,
        baselineSelectedWindowId,
      );
      if (nextSelectedWindowId !== baselineSelectedWindowId) {
        settingsForm.setFieldValue("selectedWindowId", nextSelectedWindowId);
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
      } = settingsForm.state.values;
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

  const toggleRecordingMutation = useMutation({
    mutationFn: async (options?: ToggleRecordingOptions) => {
      let status = captureStatusQuery.data;
      if (!status?.isRunning) {
        status = await startCaptureInternal({
          captureSourceOverride: options?.captureSourceOverride,
          preferWindowPicker:
            options?.preferWindowPicker ??
            (settingsForm.state.values.captureSource === "window" && selectedWindowId === 0),
          preferCurrentWindow: options?.preferCurrentWindow,
        });
      }

      if (status?.isRecording) {
        const recordingStopStatus = await engineApi.stopRecording();
        const stoppedStatus = mergeFinishedCaptureStatus(
          await engineApi.stopCapture(),
          recordingStopStatus,
        );
        return {
          nextStatus: stoppedStatus,
          recordingStopStatus,
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
    onSuccess: async ({ nextStatus, recordingStopStatus, finished }) => {
      queryClient.setQueryData(studioQueryKeys.captureStatus(), nextStatus);
      await syncCaptureStatus({ expectRunning: !finished });

      if (finished) {
        const refreshedProject = await engineApi.projectCurrent().catch(() => null);
        const completedRecordingTelemetry = resolveCompletedRecordingTelemetry(
          recordingStopStatus ?? nextStatus,
          refreshedProject,
        );
        queryClient.setQueryData(
          studioQueryKeys.projectCurrent(),
          refreshedProject ??
            ((current: ProjectState | undefined) => {
              if (!current) {
                return current;
              }
              return {
                ...current,
                recordingURL: nextStatus.recordingURL,
                eventsURL: nextStatus.eventsURL,
                captureMetadata: nextStatus.captureMetadata,
                lastRecordingTelemetry: completedRecordingTelemetry,
              };
            }),
        );
        setTimelinePlayback(false);
        clearInspectorSelection();
        setNotice(
          completedRecordingTelemetry
            ? null
            : { kind: "success", message: ui.notices.recordingFinished },
        );
        return;
      }

      queryClient.setQueryData(
        studioQueryKeys.projectCurrent(),
        (current: ProjectState | undefined) => {
          if (!current) {
            return current;
          }
          return {
            ...current,
            lastRecordingTelemetry: null,
          };
        },
      );
      exportForm.setFieldValue("trimStartSeconds", 0);
      exportForm.setFieldValue("trimEndSeconds", 0);
      resetPlayhead();

      if (settingsForm.state.values.trackInputEvents && inputMonitoringDenied) {
        setNotice({ kind: "info", message: ui.notices.inputTrackingDegraded });
      } else {
        setNotice({ kind: "success", message: ui.notices.recordingStarted });
      }
    },
    onError: (error) => {
      setNotice({ kind: "error", message: mapActionErrorMessage(error) });
    },
  });

  const openProjectAtPath = useCallback(async (projectPath: string) => {
    const nextProject = await engineApi.projectOpen(projectPath);
    const nextStatus = await engineApi.captureStatus();
    return { nextProject, nextStatus };
  }, []);

  const openProjectMutation = useMutation({
    mutationFn: async () => {
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
      queryClient.setQueryData(studioQueryKeys.projectCurrent(), data.nextProject);
      queryClient.setQueryData(studioQueryKeys.captureStatus(), data.nextStatus);
      void queryClient.invalidateQueries({
        queryKey: studioQueryKeys.projectRecents(recentsLimit),
      });
      clearInspectorSelection();
      setNotice({ kind: "success", message: ui.notices.projectOpened });
    },
    onError: (error) => {
      setNotice({ kind: "error", message: mapActionErrorMessage(error) });
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
      clearInspectorSelection();
      setNotice({ kind: "success", message: ui.notices.projectOpened });
    },
    onError: (error) => {
      setNotice({ kind: "error", message: mapActionErrorMessage(error) });
    },
  });

  const saveProjectMutation = useMutation({
    mutationFn: async (saveAs: boolean) => {
      let projectPath = projectQuery.data?.projectPath ?? undefined;
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
        autoZoom: settingsForm.state.values.autoZoom,
        timeline: timelineDocument,
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

      const targetDirectory = await pickPathSafely({
        mode: "export",
        startingFolder: projectQuery.data?.projectPath ?? undefined,
      });
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
        timeline: timelineDocument,
      });
    },
    onSuccess: (result) => {
      if (!result) {
        return;
      }
      setNotice({ kind: "success", message: ui.notices.exportComplete(result.outputURL) });
    },
    onError: (error) => {
      setNotice({ kind: "error", message: mapActionErrorMessage(error) });
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
