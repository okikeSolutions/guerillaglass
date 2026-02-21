import { useCallback, useEffect, useMemo, useState } from "react";
import type { InputEvent } from "@guerillaglass/engine-protocol";
import { buildTimelineLanes } from "./timelineModel";
import {
  defaultTimelineFrameRate,
  normalizeTimelineFrameRate,
  quantizeSecondsToFrame,
} from "./timelineTimebase";
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
  timelineFrameRate?: number;
  timelineEvents: InputEvent[];
  laneLabels: {
    video: string;
    audio: string;
    events: string;
  };
  trimStartSeconds: number;
  trimEndSeconds: number;
  onTrimStartSecondsChange: (seconds: number) => void;
  onTrimEndSecondsChange: (seconds: number) => void;
};

export function useStudioTimeline({
  activeMode,
  recordingURL,
  recordingDurationSeconds,
  timelineFrameRate = defaultTimelineFrameRate,
  timelineEvents,
  laneLabels,
  trimStartSeconds,
  trimEndSeconds,
  onTrimStartSecondsChange,
  onTrimEndSecondsChange,
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
  const timelineDuration = useMemo(
    () => Math.max(recordingDurationSeconds, trimStartSeconds, trimEndSeconds, 1),
    [recordingDurationSeconds, trimEndSeconds, trimStartSeconds],
  );
  const playbackTransport = usePlaybackTransport({
    durationSeconds: timelineDuration,
    frameRate: normalizedFrameRate,
  });
  const {
    advance,
    displayTimeSeconds,
    editTimeSeconds,
    isPlaying,
    pause,
    play,
    playbackRate: transportPlaybackRate,
    seek,
    setDisplayTimeSeconds,
    setRate,
  } = playbackTransport;
  const isTimelinePlaying = isPlaying;
  const playbackRate = transportPlaybackRate as (typeof playbackRates)[number];
  const boundedDisplayPlayheadSeconds = useMemo(
    () => clamp(displayTimeSeconds, 0, timelineDuration),
    [displayTimeSeconds, timelineDuration],
  );
  const boundedEditPlayheadSeconds = useMemo(
    () => clamp(editTimeSeconds, 0, timelineDuration),
    [editTimeSeconds, timelineDuration],
  );
  const laneRecordingDurationSeconds = useMemo(() => {
    if (!recordingURL) {
      return 0;
    }
    return Math.max(recordingDurationSeconds, timelineDuration);
  }, [recordingDurationSeconds, recordingURL, timelineDuration]);
  const audioWaveform = useTimelineWaveform({
    recordingURL,
    recordingDurationSeconds: laneRecordingDurationSeconds,
    timelineEvents,
  });
  const timelineLanes = useMemo(
    () =>
      buildTimelineLanes({
        recordingDurationSeconds: laneRecordingDurationSeconds,
        events: timelineEvents,
        audioWaveform,
        labels: laneLabels,
      }),
    [audioWaveform, laneLabels, laneRecordingDurationSeconds, timelineEvents],
  );

  useEffect(() => {
    if (!isTimelinePlaying || usesMediaPlaybackClock) {
      return;
    }

    const tickMs = 50;
    const timer = setInterval(() => {
      const next = advance(tickMs);
      if (next >= timelineDuration) {
        pause();
      }
    }, tickMs);

    return () => clearInterval(timer);
  }, [advance, isTimelinePlaying, pause, timelineDuration, usesMediaPlaybackClock]);

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
      seek(next);
    },
    [normalizedFrameRate, seek, timelineDuration, timelineSnapEnabled],
  );

  const setPlayheadSecondsFromMedia = useCallback(
    (seconds: number) => {
      seek(clamp(seconds, 0, timelineDuration));
    },
    [seek, timelineDuration],
  );

  const setDisplayPlayheadSecondsFromMedia = useCallback(
    (seconds: number) => {
      setDisplayTimeSeconds(clamp(seconds, 0, timelineDuration));
    },
    [setDisplayTimeSeconds, timelineDuration],
  );

  const setTimelinePlaybackActive = useCallback(
    (isActive: boolean) => {
      if (isActive) {
        play();
        return;
      }
      pause();
    },
    [pause, play],
  );

  const setIsTimelinePlaying = useCallback(
    (isActive: boolean) => {
      setTimelinePlaybackActive(isActive);
    },
    [setTimelinePlaybackActive],
  );

  const setPlaybackRate = useCallback(
    (rate: (typeof playbackRates)[number]) => {
      setRate(rate);
    },
    [setRate],
  );

  const setPlayheadSeconds = useCallback(
    (seconds: number) => {
      seek(clamp(seconds, 0, timelineDuration));
    },
    [seek, timelineDuration],
  );

  const setTrimStartSeconds = useCallback(
    (seconds: number) => {
      const nextTrimStart = clamp(
        snapToTimelineFrame(seconds, timelineSnapEnabled, normalizedFrameRate),
        0,
        timelineDuration,
      );
      onTrimStartSecondsChange(nextTrimStart);
      if (trimEndSeconds > 0 && nextTrimStart > trimEndSeconds) {
        onTrimEndSecondsChange(nextTrimStart);
      }
    },
    [
      onTrimEndSecondsChange,
      onTrimStartSecondsChange,
      normalizedFrameRate,
      timelineDuration,
      timelineSnapEnabled,
      trimEndSeconds,
    ],
  );

  const setTrimEndSeconds = useCallback(
    (seconds: number) => {
      const nextTrimEnd = clamp(
        snapToTimelineFrame(seconds, timelineSnapEnabled, normalizedFrameRate),
        0,
        timelineDuration,
      );
      onTrimEndSecondsChange(nextTrimEnd);
      if (trimStartSeconds > nextTrimEnd) {
        onTrimStartSecondsChange(nextTrimEnd);
      }
    },
    [
      onTrimEndSecondsChange,
      onTrimStartSecondsChange,
      normalizedFrameRate,
      timelineDuration,
      timelineSnapEnabled,
      trimStartSeconds,
    ],
  );

  const setTrimInFromPlayhead = useCallback(() => {
    setTrimStartSeconds(boundedDisplayPlayheadSeconds);
  }, [boundedDisplayPlayheadSeconds, setTrimStartSeconds]);

  const setTrimOutFromPlayhead = useCallback(() => {
    setTrimEndSeconds(boundedDisplayPlayheadSeconds);
  }, [boundedDisplayPlayheadSeconds, setTrimEndSeconds]);

  const nudgePlayheadSeconds = useCallback(
    (deltaSeconds: number) => {
      const next = clamp(
        snapToTimelineFrame(
          displayTimeSeconds + deltaSeconds,
          timelineSnapEnabled,
          normalizedFrameRate,
        ),
        0,
        timelineDuration,
      );
      seek(next);
    },
    [displayTimeSeconds, normalizedFrameRate, seek, timelineDuration, timelineSnapEnabled],
  );

  const toggleTimelinePlayback = useCallback(() => {
    setTimelinePlaybackActive(!isTimelinePlaying);
  }, [isTimelinePlaying, setTimelinePlaybackActive]);

  return {
    audioMixer,
    editPlayheadSeconds: boundedEditPlayheadSeconds,
    isTimelinePlaying,
    nudgePlayheadSeconds,
    playheadSeconds: boundedDisplayPlayheadSeconds,
    playbackRate,
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
    setTrimEndSeconds,
    setTrimInFromPlayhead,
    setTrimOutFromPlayhead,
    setTrimStartSeconds,
    timelineDuration,
    timelineLaneControlState,
    timelineLanes,
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
