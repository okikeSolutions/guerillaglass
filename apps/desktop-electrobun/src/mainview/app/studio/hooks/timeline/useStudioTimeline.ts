import { useCallback, useEffect, useMemo, useState } from "react";
import type { InputEvent, TimelineDocument } from "@guerillaglass/engine-protocol";
import {
  buildTimelineLanes,
  compileTimelineSegments,
  timelineDurationSeconds,
} from "../../domain/timelineDomainModel";
import {
  defaultTimelineFrameRate,
  normalizeTimelineFrameRate,
  quantizeSecondsToFrame,
} from "../../domain/timelineFrameTimebase";
import { usePlaybackTransport } from "./usePlaybackTransport";
import { useTimelineWaveform } from "./useTimelineWaveform";

const playbackRates = [0.5, 1, 1.5, 2] as const;
const timelineZoomBounds = {
  minPercent: 75,
  maxPercent: 300,
};

type TimelineTool = "select" | "trim" | "blade";
type TimelineLaneControlState = {
  locked: boolean;
  muted: boolean;
  solo: boolean;
};
type TimelineLaneControlStateByLane = Record<"video" | "audio", TimelineLaneControlState>;
type AudioMixerState = {
  masterGain: number;
  masterMuted: boolean;
  micGain: number;
  micMuted: boolean;
};

