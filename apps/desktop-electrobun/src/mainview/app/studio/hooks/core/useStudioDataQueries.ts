import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CaptureStatusResult,
  ExportPreset,
  InputEvent,
  PermissionsResult,
  PingResult,
  ProjectRecentsResult,
  ProjectState,
  SourcesResult,
} from "@guerillaglass/engine-protocol";
import { captureStatusResultSchema } from "@guerillaglass/engine-protocol";
import { hostBridgeEventNames } from "@shared/bridge";
import { decodeUnknownWithSchemaSync } from "@shared/errors";
import { desktopApi, engineApi, parseInputEventLog } from "@lib/engine";

const emptyProjectRecents: ProjectRecentsResult = { items: [] };
const emptyExportPresets: ExportPreset[] = [];
const emptySourceDisplays: SourcesResult["displays"] = [];
const emptySourceWindows: SourcesResult["windows"] = [];

export const studioQueryKeys = {
  ping: () => ["studio", "ping"] as const,
  permissions: () => ["studio", "permissions"] as const,
  sources: () => ["studio", "sources"] as const,
  captureStatus: () => ["studio", "captureStatus"] as const,
  exportInfo: () => ["studio", "exportInfo"] as const,
  projectCurrent: () => ["studio", "projectCurrent"] as const,
  projectRecents: (limit: number) => ["studio", "projectRecents", limit] as const,
  eventsLog: (eventsURL: string | null) => ["studio", "eventsLog", eventsURL] as const,
};

export const studioRecentsLimit = 10;

export function parseCaptureStatusEvent(event: Event): CaptureStatusResult | null {
  const customEvent = event as CustomEvent<{ captureStatus?: unknown }>;
  const payload = customEvent.detail?.captureStatus;
  if (!payload) {
    return null;
  }

  try {
    return decodeUnknownWithSchemaSync(
      captureStatusResultSchema,
      payload,
      "capture status event",
    ) as CaptureStatusResult;
  } catch {
    return null;
  }
}

export function captureStatusResultsEqual(
  previous: CaptureStatusResult | undefined,
  next: CaptureStatusResult,
): boolean {
  if (!previous) {
    return false;
  }
  return JSON.stringify(previous) === JSON.stringify(next);
}

type UseStudioDataQueriesOptions = {
  recentsLimit?: number;
  subscribeToCaptureStatus?: boolean;
};

export function useStudioDataQueries({
  recentsLimit = studioRecentsLimit,
  subscribeToCaptureStatus = true,
}: UseStudioDataQueriesOptions = {}) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const onCaptureStatus = (event: Event) => {
      const captureStatus = parseCaptureStatusEvent(event);
      if (!captureStatus) {
        return;
      }
      const current = queryClient.getQueryData<CaptureStatusResult>(
        studioQueryKeys.captureStatus(),
      );
      if (captureStatusResultsEqual(current, captureStatus)) {
        return;
      }
      queryClient.setQueryData(studioQueryKeys.captureStatus(), captureStatus);
    };

    window.addEventListener(hostBridgeEventNames.captureStatus, onCaptureStatus as EventListener);
    return () => {
      window.removeEventListener(
        hostBridgeEventNames.captureStatus,
        onCaptureStatus as EventListener,
      );
    };
  }, [queryClient]);

  const pingQuery = useQuery<PingResult>({
    queryKey: studioQueryKeys.ping(),
    queryFn: () => engineApi.ping(),
    staleTime: 30_000,
  });

  const permissionsQuery = useQuery<PermissionsResult>({
    queryKey: studioQueryKeys.permissions(),
    queryFn: () => engineApi.getPermissions(),
    staleTime: Number.POSITIVE_INFINITY,
  });

  const sourcesQuery = useQuery<SourcesResult>({
    queryKey: studioQueryKeys.sources(),
    queryFn: () => engineApi.listSources(),
    staleTime: Number.POSITIVE_INFINITY,
  });

  const captureStatusQuery = useQuery<CaptureStatusResult>({
    queryKey: studioQueryKeys.captureStatus(),
    queryFn: () => engineApi.captureStatus(),
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
    subscribed: subscribeToCaptureStatus,
  });

  const exportInfoQuery = useQuery({
    queryKey: studioQueryKeys.exportInfo(),
    queryFn: () => engineApi.exportInfo(),
    staleTime: Number.POSITIVE_INFINITY,
  });

  const projectQuery = useQuery<ProjectState>({
    queryKey: studioQueryKeys.projectCurrent(),
    queryFn: () => engineApi.projectCurrent(),
    staleTime: Number.POSITIVE_INFINITY,
  });

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
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });

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
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });

  const timelineEvents = eventsQuery.isSuccess ? eventsQuery.data : [];
  const presets = exportInfoQuery.data?.presets ?? emptyExportPresets;
  const displayChoices = sourcesQuery.data?.displays ?? emptySourceDisplays;
  const windowChoices = sourcesQuery.data?.windows ?? emptySourceWindows;

  return {
    captureStatusQuery,
    eventsQuery,
    eventsURL,
    exportInfoQuery,
    permissionsQuery,
    pingQuery,
    presets,
    projectQuery,
    projectRecentsQuery,
    recordingURL,
    sourcesQuery,
    displayChoices,
    timelineEvents,
    windowChoices,
  };
}
