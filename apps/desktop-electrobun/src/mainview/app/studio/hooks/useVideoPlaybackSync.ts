import { useEffect, useRef, type RefObject } from "react";
import { recordStudioPlaybackActive, recordStudioPlaybackTick } from "@lib/studioDiagnostics";
import type { CompiledTimelineItem } from "../domain/timelineDomainModel";
import { timelineDurationSeconds } from "../domain/timelineDomainModel";
import {
  findNextPlayableClipAfterProgramTime,
  resolveTimelinePlaybackAtProgramTime,
} from "../domain/timelinePlaybackModel";
import type { PlaybackTransportStore } from "./timeline/usePlaybackTransport";

type UseVideoPlaybackSyncOptions = {
  mediaRef: RefObject<HTMLVideoElement | null>;
  sourceCardRef?: RefObject<HTMLDivElement | null>;
  playbackStore: PlaybackTransportStore;
  recordingMediaSource: string | null;
  timelineItems: CompiledTimelineItem[];
  timelineDuration: number;
  setTimelinePlaybackActive: (isActive: boolean) => void;
  setDisplayPlayheadSecondsFromMedia: (seconds: number) => void;
  setPlayheadSecondsFromMedia: (seconds: number) => void;
};

export function useVideoPlaybackSync({
  mediaRef,
  sourceCardRef,
  playbackStore,
  recordingMediaSource,
  timelineItems,
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
        const resolution = resolveTimelinePlaybackAtProgramTime(
          timelineItems,
          playheadSecondsRef.current,
        );
        if (resolution.kind === "clip") {
          void media.play().catch(() => {
            setTimelinePlaybackActive(false);
          });
        }
        return;
      }
      media.pause();
    };

    if (lastIsPlaying) {
      const resolution = resolveTimelinePlaybackAtProgramTime(
        timelineItems,
        playheadSecondsRef.current,
      );
      if (resolution.kind === "clip") {
        void media.play().catch(() => {
          setTimelinePlaybackActive(false);
        });
      }
    } else {
      media.pause();
    }
    return playbackStore.subscribe(syncPlaybackActive);
  }, [mediaRef, playbackStore, recordingMediaSource, setTimelinePlaybackActive, timelineItems]);

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
      const resolution = resolveTimelinePlaybackAtProgramTime(timelineItems, boundedPlayhead);
      const isGap = resolution.kind === "gap";
      setSourceVisibility(media, sourceCardRef, !isGap);
      if (resolution.kind !== "clip") {
        return;
      }

      const targetMediaSeconds = resolution.sourceSeconds;
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
  }, [
    mediaRef,
    playbackStore,
    recordingMediaSource,
    sourceCardRef,
    timelineDuration,
    timelineItems,
  ]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media || !recordingMediaSource) {
      return;
    }

    let animationFrameHandle: number | null = null;
    let isCancelled = false;
    let loopActive = false;
    let lastFrameTimeMs = performance.now();
    const segmentBoundaryThresholdSeconds = 0.02;

    const syncProgramClockFromMedia = () => {
      const resolution = resolveTimelinePlaybackAtProgramTime(
        timelineItems,
        playheadSecondsRef.current,
      );
      const isGap = resolution.kind === "gap";
      setSourceVisibility(media, sourceCardRef, !isGap);

      if (isGap) {
        media.pause();
        const now = performance.now();
        const nextPlayhead = playbackStore.advance(now - lastFrameTimeMs);
        lastFrameTimeMs = now;
        const nextResolution = resolveTimelinePlaybackAtProgramTime(timelineItems, nextPlayhead);
        if (nextResolution.kind === "empty" || nextResolution.kind === "ended") {
          setTimelinePlaybackActive(false);
          return false;
        }
        if (nextResolution.kind === "clip") {
          try {
            media.currentTime = nextResolution.sourceSeconds;
            void media.play().catch(() => setTimelinePlaybackActive(false));
          } catch {
            setTimelinePlaybackActive(false);
            return false;
          }
        }
        return true;
      }

      lastFrameTimeMs = performance.now();
      if (resolution.kind !== "clip") {
        recordStudioPlaybackTick(media.currentTime);
        setDisplayPlayheadSecondsFromMedia(playheadSecondsRef.current);
        return true;
      }

      const activeClip = resolution.item;
      if (media.currentTime >= activeClip.sourceEndSeconds - segmentBoundaryThresholdSeconds) {
        const boundarySeconds = activeClip.programEndSeconds;
        const boundaryResolution = resolveTimelinePlaybackAtProgramTime(
          timelineItems,
          boundarySeconds,
        );
        if (boundaryResolution.kind === "gap") {
          media.pause();
          setSourceVisibility(media, sourceCardRef, false);
          setPlayheadSecondsFromMedia(boundarySeconds);
          return true;
        }

        const nextClip = findNextPlayableClipAfterProgramTime(timelineItems, boundarySeconds);
        if (!nextClip) {
          setDisplayPlayheadSecondsFromMedia(boundarySeconds);
          setTimelinePlaybackActive(false);
          return false;
        }

        try {
          media.currentTime = nextClip.sourceStartSeconds;
        } catch {
          setTimelinePlaybackActive(false);
          return false;
        }
        recordStudioPlaybackTick(nextClip.sourceStartSeconds);
        setDisplayPlayheadSecondsFromMedia(nextClip.programStartSeconds);
        return true;
      }

      const nextProgramSeconds =
        activeClip.programStartSeconds + (media.currentTime - activeClip.sourceStartSeconds);
      setDisplayPlayheadSecondsFromMedia(
        Math.max(
          activeClip.programStartSeconds,
          Math.min(nextProgramSeconds, activeClip.programEndSeconds),
        ),
      );
      recordStudioPlaybackTick(media.currentTime);
      return true;
    };

    const scheduleTick = () => {
      if (isCancelled) {
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
    };

    const syncLoop = () => {
      if (!isTimelinePlayingRef.current) {
        stopLoop();
        return;
      }

      if (loopActive) {
        return;
      }

      lastFrameTimeMs = performance.now();
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
    setPlayheadSecondsFromMedia,
    setTimelinePlaybackActive,
    sourceCardRef,
    timelineItems,
  ]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media) {
      return;
    }

    const handleSeeked = () => {
      const resolution = resolveTimelinePlaybackAtProgramTime(
        timelineItems,
        playheadSecondsRef.current,
      );
      const isGap = resolution.kind === "gap";
      setSourceVisibility(media, sourceCardRef, !isGap);
      if (resolution.kind !== "clip") {
        return;
      }

      const nextProgramSeconds =
        resolution.item.programStartSeconds +
        (media.currentTime - resolution.item.sourceStartSeconds);
      setPlayheadSecondsFromMedia(
        Math.max(
          resolution.item.programStartSeconds,
          Math.min(nextProgramSeconds, resolution.item.programEndSeconds),
        ),
      );
    };
    const handleEnded = () => {
      const resolution = resolveTimelinePlaybackAtProgramTime(
        timelineItems,
        playheadSecondsRef.current,
      );
      if (resolution.kind === "gap") {
        media.pause();
        setSourceVisibility(media, sourceCardRef, false);
        return;
      }
      if (resolution.kind === "clip") {
        const queuedBoundaryClip = timelineItems.find(
          (item) =>
            item.kind === "clip" &&
            Math.abs(item.programEndSeconds - playheadSecondsRef.current) <= 0.02,
        );
        const endedClip =
          queuedBoundaryClip?.kind === "clip" ? queuedBoundaryClip : resolution.item;
        const boundarySeconds = endedClip.programEndSeconds;
        const boundaryResolution = resolveTimelinePlaybackAtProgramTime(
          timelineItems,
          boundarySeconds,
        );
        if (boundaryResolution.kind === "gap") {
          media.pause();
          setSourceVisibility(media, sourceCardRef, false);
          setPlayheadSecondsFromMedia(boundarySeconds);
          return;
        }

        const nextClip = findNextPlayableClipAfterProgramTime(timelineItems, boundarySeconds);
        if (nextClip) {
          try {
            media.currentTime = nextClip.sourceStartSeconds;
            setSourceVisibility(media, sourceCardRef, true);
            setPlayheadSecondsFromMedia(nextClip.programStartSeconds);
            void media.play().catch(() => setTimelinePlaybackActive(false));
            return;
          } catch {
            setTimelinePlaybackActive(false);
            return;
          }
        }
      }

      setTimelinePlaybackActive(false);
      const duration = timelineDurationSeconds(timelineItems);
      if (duration > 0) {
        setPlayheadSecondsFromMedia(duration);
      }
    };
    const handleLoadedMetadata = () => {
      const duration = timelineDurationSeconds(timelineItems);
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
  }, [
    mediaRef,
    setPlayheadSecondsFromMedia,
    setTimelinePlaybackActive,
    sourceCardRef,
    timelineItems,
  ]);
}

function setSourceVisibility(
  media: HTMLVideoElement,
  sourceCardRef: RefObject<HTMLDivElement | null> | undefined,
  isVisible: boolean,
): void {
  const visibility = isVisible ? "" : "hidden";
  media.style.visibility = visibility;
  if (sourceCardRef?.current) {
    sourceCardRef.current.style.visibility = visibility;
  }
}
