import { useEffect, useRef, type RefObject } from "react";
import { recordStudioPlaybackActive, recordStudioPlaybackTick } from "@lib/studioDiagnostics";
import type { CompiledTimelineSegment } from "../domain/timelineDomainModel";
import {
  mapProgramSecondsToSourceTime,
  timelineDurationSeconds,
} from "../domain/timelineDomainModel";
import type { PlaybackTransportStore } from "./timeline/usePlaybackTransport";

type UseVideoPlaybackSyncOptions = {
  mediaRef: RefObject<HTMLVideoElement | null>;
  playbackStore: PlaybackTransportStore;
  recordingMediaSource: string | null;
  timelineSegments: CompiledTimelineSegment[];
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
  playbackStore,
  recordingMediaSource,
  timelineSegments,
  timelineDuration,
  setTimelinePlaybackActive,
  setDisplayPlayheadSecondsFromMedia,
  setPlayheadSecondsFromMedia,
}: UseVideoPlaybackSyncOptions): void {
  const playheadSecondsRef = useRef(playbackStore.getSnapshot().playheadSeconds);
  const playbackRateRef = useRef(playbackStore.getSnapshot().playbackRate);
  const isTimelinePlayingRef = useRef(playbackStore.getSnapshot().isPlaying);

  useEffect(() => {
    const updateRefs = () => {
      const snapshot = playbackStore.getSnapshot();
      playheadSecondsRef.current = snapshot.playheadSeconds;
      playbackRateRef.current = snapshot.playbackRate;
      isTimelinePlayingRef.current = snapshot.isPlaying;
    };

    updateRefs();
    return playbackStore.subscribe(updateRefs);
  }, [playbackStore]);

  useEffect(() => {
    recordStudioPlaybackActive(playbackStore.getSnapshot().isPlaying);
    return playbackStore.subscribe(() => {
      recordStudioPlaybackActive(playbackStore.getSnapshot().isPlaying);
    });
  }, [playbackStore]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media || !recordingMediaSource) {
      return;
    }

    let lastPlaybackRate = playbackRateRef.current;
    const syncPlaybackRate = () => {
      if (playbackRateRef.current === lastPlaybackRate) {
        return;
      }
      lastPlaybackRate = playbackRateRef.current;
      media.playbackRate = playbackRateRef.current;
    };

    media.playbackRate = lastPlaybackRate;
    return playbackStore.subscribe(syncPlaybackRate);
  }, [mediaRef, playbackStore, recordingMediaSource]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media || !recordingMediaSource) {
      return;
    }

    let lastIsPlaying = isTimelinePlayingRef.current;
    const syncPlaybackActive = () => {
      if (isTimelinePlayingRef.current === lastIsPlaying) {
        return;
      }
      lastIsPlaying = isTimelinePlayingRef.current;
      if (isTimelinePlayingRef.current) {
        void media.play().catch(() => {
          setTimelinePlaybackActive(false);
        });
        return;
      }
      media.pause();
    };

    if (lastIsPlaying) {
      void media.play().catch(() => {
        setTimelinePlaybackActive(false);
      });
    } else {
      media.pause();
    }
    return playbackStore.subscribe(syncPlaybackActive);
  }, [mediaRef, playbackStore, recordingMediaSource, setTimelinePlaybackActive]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media || !recordingMediaSource) {
      return;
    }

    const syncPausedSeek = () => {
      if (isTimelinePlayingRef.current) {
        return;
      }

      const boundedPlayhead = Math.max(0, Math.min(playheadSecondsRef.current, timelineDuration));
      const mappedSource = mapProgramSecondsToSourceTime(timelineSegments, boundedPlayhead);
      const targetMediaSeconds = mappedSource?.sourceSeconds ?? boundedPlayhead;
      if (Math.abs(media.currentTime - targetMediaSeconds) <= 0.08) {
        return;
      }

      try {
        media.currentTime = targetMediaSeconds;
      } catch {
        // Ignore seek errors while media is loading.
      }
    };

    syncPausedSeek();
    return playbackStore.subscribe(syncPausedSeek);
  }, [mediaRef, playbackStore, recordingMediaSource, timelineDuration, timelineSegments]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media || !recordingMediaSource) {
      return;
    }

    let animationFrameHandle: number | null = null;
    let videoFrameHandle: number | null = null;
    let isCancelled = false;
    let loopActive = false;
    const mediaWithFrameCallback = media as VideoWithFrameCallback;
    const segmentBoundaryThresholdSeconds = 0.02;

    const syncProgramClockFromMedia = () => {
      const mapped = mapProgramSecondsToSourceTime(timelineSegments, playheadSecondsRef.current);
      const activeSegment = mapped?.segment ?? null;
      if (!activeSegment) {
        recordStudioPlaybackTick(media.currentTime);
        setDisplayPlayheadSecondsFromMedia(media.currentTime);
        return true;
      }

      if (media.currentTime >= activeSegment.sourceEndSeconds - segmentBoundaryThresholdSeconds) {
        const nextSegment = timelineSegments[activeSegment.index + 1];
        if (!nextSegment) {
          setDisplayPlayheadSecondsFromMedia(activeSegment.programEndSeconds);
          setTimelinePlaybackActive(false);
          return false;
        }

        try {
          media.currentTime = nextSegment.sourceStartSeconds;
        } catch {
          setTimelinePlaybackActive(false);
          return false;
        }
        recordStudioPlaybackTick(nextSegment.sourceStartSeconds);
        setDisplayPlayheadSecondsFromMedia(nextSegment.programStartSeconds);
        return true;
      }

      const nextProgramSeconds =
        activeSegment.programStartSeconds + (media.currentTime - activeSegment.sourceStartSeconds);
      setDisplayPlayheadSecondsFromMedia(
        Math.max(
          activeSegment.programStartSeconds,
          Math.min(nextProgramSeconds, activeSegment.programEndSeconds),
        ),
      );
      recordStudioPlaybackTick(media.currentTime);
      return true;
    };

    const scheduleTick = () => {
      if (isCancelled) {
        return;
      }
      if (typeof mediaWithFrameCallback.requestVideoFrameCallback === "function") {
        videoFrameHandle = mediaWithFrameCallback.requestVideoFrameCallback(() => {
          if (isCancelled) {
            return;
          }
          if (syncProgramClockFromMedia()) {
            scheduleTick();
          }
        });
        return;
      }
      animationFrameHandle = requestAnimationFrame(() => {
        if (isCancelled) {
          return;
        }
        if (syncProgramClockFromMedia()) {
          scheduleTick();
        }
      });
    };

    const stopLoop = () => {
      loopActive = false;
      if (animationFrameHandle != null) {
        cancelAnimationFrame(animationFrameHandle);
        animationFrameHandle = null;
      }
      if (videoFrameHandle != null) {
        mediaWithFrameCallback.cancelVideoFrameCallback?.(videoFrameHandle);
        videoFrameHandle = null;
      }
    };

    const syncLoop = () => {
      if (!isTimelinePlayingRef.current) {
        stopLoop();
        return;
      }

      if (loopActive) {
        return;
      }

      loopActive = true;
      scheduleTick();
    };

    syncLoop();
    const unsubscribe = playbackStore.subscribe(syncLoop);

    return () => {
      isCancelled = true;
      unsubscribe();
      stopLoop();
    };
  }, [
    mediaRef,
    playbackStore,
    recordingMediaSource,
    setDisplayPlayheadSecondsFromMedia,
    setTimelinePlaybackActive,
    timelineSegments,
  ]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media) {
      return;
    }

    const handleSeeked = () => {
      const mapped = mapProgramSecondsToSourceTime(timelineSegments, playheadSecondsRef.current);
      if (!mapped) {
        setPlayheadSecondsFromMedia(media.currentTime);
        return;
      }

      const nextProgramSeconds =
        mapped.segment.programStartSeconds +
        (media.currentTime - mapped.segment.sourceStartSeconds);
      setPlayheadSecondsFromMedia(
        Math.max(
          mapped.segment.programStartSeconds,
          Math.min(nextProgramSeconds, mapped.segment.programEndSeconds),
        ),
      );
    };
    const handleEnded = () => {
      setTimelinePlaybackActive(false);
      const duration = timelineDurationSeconds(timelineSegments);
      if (duration > 0) {
        setPlayheadSecondsFromMedia(duration);
      }
    };
    const handleLoadedMetadata = () => {
      const duration = timelineDurationSeconds(timelineSegments);
      if (duration > 0) {
        setPlayheadSecondsFromMedia(Math.min(playheadSecondsRef.current, duration));
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
  }, [mediaRef, setPlayheadSecondsFromMedia, setTimelinePlaybackActive, timelineSegments]);
}
