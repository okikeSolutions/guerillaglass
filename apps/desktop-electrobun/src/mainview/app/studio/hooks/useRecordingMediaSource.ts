import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { desktopApi } from "@/lib/engine";
import { toMediaSourceURL } from "../model/mediaSourceUrl";

const recordingMediaSourceQueryKey = (recordingURL: string | null) =>
  ["studio", "recordingMediaSource", recordingURL] as const;

function hasDesktopMediaResolver(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const bridgeWindow = window as Window & {
    ggResolveMediaSourceURL?: (...args: unknown[]) => Promise<string>;
  };
  return typeof bridgeWindow.ggResolveMediaSourceURL === "function";
}

export function useRecordingMediaSource(recordingURL: string | null): string | null {
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
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });

  return bridgeResolvedSourceQuery.data ?? fallbackSource;
}
