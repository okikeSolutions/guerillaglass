import { useQuery } from "@tanstack/react-query";
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
import { desktopApi, engineApi, parseInputEventLog } from "@/lib/engine";

const emptyProjectRecents: ProjectRecentsResult = { items: [] };
const emptyExportPresets: ExportPreset[] = [];
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

export function useStudioQueries(recentsLimit: number = studioRecentsLimit) {
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

  const timelineEvents = eventsQuery.isSuccess ? eventsQuery.data : [];
  const presets = exportInfoQuery.data?.presets ?? emptyExportPresets;
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
    timelineEvents,
    windowChoices,
  };
}
