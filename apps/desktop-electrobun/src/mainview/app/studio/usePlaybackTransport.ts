import { useCallback, useMemo, useRef, useState } from "react";
import { quantizeSecondsToFrame } from "./timelineTimebase";

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

export function clampTimelineSeconds(seconds: number, durationSeconds: number): number {
  const safeDuration =
    Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : 0;
  if (!Number.isFinite(seconds)) {
    return 0;
  }
  return clamp(seconds, 0, safeDuration);
}

export function toDisplayClockSeconds(seconds: number, durationSeconds: number): number {
  return clampTimelineSeconds(seconds, durationSeconds);
}

export function toEditClockSeconds(
  seconds: number,
  durationSeconds: number,
  frameRate: number,
): number {
  return quantizeSecondsToFrame(clampTimelineSeconds(seconds, durationSeconds), frameRate);
}

export function advancePlaybackSeconds(params: {
  currentSeconds: number;
  elapsedMs: number;
  playbackRate: number;
  durationSeconds: number;
}): number {
  if (!Number.isFinite(params.elapsedMs) || params.elapsedMs <= 0) {
    return clampTimelineSeconds(params.currentSeconds, params.durationSeconds);
  }
  const rate = Number.isFinite(params.playbackRate) ? params.playbackRate : 1;
  const next = params.currentSeconds + (params.elapsedMs / 1000) * rate;
  return clampTimelineSeconds(next, params.durationSeconds);
}

type UsePlaybackTransportOptions = {
  durationSeconds: number;
  frameRate: number;
  initialPlaybackRate?: number;
};

export function usePlaybackTransport({
  durationSeconds,
  frameRate,
  initialPlaybackRate = 1,
}: UsePlaybackTransportOptions) {
  const [clockTimeSeconds, setClockTimeSeconds] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(initialPlaybackRate);
  const clockTimeSecondsRef = useRef(clockTimeSeconds);
  const displayTimeSeconds = useMemo(
    () => toDisplayClockSeconds(clockTimeSeconds, durationSeconds),
    [clockTimeSeconds, durationSeconds],
  );
  const editTimeSeconds = useMemo(
    () => toEditClockSeconds(clockTimeSeconds, durationSeconds, frameRate),
    [clockTimeSeconds, durationSeconds, frameRate],
  );
  const setClockTime = useCallback((nextClockTimeSeconds: number) => {
    clockTimeSecondsRef.current = nextClockTimeSeconds;
    setClockTimeSeconds(nextClockTimeSeconds);
  }, []);

  const setDisplayTimeSeconds = useCallback(
    (seconds: number) => {
      const next = toDisplayClockSeconds(seconds, durationSeconds);
      setClockTime(next);
    },
    [durationSeconds, setClockTime],
  );

  const seek = useCallback(
    (seconds: number) => {
      const nextDisplay = toDisplayClockSeconds(seconds, durationSeconds);
      setClockTime(nextDisplay);
    },
    [durationSeconds, setClockTime],
  );

  const advance = useCallback(
    (elapsedMs: number) => {
      const next = advancePlaybackSeconds({
        currentSeconds: clockTimeSecondsRef.current,
        elapsedMs,
        playbackRate,
        durationSeconds,
      });
      setClockTime(next);
      return next;
    },
    [durationSeconds, playbackRate, setClockTime],
  );

  const play = useCallback(() => {
    setIsPlaying(true);
  }, []);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const setRate = useCallback((rate: number) => {
    setPlaybackRate(rate);
  }, []);

  return useMemo(
    () => ({
      advance,
      clockTimeSecondsRef,
      displayTimeSeconds,
      editTimeSeconds,
      isPlaying,
      pause,
      play,
      playbackRate,
      seek,
      setDisplayTimeSeconds,
      setRate,
    }),
    [
      advance,
      clockTimeSecondsRef,
      displayTimeSeconds,
      editTimeSeconds,
      isPlaying,
      pause,
      play,
      playbackRate,
      seek,
      setDisplayTimeSeconds,
      setRate,
    ],
  );
}