const defaultTimelineLaneControlState: TimelineLaneControlStateByLane = {
  video: {
    locked: false,
    muted: false,
    solo: false,
  },
  audio: {
    locked: false,
    muted: false,
    solo: false,
  },
};
const defaultAudioMixerState: AudioMixerState = {
  masterGain: 0.85,
  masterMuted: false,
  micGain: 0.9,
  micMuted: false,
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function snapToTimelineFrame(seconds: number, enabled: boolean, frameRate: number): number {
  if (!enabled) {
    return seconds;
  }
  return quantizeSecondsToFrame(seconds, frameRate);
}

type UseStudioTimelineOptions = {
  activeMode: "capture" | "edit" | "deliver";
  recordingURL: string | null;
  recordingDurationSeconds: number;
  timelineDocument: TimelineDocument;
  timelineFrameRate?: number;
  timelineEvents: InputEvent[];
  laneLabels: {
    video: string;
    audio: string;
    events: string;
  };
};

export function useStudioTimeline({
  activeMode,
  recordingURL,
  recordingDurationSeconds,
  timelineDocument,
  timelineFrameRate = defaultTimelineFrameRate,
  timelineEvents,
  laneLabels,
}: UseStudioTimelineOptions) {
  const [timelineZoomPercent, setTimelineZoomPercent] = useState(100);
  const [timelineSnapEnabled, setTimelineSnapEnabled] = useState(true);
  const [timelineRippleEnabled, setTimelineRippleEnabled] = useState(false);
  const [timelineTool, setTimelineTool] = useState<TimelineTool>("select");
  const [timelineLaneControlState, setTimelineLaneControlState] =
    useState<TimelineLaneControlStateByLane>(defaultTimelineLaneControlState);
  const [audioMixer, setAudioMixer] = useState<AudioMixerState>(defaultAudioMixerState);

  const usesMediaPlaybackClock = activeMode === "edit" && Boolean(recordingURL);
  const normalizedFrameRate = useMemo(
    () => normalizeTimelineFrameRate(timelineFrameRate),
    [timelineFrameRate],
  );
  const compiledTimelineSegments = useMemo(
    () => compileTimelineSegments(timelineDocument),
    [timelineDocument],
  );
  const compiledTimelineDurationSeconds = useMemo(
    () => timelineDurationSeconds(compiledTimelineSegments),
    [compiledTimelineSegments],
  );
  const timelineDuration = useMemo(
    () => Math.max(compiledTimelineDurationSeconds, 1),
    [compiledTimelineDurationSeconds],
  );
  const playbackTransport = usePlaybackTransport({
    durationSeconds: timelineDuration,
    frameRate: normalizedFrameRate,
  });
  const sourceRecordingDurationSeconds = useMemo(() => {
    if (!recordingURL) {
      return 0;
    }
    return Math.max(recordingDurationSeconds, 0);
  }, [recordingDurationSeconds, recordingURL]);
  const audioWaveform = useTimelineWaveform({
    recordingURL,
    recordingDurationSeconds: sourceRecordingDurationSeconds,
    timelineEvents,
  });
  const timelineLanes = useMemo(
    () =>
      buildTimelineLanes({
        timeline: timelineDocument,
        events: timelineEvents,
        audioWaveform,
        labels: laneLabels,
      }),
    [audioWaveform, laneLabels, timelineDocument, timelineEvents],
  );

  useEffect(() => {
    if (usesMediaPlaybackClock) {
      return;
    }

    const tickMs = 50;
    let timer: ReturnType<typeof setInterval> | null = null;

    const syncTimer = () => {
      const { isPlaying } = playbackTransport.getSnapshot();
      if (!isPlaying) {
        if (timer != null) {
          clearInterval(timer);
          timer = null;
        }
        return;
      }

      if (timer != null) {
        return;
      }

      timer = setInterval(() => {
        const next = playbackTransport.advance(tickMs);
        if (next >= timelineDuration) {
          playbackTransport.pause();
        }
      }, tickMs);
    };

    syncTimer();
    const unsubscribe = playbackTransport.subscribe(syncTimer);

    return () => {
      unsubscribe();
      if (timer != null) {
        clearInterval(timer);
      }
    };
  }, [playbackTransport, timelineDuration, usesMediaPlaybackClock]);

  const setTimelineZoom = useCallback((nextZoomPercent: number) => {
    setTimelineZoomPercent((current) =>
      clamp(
        Math.round(nextZoomPercent || current),
        timelineZoomBounds.minPercent,
        timelineZoomBounds.maxPercent,
      ),
    );
  }, []);

  const zoomTimelineIn = useCallback(() => {
    setTimelineZoom(timelineZoomPercent + 25);
  }, [setTimelineZoom, timelineZoomPercent]);

  const zoomTimelineOut = useCallback(() => {
    setTimelineZoom(timelineZoomPercent - 25);
  }, [setTimelineZoom, timelineZoomPercent]);

  const resetTimelineZoom = useCallback(() => {
    setTimelineZoom(100);
  }, [setTimelineZoom]);

  const toggleTimelineSnap = useCallback(() => {
    setTimelineSnapEnabled((current) => !current);
  }, []);

  const toggleTimelineRipple = useCallback(() => {
    setTimelineRippleEnabled((current) => !current);
  }, []);

  const toggleLaneControl = useCallback(
    (laneId: "video" | "audio", control: keyof TimelineLaneControlState) => {
      setTimelineLaneControlState((current) => ({
        ...current,
        [laneId]: {
          ...current[laneId],
          [control]: !current[laneId][control],
        },
      }));
    },
    [],
  );

  const setAudioMixerGain = useCallback((target: "master" | "mic", gain: number) => {
    const nextGain = clamp(gain, 0, 1);
    setAudioMixer((current) => ({
      ...current,
      [target === "master" ? "masterGain" : "micGain"]: nextGain,
    }));
  }, []);

  const toggleAudioMixerMuted = useCallback((target: "master" | "mic") => {
    setAudioMixer((current) => ({
      ...current,
      [target === "master" ? "masterMuted" : "micMuted"]:
        !current[target === "master" ? "masterMuted" : "micMuted"],
    }));
  }, []);

  const setPlayheadSecondsClamped = useCallback(
    (seconds: number) => {
      const next = clamp(
        snapToTimelineFrame(seconds, timelineSnapEnabled, normalizedFrameRate),
        0,
        timelineDuration,
      );
      playbackTransport.seek(next);
    },
    [normalizedFrameRate, playbackTransport, timelineDuration, timelineSnapEnabled],
  );

  const setPlayheadSecondsFromMedia = useCallback(
    (seconds: number) => {
      playbackTransport.seek(clamp(seconds, 0, timelineDuration));
    },
    [playbackTransport, timelineDuration],
  );

  const setDisplayPlayheadSecondsFromMedia = useCallback(
    (seconds: number) => {
      playbackTransport.setDisplayTimeSeconds(clamp(seconds, 0, timelineDuration));
    },
    [playbackTransport, timelineDuration],
  );

  const setTimelinePlaybackActive = useCallback(
    (isActive: boolean) => {
      if (isActive) {
        playbackTransport.play();
        return;
      }
      playbackTransport.pause();
    },
    [playbackTransport],
  );

  const setIsTimelinePlaying = useCallback(
    (isActive: boolean) => {
      setTimelinePlaybackActive(isActive);
    },
    [setTimelinePlaybackActive],
  );

  const setPlaybackRate = useCallback(
    (rate: (typeof playbackRates)[number]) => {
      playbackTransport.setRate(rate);
    },
    [playbackTransport],
  );

  const setPlayheadSeconds = useCallback(
    (seconds: number) => {
      playbackTransport.seek(clamp(seconds, 0, timelineDuration));
    },
    [playbackTransport, timelineDuration],
  );

  const nudgePlayheadSeconds = useCallback(
    (deltaSeconds: number) => {
      const { playheadSeconds } = playbackTransport.getSnapshot();
      const next = clamp(
        snapToTimelineFrame(
          playheadSeconds + deltaSeconds,
          timelineSnapEnabled,
          normalizedFrameRate,
        ),
        0,
        timelineDuration,
      );
      playbackTransport.seek(next);
    },
    [normalizedFrameRate, playbackTransport, timelineDuration, timelineSnapEnabled],
  );

  const toggleTimelinePlayback = useCallback(() => {
    setTimelinePlaybackActive(!playbackTransport.getSnapshot().isPlaying);
  }, [playbackTransport, setTimelinePlaybackActive]);

  return {
    audioMixer,
    playbackStore: playbackTransport,
    nudgePlayheadSeconds,
    playbackRates,
    resetTimelineZoom,
    setAudioMixerGain,
    setIsTimelinePlaying,
    setPlayheadSeconds,
    setPlayheadSecondsClamped,
    setDisplayPlayheadSecondsFromMedia,
    setPlayheadSecondsFromMedia,
    setPlaybackRate,
    setTimelinePlaybackActive,
    setTimelineTool,
    setTimelineZoom,
    timelineDuration,
    timelineLaneControlState,
    timelineLanes,
    timelineSegments: compiledTimelineSegments,
    timelineRippleEnabled,
    timelineSnapEnabled,
    timelineTool,
    timelineZoomPercent,
    toggleAudioMixerMuted,
    toggleLaneControl,
    toggleTimelinePlayback,
    toggleTimelineRipple,
    toggleTimelineSnap,
    zoomTimelineIn,
    zoomTimelineOut,
  };
}
