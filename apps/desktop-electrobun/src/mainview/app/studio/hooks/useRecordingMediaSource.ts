import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { desktopApi } from "@lib/engine";
import { toMediaSourceURL } from "../domain/mediaSourceUrl";

const recordingMediaSourceQueryKey = (recordingURL: string | null) =>
  ["studio", "recordingMediaSource", recordingURL] as const;

const mediaSourceLeaseStaleMs = 45_000;

type RecordingMediaSourceLease = {
  readonly source: string | null;
  readonly refresh: () => Promise<void>;
};

function hasDesktopMediaResolver(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const bridgeWindow = window as Window & {
    ggResolveMediaSourceURL?: (...args: unknown[]) => Promise<string>;
  };
  return typeof bridgeWindow.ggResolveMediaSourceURL === "function";
}

export function useRecordingMediaSourceLease(
  recordingURL: string | null,
): RecordingMediaSourceLease {
  const hasDesktopResolver = useMemo(() => hasDesktopMediaResolver(), []);
  const fallbackSource = useMemo(() => {
    if (hasDesktopResolver) {
      return null;
    }
    return toMediaSourceURL(recordingURL);
  }, [hasDesktopResolver, recordingURL]);
  const bridgeResolvedSourceQuery = useQuery<string | null>({
    queryKey: recordingMediaSourceQueryKey(recordingURL),
    enabled: Boolean(recordingURL) && hasDesktopResolver,
    queryFn: async () => {
      if (!recordingURL || !hasDesktopResolver) {
        return null;
      }
      try {
        return await desktopApi.resolveMediaSourceURL(recordingURL);
      } catch {
        return null;
      }
    },
    staleTime: mediaSourceLeaseStaleMs,
    gcTime: mediaSourceLeaseStaleMs,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    retry: false,
  });

  const { data: bridgeResolvedSource, refetch } = bridgeResolvedSourceQuery;
  const refresh = useCallback(async () => {
    if (!recordingURL || !hasDesktopResolver) {
      return;
    }
    await refetch();
  }, [hasDesktopResolver, recordingURL, refetch]);

  return {
    source: bridgeResolvedSource ?? fallbackSource,
    refresh,
  };
}

export function useRecordingMediaSource(recordingURL: string | null): string | null {
  return useRecordingMediaSourceLease(recordingURL).source;
}
