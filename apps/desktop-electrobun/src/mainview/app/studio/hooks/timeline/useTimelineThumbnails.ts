import { startTransition, useEffect, useMemo, useState } from "react";
import { recordStudioDiagnosticsEvent } from "@lib/studioDiagnostics";
import type { TimelineClip } from "../../domain/timelineDomainModel";

// One decoder serves all scene requests, with a bounded cross-route frame cache.
const frameCache = new Map<string, string>();
const maximumFrames = 32;
const maximumCachedFrames = 96;
let decoderQueue = Promise.resolve();
const emptyFrames: ReadonlyMap<string, string> = new Map();

function mediaEvent(
  video: HTMLVideoElement,
  name: string,
  signal: AbortSignal,
  timeoutMs = 4000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timeout);
      video.removeEventListener(name, success);
      video.removeEventListener("error", fail);
      signal.removeEventListener("abort", fail);
    };
    const success = () => {
      cleanup();
      resolve();
    };
    const fail = () => {
      cleanup();
      const error = new Error("Thumbnail unavailable");
      error.name = signal.aborted
        ? "AbortError"
        : video.error
          ? "ThumbnailMediaError"
          : "ThumbnailTimeoutError";
      reject(error);
    };
    const timeout = setTimeout(fail, timeoutMs);
    video.addEventListener(name, success, { once: true });
    video.addEventListener("error", fail, { once: true });
    signal.addEventListener("abort", fail, { once: true });
    if (signal.aborted) {
      fail();
    }
  });
}

/** Sample actual source frames without mounting a decoder for every clip. */
export function useTimelineThumbnails(
  source: string | null,
  clips: readonly TimelineClip[],
): ReadonlyMap<string, string> {
  const requestKey = useMemo(
    () =>
      JSON.stringify(
        clips
          .filter((clip) => clip.semantic !== "gap")
          .slice(0, maximumFrames)
          .map((clip) => ({
            id: clip.id,
            seconds:
              clip.sourceStartSeconds +
              Math.min(0.1, Math.max(0, clip.sourceEndSeconds - clip.sourceStartSeconds) / 2),
          })),
      ),
    [clips],
  );
  const [result, setResult] = useState<{
    source: string;
    requestKey: string;
    frames: ReadonlyMap<string, string>;
  } | null>(null);

  useEffect(() => {
    if (!source) {
      return;
    }
    const cancellation = new AbortController();
    const { signal } = cancellation;
    const requests: Array<{ id: string; seconds: number }> = JSON.parse(requestKey);
    const frames = new Map<string, string>();
    const publish = () => {
      if (!signal.aborted) {
        startTransition(() => setResult({ source, requestKey, frames: new Map(frames) }));
      }
    };
    const work = async () => {
      if (signal.aborted || requests.length === 0) {
        return;
      }
      let video: HTMLVideoElement | null = null;
      let stage = "queued";
      const diagnose = (nextStage: string, error?: unknown) => {
        recordStudioDiagnosticsEvent("timeline thumbnail decoder", {
          stage: nextStage,
          rendererProtocol: window.location.protocol,
          readyState: video?.readyState ?? 0,
          networkState: video?.networkState ?? 0,
          mediaErrorCode: video?.error?.code ?? 0,
          errorName: error instanceof Error ? error.name : "none",
          completedFrames: frames.size,
        });
      };
      const metadataReady = () => diagnose("metadata-ready");
      const stop = () => {
        video?.pause();
        video?.removeAttribute("src");
        video?.load();
        video?.removeEventListener("loadedmetadata", metadataReady);
        video?.remove();
      };
      signal.addEventListener("abort", stop, { once: true });
      try {
        for (const request of requests) {
          if (signal.aborted) {
            break;
          }
          const key = `${source}\n${request.seconds}`;
          let frame = frameCache.get(key);
          if (!frame) {
            if (!video) {
              video = document.createElement("video");
              video.muted = true;
              video.defaultMuted = true;
              video.volume = 0;
              video.preload = "auto";
              video.playsInline = true;
              video.crossOrigin = "anonymous";
              video.setAttribute("aria-hidden", "true");
              video.tabIndex = -1;
              video.dataset.ggThumbnailDecoder = "true";
              Object.assign(video.style, {
                position: "fixed",
                left: "-10000px",
                top: "0",
                width: "160px",
                height: "90px",
                opacity: "0",
                pointerEvents: "none",
              });
              // WKWebView may defer decoded frame production for detached media.
              // Keep one noninteractive decoder in the document while this batch runs.
              document.body.append(video);
              video.addEventListener("loadedmetadata", metadataReady);
              stage = "loading-source";
              diagnose(stage);
              const loaded = mediaEvent(video, "loadeddata", signal, 12_000);
              video.src = source;
              video.load();
              // Native WebKit can postpone decoding metadata-only media until a
              // play request primes the decoder. This element is always silent.
              void video.play().catch((error: unknown) => {
                if (!signal.aborted) {
                  diagnose("decoder-prime-rejected", error);
                }
              });
              await loaded;
              video.pause();
              diagnose("source-ready");
            }
            if (!Number.isFinite(video.duration) || !video.videoWidth || !video.videoHeight) {
              diagnose("invalid-media-dimensions");
              break;
            }
            const time = Math.min(Math.max(0, video.duration - 0.001), request.seconds);
            if (Math.abs(video.currentTime - time) > 0.001) {
              stage = "seeking-source";
              const seeked = mediaEvent(video, "seeked", signal);
              video.currentTime = time;
              await seeked;
            }
            if (signal.aborted) {
              break;
            }
            const canvas = document.createElement("canvas");
            canvas.width = 160;
            canvas.height = Math.max(1, Math.round((160 * video.videoHeight) / video.videoWidth));
            if (canvas.height > 160) {
              canvas.width = Math.max(1, Math.round((160 * video.videoWidth) / video.videoHeight));
              canvas.height = 160;
            }
            stage = "drawing-source";
            const context = canvas.getContext("2d");
            if (!context) {
              diagnose("canvas-unavailable");
              break;
            }
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            frame = canvas.toDataURL("image/jpeg", 0.65);
            if (!frame.startsWith("data:image/jpeg")) {
              break;
            }
            frameCache.set(key, frame);
            while (frameCache.size > maximumCachedFrames) {
              const oldest = frameCache.keys().next().value;
              if (oldest === undefined) {
                break;
              }
              frameCache.delete(oldest);
            }
          }
          frames.set(request.id, frame);
          publish();
          diagnose("frame-ready");
          // Yield between source seeks so timeline input can take priority.
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
        }
      } catch (error) {
        // Record categorical metadata only. Error messages can contain media tokens.
        diagnose(stage, error);
        // A failed decode, expired lease or tainted canvas leaves a truthful fallback.
      } finally {
        signal.removeEventListener("abort", stop);
        stop();
      }
    };
    decoderQueue = decoderQueue.then(work, work);
    return () => cancellation.abort();
  }, [source, requestKey]);

  return result?.source === source && result.requestKey === requestKey
    ? result.frames
    : emptyFrames;
}
