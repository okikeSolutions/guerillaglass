import { useQuery } from "@tanstack/react-query";
import type { InputEvent } from "@guerillaglass/engine-contract/shared/valueObjects";
import { desktopApi } from "@lib/engine";
import { toMediaSourceURL } from "../../domain/mediaSourceUrl";
import type { TimelineWaveform } from "../../domain/timelineDomainModel";
import type { SourceAudioPresentation } from "../../domain/sourceAudioPresentation";

type AudioContextConstructor = typeof AudioContext;

type UseTimelineWaveformOptions = {
  recordingURL: string | null;
  embeddedAudioTrackCount?: number | null;
  recordingDurationSeconds: number;
  timelineEvents: InputEvent[];
};

const timelineWaveformQueryKey = (recordingURL: string | null, trackCount: number | null) =>
  ["studio", "timelineWaveform", recordingURL, trackCount] as const;

function normalizePeaks(peaks: number[]): number[] {
  const ceiling = peaks.reduce((maximum, current) => Math.max(maximum, current), 0);
  if (ceiling <= Number.EPSILON) {
    return peaks.map(() => 0);
  }
  return peaks.map((peak) => Math.min(Math.max(peak / ceiling, 0), 1));
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
  const peaks = Array.from({ length: bucketCount }, () => 0);

  for (let bucketIndex = 0; bucketIndex < bucketCount; bucketIndex += 1) {
    const start = Math.floor((bucketIndex * audioBuffer.length) / bucketCount);
    const end = Math.floor(((bucketIndex + 1) * audioBuffer.length) / bucketCount);
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

  // Only label digital silence after checking unsampled PCM too. A short
  // transient between the bounded peak samples must not become a silence claim.
  if (!peaks.some((peak) => peak !== 0)) {
    for (const channel of channels) {
      const index = channel.findIndex((sample) => sample !== 0);
      if (index >= 0) {
        peaks[Math.min(bucketCount - 1, Math.floor((index / audioBuffer.length) * bucketCount))] =
          Math.abs(channel[index] ?? 0);
        break;
      }
    }
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

  const declaredSize = Number(response.headers.get("content-length"));
  const maximumAudioSourceBytes = 64 * 1024 * 1024;
  if (declaredSize > maximumAudioSourceBytes) {
    await response.body?.cancel();
    return null;
  }
  const reader = response.body?.getReader();
  if (!reader) {
    return null;
  }
  const chunks: Uint8Array[] = [];
  let byteCount = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) {
        break;
      }
      byteCount += chunk.value.byteLength;
      if (byteCount > maximumAudioSourceBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  if (byteCount === 0) {
    return null;
  }
  const bytes = new Uint8Array(byteCount);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const audioContext = new AudioContextCtor();
  try {
    const decodedBuffer = await audioContext.decodeAudioData(bytes.buffer);
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

  return await decodeWaveform(mediaSourceURL, signal);
}

export function useTimelineWaveform({
  recordingURL,
  embeddedAudioTrackCount = null,
}: UseTimelineWaveformOptions): SourceAudioPresentation {
  const decodedWaveformQuery = useQuery<SourceAudioPresentation>({
    queryKey: timelineWaveformQueryKey(recordingURL, embeddedAudioTrackCount),
    enabled: Boolean(recordingURL) && embeddedAudioTrackCount !== 0,
    queryFn: async ({ signal }) => {
      if (!recordingURL) {
        return { status: "idle", waveform: null };
      }
      try {
        const waveform = await loadDecodedWaveform(recordingURL, signal);
        if (!waveform) {
          return { status: "unavailable", waveform: null };
        }
        return waveform.peaks.every((peak) => peak === 0)
          ? { status: "silent", waveform: null }
          : { status: "decoded", waveform };
      } catch {
        // Decoder rejection does not distinguish missing audio from an unsupported container.
        return { status: "unavailable", waveform: null };
      }
    },
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });

  if (!recordingURL) {
    return { status: "idle", waveform: null };
  }
  if (embeddedAudioTrackCount === 0) {
    return { status: "no-audio", waveform: null };
  }
  if (decodedWaveformQuery.isPending) {
    return { status: "loading", waveform: null };
  }
  return decodedWaveformQuery.data ?? { status: "unavailable", waveform: null };
}
