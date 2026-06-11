import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { useQuery } from "@tanstack/react-query";
import { desktopApi, sendHostStudioDiagnostics } from "@lib/engine";
import type { StudioDiagnosticsEntry } from "@shared/bridge/desktopBridgeContract";
import type { StudioDiagnosticsValue } from "@shared/studioDiagnostics";

const liveCapturePreviewPollMs = 125;

type LiveCapturePreviewState = {
  hasFrame: boolean;
  imageRef: MutableRefObject<HTMLImageElement | null>;
};

type LivePreviewDiagnosticsAnnotations = Record<string, StudioDiagnosticsValue>;

function emitLivePreviewDiagnostic(
  level: StudioDiagnosticsEntry["level"],
  message: string,
  annotations?: LivePreviewDiagnosticsAnnotations,
): void {
  if (typeof window === "undefined") {
    return;
  }
  const entry: StudioDiagnosticsEntry = {
    source: "renderer",
    level,
    message,
    timestamp: new Date().toISOString(),
    annotations: {
      component: "live-capture-preview",
      ...(annotations ?? {}),
    },
  };
  if ((window as Window & { ggHostSendStudioDiagnostics?: unknown }).ggHostSendStudioDiagnostics) {
    sendHostStudioDiagnostics(entry);
    return;
  }
  globalThis.console.info("[live-capture-preview]", entry);
}

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

  useEffect(() => {
    emitLivePreviewDiagnostic("INFO", "live preview hook state changed", {
      captureSessionId,
      hasPreviewResolver,
      isCaptureRunning,
    });
  }, [captureSessionId, hasPreviewResolver, isCaptureRunning]);
  const previewURLQuery = useQuery<string | null>({
    queryKey: ["studio", "capturePreviewURL", captureSessionId],
    enabled: Boolean(captureSessionId) && hasPreviewResolver,
    queryFn: async () => {
      if (!captureSessionId) {
        return null;
      }
      emitLivePreviewDiagnostic("INFO", "resolving live preview URL", { captureSessionId });
      try {
        const previewURL = await desktopApi.resolveCapturePreviewURL(captureSessionId);
        emitLivePreviewDiagnostic("INFO", "resolved live preview URL", {
          captureSessionId,
          previewURL,
        });
        return previewURL;
      } catch (error) {
        emitLivePreviewDiagnostic("ERROR", "failed to resolve live preview URL", {
          captureSessionId,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
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
      emitLivePreviewDiagnostic("INFO", "live preview polling inactive", {
        captureSessionId,
        hasPreviewURL: Boolean(previewURL),
        isCaptureRunning,
      });
      clearPreviewImage();
      return;
    }

    function handleLoad() {
      if (cancelled) {
        return;
      }
      emitLivePreviewDiagnostic("DEBUG", "live preview image loaded", {
        captureSessionId,
        refreshVersion,
      });
      commitHasFrame(true);
      scheduleNextRefresh();
    }

    function handleError() {
      if (cancelled) {
        return;
      }
      emitLivePreviewDiagnostic("WARN", "live preview image failed to load", {
        captureSessionId,
        refreshVersion,
        src: imageElement?.getAttribute("src") ?? null,
      });
      if (!imageElement?.getAttribute("src")) {
        commitHasFrame(false);
      }
      scheduleNextRefresh();
    }

    imageElement?.addEventListener("load", handleLoad);
    imageElement?.addEventListener("error", handleError);
    emitLivePreviewDiagnostic("INFO", "live preview polling started", {
      captureSessionId,
      previewURL,
    });
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
  }, [captureSessionId, isCaptureRunning, previewURL]);

  return {
    hasFrame,
    imageRef,
  };
}
