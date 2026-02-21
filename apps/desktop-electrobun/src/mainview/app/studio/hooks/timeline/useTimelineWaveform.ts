import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { InputEvent } from "@guerillaglass/engine-protocol";
import { desktopApi } from "@/lib/engine";
import { toMediaSourceURL } from "../../model/mediaSourceUrl";
import { buildEventWaveform, type TimelineWaveform } from "../../model/timelineDomainModel";

type AudioContextConstructor = typeof AudioContext;

type UseTimelineWaveformOptions = {
  recordingURL: string | null;
  recordingDurationSeconds: number;
  timelineEvents: InputEvent[];
};

const waveformCache = new Map<string, TimelineWaveform>();

const timelineWaveformQueryKey = (recordingURL: string | null) =>
  ["studio", "timelineWaveform", recordingURL] as const;

function normalizePeaks(peaks: number[]): number[] {
  const ceiling = peaks.reduce((maximum, current) => Math.max(maximum, current), 0);
  if (ceiling <= Number.EPSILON) {
    return peaks.map(() => 0.05);
  }
  return peaks.map((peak) => Math.min(Math.max(Math.max(peak / ceiling, 0.05), 0), 1));
}

function getAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === "undefined") {
    return null;
  }
  const webkitWindow = window as Window & {
    webkitAudioContext?: AudioContextConstructor;
  };
  return window.AudioContext ?? webkitWindow.webkitAudioContext ?? null;
}

function buildDecodedWaveform(audioBuffer: AudioBuffer): TimelineWaveform {
  const durationSeconds = Math.max(0, audioBuffer.duration);
  const channels = Array.from({ length: audioBuffer.numberOfChannels }, (_, index) =>
    audioBuffer.getChannelData(index),
  );
  const bucketCount = Math.min(Math.max(Math.round(durationSeconds * 90), 500), 2400);
  const samplesPerBucket = Math.max(1, Math.floor(audioBuffer.length / bucketCount));
  const peaks = new Array<number>(bucketCount).fill(0);

  for (let bucketIndex = 0; bucketIndex < bucketCount; bucketIndex += 1) {
    const start = bucketIndex * samplesPerBucket;
    const end = Math.min(audioBuffer.length, start + samplesPerBucket);
    const span = Math.max(1, end - start);
    const step = Math.max(1, Math.floor(span / 96));
    let peak = 0;

    for (let sampleIndex = start; sampleIndex < end; sampleIndex += step) {
      let amplitude = 0;
      for (const channel of channels) {
        amplitude += Math.abs(channel[sampleIndex] ?? 0);
      }
      amplitude /= Math.max(channels.length, 1);
      peak = Math.max(peak, amplitude);
    }

    peaks[bucketIndex] = peak;
  }

  const normalizedPeaks = normalizePeaks(peaks);
  return {
    peaks: normalizedPeaks,
    bucketSeconds: durationSeconds > 0 ? durationSeconds / normalizedPeaks.length : 0,
    durationSeconds,
    source: "decoded",
  };
}

async function decodeWaveform(
  sourceURL: string,
  signal: AbortSignal | undefined,
): Promise<TimelineWaveform | null> {
  const AudioContextCtor = getAudioContextConstructor();
  if (!AudioContextCtor) {
    return null;
  }

  const response = await fetch(sourceURL, { signal });
  if (!response.ok) {
    return null;
  }

  const sourceBuffer = await response.arrayBuffer();
  if (sourceBuffer.byteLength === 0) {
    return null;
  }

  const audioContext = new AudioContextCtor();
  try {
    const decodedBuffer = await audioContext.decodeAudioData(sourceBuffer.slice(0));
    return buildDecodedWaveform(decodedBuffer);
  } finally {
    void audioContext.close().catch(() => {});
  }
}

function hasBridgeMediaResolver(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const bridgeWindow = window as Window & {
    ggResolveMediaSourceURL?: (...args: unknown[]) => Promise<string>;
  };
  return typeof bridgeWindow.ggResolveMediaSourceURL === "function";
}

async function resolveWaveformSourceURL(recordingURL: string): Promise<string | null> {
  if (recordingURL.startsWith("stub://") || recordingURL.startsWith("native://")) {
    return null;
  }
  if (!hasBridgeMediaResolver()) {
    return toMediaSourceURL(recordingURL);
  }
  try {
    return await desktopApi.resolveMediaSourceURL(recordingURL);
  } catch {
    return null;
  }
}

async function loadDecodedWaveform(
  recordingURL: string,
  signal: AbortSignal | undefined,
): Promise<TimelineWaveform | null> {
  const mediaSourceURL = await resolveWaveformSourceURL(recordingURL);
  if (!mediaSourceURL) {
    return null;
  }

  const cachedWaveform = waveformCache.get(mediaSourceURL);
  if (cachedWaveform) {
    return cachedWaveform;
  }

  const waveform = await decodeWaveform(mediaSourceURL, signal);
  if (waveform) {
    waveformCache.set(mediaSourceURL, waveform);
  }
  return waveform;
}

export function useTimelineWaveform({
  recordingURL,
  recordingDurationSeconds,
  timelineEvents,
}: UseTimelineWaveformOptions): TimelineWaveform | null {
  const decodedWaveformQuery = useQuery<TimelineWaveform | null>({
    queryKey: timelineWaveformQueryKey(recordingURL),
    enabled: Boolean(recordingURL),
    queryFn: async ({ signal }) => {
      if (!recordingURL) {
        return null;
      }
      try {
        return await loadDecodedWaveform(recordingURL, signal);
      } catch {
        return null;
      }
    },
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });

  return useMemo(() => {
    if (decodedWaveformQuery.data) {
      return decodedWaveformQuery.data;
    }
    return buildEventWaveform(timelineEvents, recordingDurationSeconds);
  }, [decodedWaveformQuery.data, recordingDurationSeconds, timelineEvents]);
}
