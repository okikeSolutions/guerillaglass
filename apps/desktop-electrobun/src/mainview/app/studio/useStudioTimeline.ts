import { useCallback, useEffect, useMemo, useState } from "react";
import type { InputEvent } from "@guerillaglass/engine-protocol";
import { buildTimelineLanes } from "./timelineModel";

const playbackRates = [0.5, 1, 1.5, 2] as const;
const timelineZoomBounds = {
  minPercent: 75,
  maxPercent: 300,
};
const timelineSnapFrameSeconds = 1 / 30;

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

function snapToTimelineFrame(seconds: number, enabled: boolean): number {
  if (!enabled) {
    return seconds;
  }
  return Math.round(seconds / timelineSnapFrameSeconds) * timelineSnapFrameSeconds;
}

type UseStudioTimelineOptions = {
  activeMode: "capture" | "edit" | "deliver";
  recordingURL: string | null;
  recordingDurationSeconds: number;
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
  timelineEvents,
  laneLabels,
  trimStartSeconds,
  trimEndSeconds,
  onTrimStartSecondsChange,
  onTrimEndSecondsChange,
}: UseStudioTimelineOptions) {
  const [playheadSeconds, setPlayheadSeconds] = useState(0);
  const [isTimelinePlaying, setIsTimelinePlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<(typeof playbackRates)[number]>(1);
  const [timelineZoomPercent, setTimelineZoomPercent] = useState(100);
  const [timelineSnapEnabled, setTimelineSnapEnabled] = useState(true);
  const [timelineRippleEnabled, setTimelineRippleEnabled] = useState(false);
  const [timelineTool, setTimelineTool] = useState<TimelineTool>("select");
  const [timelineLaneControlState, setTimelineLaneControlState] =
    useState<TimelineLaneControlStateByLane>(defaultTimelineLaneControlState);
  const [audioMixer, setAudioMixer] = useState<AudioMixerState>(defaultAudioMixerState);

  const usesMediaPlaybackClock = activeMode === "edit" && Boolean(recordingURL);
  const timelineDuration = useMemo(
    () => Math.max(recordingDurationSeconds, trimStartSeconds, trimEndSeconds, 1),
    [recordingDurationSeconds, trimEndSeconds, trimStartSeconds],
  );
  const boundedPlayheadSeconds = useMemo(
    () => clamp(playheadSeconds, 0, timelineDuration),
    [playheadSeconds, timelineDuration],
  );
  const laneRecordingDurationSeconds = useMemo(() => {
    if (!recordingURL) {
      return 0;
    }
    return Math.max(recordingDurationSeconds, timelineDuration);
  }, [recordingDurationSeconds, recordingURL, timelineDuration]);
  const timelineLanes = useMemo(
    () =>
      buildTimelineLanes({
        recordingDurationSeconds: laneRecordingDurationSeconds,
        events: timelineEvents,
        labels: laneLabels,
      }),
    [laneLabels, laneRecordingDurationSeconds, timelineEvents],
  );

  useEffect(() => {
    if (!isTimelinePlaying || usesMediaPlaybackClock) {
      return;
    }

    const timer = setInterval(() => {
      setPlayheadSeconds((previous) => {
        const next = previous + 0.05 * playbackRate;
        if (next >= timelineDuration) {
          setIsTimelinePlaying(false);
          return timelineDuration;
        }
        return next;
      });
    }, 50);

    return () => clearInterval(timer);
  }, [isTimelinePlaying, playbackRate, timelineDuration, usesMediaPlaybackClock]);

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
      setPlayheadSeconds(
        clamp(snapToTimelineFrame(seconds, timelineSnapEnabled), 0, timelineDuration),
      );
    },
    [timelineDuration, timelineSnapEnabled],
  );

  const setPlayheadSecondsFromMedia = useCallback(
    (seconds: number) => {
      setPlayheadSeconds(clamp(seconds, 0, timelineDuration));
    },
    [timelineDuration],
  );

  const setTimelinePlaybackActive = useCallback((isActive: boolean) => {
    setIsTimelinePlaying(isActive);
  }, []);

  const setTrimStartSeconds = useCallback(
    (seconds: number) => {
      const nextTrimStart = clamp(
        snapToTimelineFrame(seconds, timelineSnapEnabled),
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
      timelineDuration,
      timelineSnapEnabled,
      trimEndSeconds,
    ],
  );

  const setTrimEndSeconds = useCallback(
    (seconds: number) => {
      const nextTrimEnd = clamp(
        snapToTimelineFrame(seconds, timelineSnapEnabled),
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
      timelineDuration,
      timelineSnapEnabled,
      trimStartSeconds,
    ],
  );

  const setTrimInFromPlayhead = useCallback(() => {
    setTrimStartSeconds(boundedPlayheadSeconds);
  }, [boundedPlayheadSeconds, setTrimStartSeconds]);

  const setTrimOutFromPlayhead = useCallback(() => {
    setTrimEndSeconds(boundedPlayheadSeconds);
  }, [boundedPlayheadSeconds, setTrimEndSeconds]);

  const nudgePlayheadSeconds = useCallback(
    (deltaSeconds: number) => {
      setPlayheadSeconds((current) =>
        clamp(
          snapToTimelineFrame(current + deltaSeconds, timelineSnapEnabled),
          0,
          timelineDuration,
        ),
      );
    },
    [timelineDuration, timelineSnapEnabled],
  );

  const toggleTimelinePlayback = useCallback(() => {
    setIsTimelinePlaying((previous) => !previous);
  }, []);

  return {
    audioMixer,
    isTimelinePlaying,
    nudgePlayheadSeconds,
    playheadSeconds: boundedPlayheadSeconds,
    playbackRate,
    playbackRates,
    resetTimelineZoom,
    setAudioMixerGain,
    setIsTimelinePlaying,
    setPlayheadSeconds,
    setPlayheadSecondsClamped,
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
