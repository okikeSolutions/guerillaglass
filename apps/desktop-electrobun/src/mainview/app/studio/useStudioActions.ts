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
} from "@guerillaglass/engine-protocol";
import type { StudioMessages } from "@guerillaglass/localization";
import { engineApi } from "@/lib/engine";
import { studioQueryKeys } from "./useStudioQueries";

const captureStatusSyncAttempts = 4;
const captureStatusSyncDelayMs = 120;

type CaptureSourceMode = "display" | "window";
type Notice = { kind: "error" | "success" | "info"; message: string } | null;

type RefetchableQuery<TData> = {
  data: TData | undefined;
  isPending: boolean;
  refetch: () => Promise<{ data: TData | undefined }>;
};

export type SettingsFormApi = {
  state: {
    values: {
      captureSource: CaptureSourceMode;
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
  pickDirectorySafely: (startingFolder?: string) => Promise<string | null>;
  selectedWindowId: number;
  inputMonitoringDenied: boolean;
  recordingURL: string | null;
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

export function useStudioActions({
  queryClient,
  ui,
  mapActionErrorMessage,
  setNotice,
  setTimelinePlayback,
  resetPlayhead,
  pickDirectorySafely,
  selectedWindowId,
  inputMonitoringDenied,
  recordingURL,
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
      throw new Error(ui.notices.screenPermissionRequired);
    }

    const nextSources = await engineApi.listSources().catch(() => null);
    if (nextSources) {
      queryClient.setQueryData(studioQueryKeys.sources(), nextSources);
      if (!nextSources.windows.some((windowItem) => windowItem.id === selectedWindowId)) {
        settingsForm.setFieldValue("selectedWindowId", nextSources.windows[0]?.id ?? 0);
      }
    }
  }, [queryClient, selectedWindowId, settingsForm, ui.notices.screenPermissionRequired]);

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

  const startCaptureInternal = useCallback(async (): Promise<CaptureStatusResult> => {
    await ensureScreenRecordingPermission();

    const { captureSource, micEnabled, captureFps } = settingsForm.state.values;
    if (captureSource === "window") {
      if (selectedWindowId === 0) {
        throw new Error(ui.notices.selectWindowFirst);
      }
      return await engineApi.startWindowCapture(selectedWindowId, micEnabled, captureFps);
    }
    return await engineApi.startDisplayCapture(micEnabled, captureFps);
  }, [
    ensureScreenRecordingPermission,
    selectedWindowId,
    settingsForm.state.values,
    ui.notices.selectWindowFirst,
  ]);

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
        message: error instanceof Error ? mapActionErrorMessage(error) : ui.notices.refreshFailed,
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
        queryClient.setQueryData(studioQueryKeys.sources(), nextSources);
        if (!nextSources.windows.some((windowItem) => windowItem.id === selectedWindowId)) {
          settingsForm.setFieldValue("selectedWindowId", nextSources.windows[0]?.id ?? 0);
        }
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
    onSuccess: async ({ nextStatus, finished }) => {
      queryClient.setQueryData(studioQueryKeys.captureStatus(), nextStatus);
      await syncCaptureStatus({ expectRunning: !finished });

      if (finished) {
        setTimelinePlayback(false);
        setNotice({ kind: "success", message: ui.notices.recordingFinished });
        return;
      }

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
      const pickedPath = await pickDirectorySafely(projectQuery.data?.projectPath ?? undefined);
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
        projectPath =
          (await pickDirectorySafely(projectQuery.data?.projectPath ?? undefined)) ?? undefined;
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
      setNotice({ kind: "error", message: mapActionErrorMessage(error) });
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

      const targetDirectory = await pickDirectorySafely(
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
