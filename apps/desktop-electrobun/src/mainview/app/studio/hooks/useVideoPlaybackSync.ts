import { useEffect, type RefObject } from "react";

type UseVideoPlaybackSyncOptions = {
  mediaRef: RefObject<HTMLVideoElement | null>;
  recordingMediaSource: string | null;
  isTimelinePlaying: boolean;
  playbackRate: number;
  playheadSeconds: number;
  timelineDuration: number;
  setTimelinePlaybackActive: (isActive: boolean) => void;
  setDisplayPlayheadSecondsFromMedia: (seconds: number) => void;
  setPlayheadSecondsFromMedia: (seconds: number) => void;
};

type FrameCallback = (now: number, metadata: { mediaTime: number }) => void;
type VideoWithFrameCallback = HTMLVideoElement & {
  cancelVideoFrameCallback?: (handle: number) => void;
  requestVideoFrameCallback?: (callback: FrameCallback) => number;
};

export function useVideoPlaybackSync({
  mediaRef,
  recordingMediaSource,
  isTimelinePlaying,
  playbackRate,
  playheadSeconds,
  timelineDuration,
  setTimelinePlaybackActive,
  setDisplayPlayheadSecondsFromMedia,
  setPlayheadSecondsFromMedia,
}: UseVideoPlaybackSyncOptions): void {
  useEffect(() => {
    const media = mediaRef.current;
    if (!media || !recordingMediaSource) {
      return;
    }

    media.playbackRate = playbackRate;
  }, [mediaRef, playbackRate, recordingMediaSource]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media || !recordingMediaSource) {
      return;
    }

    if (isTimelinePlaying) {
      void media.play().catch(() => {
        setTimelinePlaybackActive(false);
      });
      return;
    }
    media.pause();
  }, [isTimelinePlaying, mediaRef, recordingMediaSource, setTimelinePlaybackActive]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media || !recordingMediaSource || isTimelinePlaying) {
      return;
    }

    const boundedPlayhead = Math.max(0, Math.min(playheadSeconds, timelineDuration));
    if (Math.abs(media.currentTime - boundedPlayhead) <= 0.08) {
      return;
    }

    try {
      media.currentTime = boundedPlayhead;
    } catch {
      // Ignore seek errors while media is loading.
    }
  }, [isTimelinePlaying, mediaRef, playheadSeconds, recordingMediaSource, timelineDuration]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media || !recordingMediaSource || !isTimelinePlaying) {
      return;
    }

    let animationFrameHandle: number | null = null;
    let videoFrameHandle: number | null = null;
    let isCancelled = false;
    const mediaWithFrameCallback = media as VideoWithFrameCallback;

    const scheduleTick = () => {
      if (isCancelled) {
        return;
      }
      if (typeof mediaWithFrameCallback.requestVideoFrameCallback === "function") {
        videoFrameHandle = mediaWithFrameCallback.requestVideoFrameCallback(() => {
          if (isCancelled) {
            return;
          }
          setDisplayPlayheadSecondsFromMedia(media.currentTime);
          scheduleTick();
        });
        return;
      }
      animationFrameHandle = requestAnimationFrame(() => {
        if (isCancelled) {
          return;
        }
        setDisplayPlayheadSecondsFromMedia(media.currentTime);
        scheduleTick();
      });
    };

    scheduleTick();

    return () => {
      isCancelled = true;
      if (animationFrameHandle != null) {
        cancelAnimationFrame(animationFrameHandle);
      }
      if (videoFrameHandle != null) {
        mediaWithFrameCallback.cancelVideoFrameCallback?.(videoFrameHandle);
      }
    };
  }, [isTimelinePlaying, mediaRef, recordingMediaSource, setDisplayPlayheadSecondsFromMedia]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media) {
      return;
    }

    const handleSeeked = () => {
      setPlayheadSecondsFromMedia(media.currentTime);
    };
    const handleEnded = () => {
      setTimelinePlaybackActive(false);
      const duration = media.duration;
      if (Number.isFinite(duration) && duration > 0) {
        setPlayheadSecondsFromMedia(duration);
      }
    };
    const handleLoadedMetadata = () => {
      const duration = media.duration;
      if (Number.isFinite(duration) && duration > 0) {
        setPlayheadSecondsFromMedia(Math.min(playheadSeconds, duration));
      }
    };

    media.addEventListener("seeked", handleSeeked);
    media.addEventListener("ended", handleEnded);
    media.addEventListener("loadedmetadata", handleLoadedMetadata);

    return () => {
      media.removeEventListener("seeked", handleSeeked);
      media.removeEventListener("ended", handleEnded);
      media.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, [mediaRef, playheadSeconds, setPlayheadSecondsFromMedia, setTimelinePlaybackActive]);
}
