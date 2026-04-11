import { useEffect, useRef } from "react";
import { quantizeSecondsToFrame } from "../../domain/timelineFrameTimebase";

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

export type PlaybackTransportSnapshot = {
  playheadSeconds: number;
  editPlayheadSeconds: number;
  isPlaying: boolean;
  playbackRate: number;
};

export type PlaybackTransportStore = {
  advance: (elapsedMs: number) => number;
  getSnapshot: () => PlaybackTransportSnapshot;
  pause: () => void;
  play: () => void;
  seek: (seconds: number) => void;
  setDisplayTimeSeconds: (seconds: number) => void;
  setRate: (rate: number) => void;
  subscribe: (listener: () => void) => () => void;
  updateConfig: (config: { durationSeconds: number; frameRate: number }) => void;
};

type PlaybackTransportState = {
  clockTimeSeconds: number;
  durationSeconds: number;
  frameRate: number;
  isPlaying: boolean;
  playbackRate: number;
};

function createPlaybackTransportSnapshot(state: PlaybackTransportState): PlaybackTransportSnapshot {
  return {
    playheadSeconds: toDisplayClockSeconds(state.clockTimeSeconds, state.durationSeconds),
    editPlayheadSeconds: toEditClockSeconds(
      state.clockTimeSeconds,
      state.durationSeconds,
      state.frameRate,
    ),
    isPlaying: state.isPlaying,
    playbackRate: state.playbackRate,
  };
}

function snapshotsEqual(
  previous: PlaybackTransportSnapshot,
  next: PlaybackTransportSnapshot,
): boolean {
  return (
    previous.playheadSeconds === next.playheadSeconds &&
    previous.editPlayheadSeconds === next.editPlayheadSeconds &&
    previous.isPlaying === next.isPlaying &&
    previous.playbackRate === next.playbackRate
  );
}

export function createPlaybackTransportStore({
  durationSeconds,
  frameRate,
  initialPlaybackRate = 1,
}: UsePlaybackTransportOptions): PlaybackTransportStore {
  const listeners = new Set<() => void>();
  const state: PlaybackTransportState = {
    clockTimeSeconds: 0,
    durationSeconds,
    frameRate,
    isPlaying: false,
    playbackRate: initialPlaybackRate,
  };
  let snapshot = createPlaybackTransportSnapshot(state);

  const emitIfChanged = () => {
    const nextSnapshot = createPlaybackTransportSnapshot(state);
    if (snapshotsEqual(snapshot, nextSnapshot)) {
      return;
    }
    snapshot = nextSnapshot;
    for (const listener of listeners) {
      listener();
    }
  };

  return {
    advance(elapsedMs) {
      state.clockTimeSeconds = advancePlaybackSeconds({
        currentSeconds: state.clockTimeSeconds,
        elapsedMs,
        playbackRate: state.playbackRate,
        durationSeconds: state.durationSeconds,
      });
      emitIfChanged();
      return snapshot.playheadSeconds;
    },
    getSnapshot() {
      return snapshot;
    },
    pause() {
      if (!state.isPlaying) {
        return;
      }
      state.isPlaying = false;
      emitIfChanged();
    },
    play() {
      if (state.isPlaying) {
        return;
      }
      state.isPlaying = true;
      emitIfChanged();
    },
    seek(seconds) {
      state.clockTimeSeconds = toDisplayClockSeconds(seconds, state.durationSeconds);
      emitIfChanged();
    },
    setDisplayTimeSeconds(seconds) {
      state.clockTimeSeconds = toDisplayClockSeconds(seconds, state.durationSeconds);
      emitIfChanged();
    },
    setRate(rate) {
      if (state.playbackRate === rate) {
        return;
      }
      state.playbackRate = rate;
      emitIfChanged();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    updateConfig(config) {
      state.durationSeconds = config.durationSeconds;
      state.frameRate = config.frameRate;
      state.clockTimeSeconds = clampTimelineSeconds(state.clockTimeSeconds, state.durationSeconds);
      emitIfChanged();
    },
  };
}

export function usePlaybackTransport({
  durationSeconds,
  frameRate,
  initialPlaybackRate = 1,
}: UsePlaybackTransportOptions): PlaybackTransportStore {
  const storeRef = useRef<PlaybackTransportStore | null>(null);
  if (storeRef.current == null) {
    storeRef.current = createPlaybackTransportStore({
      durationSeconds,
      frameRate,
      initialPlaybackRate,
    });
  }

  useEffect(() => {
    storeRef.current?.updateConfig({ durationSeconds, frameRate });
  }, [durationSeconds, frameRate]);

  return storeRef.current;
}
