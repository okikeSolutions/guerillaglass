import { useEffect, useMemo, useState } from "react";
import { desktopApi } from "@/lib/engine";
import { toMediaSourceURL } from "./mediaSource";

export function useRecordingMediaSource(recordingURL: string | null): string | null {
  const hasDesktopResolver = useMemo(() => {
    const bridgeWindow = window as Window & {
      ggResolveMediaSourceURL?: (...args: unknown[]) => Promise<string>;
    };
    return typeof bridgeWindow.ggResolveMediaSourceURL === "function";
  }, []);
  const fallbackSource = useMemo(() => {
    if (hasDesktopResolver) {
      return null;
    }
    return toMediaSourceURL(recordingURL);
  }, [hasDesktopResolver, recordingURL]);
  const [bridgeResolvedSource, setBridgeResolvedSource] = useState<{
    input: string;
    source: string;
  } | null>(null);

  useEffect(() => {
    let isCancelled = false;
    if (!recordingURL || !hasDesktopResolver) {
      return () => {
        isCancelled = true;
      };
    }

    void desktopApi
      .resolveMediaSourceURL(recordingURL)
      .then((url) => {
        if (isCancelled) {
          return;
        }
        setBridgeResolvedSource({
          input: recordingURL,
          source: url,
        });
      })
      .catch(() => {
        if (isCancelled) {
          return;
        }
        setBridgeResolvedSource(null);
      });

    return () => {
      isCancelled = true;
    };
  }, [fallbackSource, hasDesktopResolver, recordingURL]);

  if (recordingURL && bridgeResolvedSource?.input === recordingURL) {
    return bridgeResolvedSource.source;
  }

  return fallbackSource;
}
