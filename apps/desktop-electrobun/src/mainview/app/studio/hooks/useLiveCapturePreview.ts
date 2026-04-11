import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { useQuery } from "@tanstack/react-query";
import { desktopApi } from "@lib/engine";

const liveCapturePreviewPollMs = 125;

type LiveCapturePreviewState = {
  hasFrame: boolean;
  imageRef: MutableRefObject<HTMLImageElement | null>;
};

function hasDesktopPreviewResolver(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const bridgeWindow = window as Window & {
    ggResolveCapturePreviewURL?: () => Promise<string>;
  };
  return typeof bridgeWindow.ggResolveCapturePreviewURL === "function";
}

export function useLiveCapturePreview(captureSessionId: string | null): LiveCapturePreviewState {
  const [hasFrame, setHasFrame] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const hasPreviewResolver = hasDesktopPreviewResolver();
  const isCaptureRunning = captureSessionId !== null;
  const previewURLQuery = useQuery<string | null>({
    queryKey: ["studio", "capturePreviewURL", captureSessionId],
    enabled: Boolean(captureSessionId) && hasPreviewResolver,
    queryFn: async () => await desktopApi.resolveCapturePreviewURL(),
    gcTime: 0,
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const previewURL = captureSessionId ? (previewURLQuery.data ?? null) : null;

  useEffect(() => {
    const imageElement = imageRef.current;
    let cancelled = false;
    let nextPollTimeout: number | null = null;
    let refreshVersion = 0;

    function commitHasFrame(nextHasFrame: boolean) {
      setHasFrame((currentHasFrame) =>
        currentHasFrame === nextHasFrame ? currentHasFrame : nextHasFrame,
      );
    }

    function clearPreviewImage() {
      imageElement?.removeAttribute("src");
      commitHasFrame(false);
    }

    function scheduleNextRefresh() {
      if (cancelled || !isCaptureRunning || !previewURL) {
        return;
      }
      nextPollTimeout = window.setTimeout(() => {
        refreshPreviewImage();
      }, liveCapturePreviewPollMs);
    }

    function refreshPreviewImage() {
      if (cancelled || !isCaptureRunning || !previewURL || !imageElement) {
        return;
      }

      refreshVersion += 1;
      imageElement.src = `${previewURL}${previewURL.includes("?") ? "&" : "?"}v=${refreshVersion}`;
    }

    if (!isCaptureRunning || !previewURL) {
      clearPreviewImage();
      return;
    }

    function handleLoad() {
      if (cancelled) {
        return;
      }
      commitHasFrame(true);
      scheduleNextRefresh();
    }

    function handleError() {
      if (cancelled) {
        return;
      }
      if (!imageElement?.getAttribute("src")) {
        commitHasFrame(false);
      }
      scheduleNextRefresh();
    }

    imageElement?.addEventListener("load", handleLoad);
    imageElement?.addEventListener("error", handleError);
    clearPreviewImage();
    refreshPreviewImage();

    return () => {
      cancelled = true;
      if (nextPollTimeout !== null) {
        window.clearTimeout(nextPollTimeout);
      }
      imageElement?.removeEventListener("load", handleLoad);
      imageElement?.removeEventListener("error", handleError);
      clearPreviewImage();
    };
  }, [isCaptureRunning, previewURL]);

  return {
    hasFrame,
    imageRef,
  };
}
