import type { InputEvent, TimelineDocument, TimelineSegment } from "@guerillaglass/engine-protocol";

export type TimelineClipSemantic = "screen" | "mix";

export type TimelineWaveform = {
  peaks: number[];
  bucketSeconds: number;
  durationSeconds: number;
  source: "decoded" | "events";
};

export type TimelineClip = {
  id: string;
  startSeconds: number;
  endSeconds: number;
  sourceStartSeconds: number;
  sourceEndSeconds: number;
  semantic: TimelineClipSemantic;
  waveform: TimelineWaveform | null;
};

export type CompiledTimelineSegment = TimelineSegment & {
  index: number;
  programStartSeconds: number;
  programEndSeconds: number;
  durationSeconds: number;
};

export type TimelineEventMarkerKind = "move" | "click" | "mixed";

export type TimelineEventMarker = {
  id: string;
  timestampSeconds: number;
  kind: TimelineEventMarkerKind;
  density: number;
};

export type TimelineLane =
  | {
      id: "video" | "audio";
      label: string;
      clips: TimelineClip[];
      markers: [];
    }
  | {
      id: "events";
      label: string;
      clips: [];
      markers: TimelineEventMarker[];
    };

export function clampSeconds(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function createEmptyTimelineDocument(): TimelineDocument {
  return {
    version: 1,
    segments: [],
  };
}

export function createSingleSegmentTimelineDocument(
  recordingDurationSeconds: number,
): TimelineDocument {
  const duration = Math.max(0, recordingDurationSeconds);
  if (duration <= 0) {
    return createEmptyTimelineDocument();
  }

  return {
    version: 1,
    segments: [
      {
        id: "segment-0",
        sourceAssetId: "recording",
        sourceStartSeconds: 0,
        sourceEndSeconds: duration,
      },
    ],
  };
}

export function secondsToPixels(
  seconds: number,
  durationSeconds: number,
  widthPixels: number,
): number {
  if (durationSeconds <= 0 || widthPixels <= 0) {
    return 0;
  }
  return (clampSeconds(seconds, 0, durationSeconds) / durationSeconds) * widthPixels;
}

export function pixelsToSeconds(
  pixels: number,
  durationSeconds: number,
  widthPixels: number,
): number {
  if (durationSeconds <= 0 || widthPixels <= 0) {
    return 0;
  }
  return clampSeconds((pixels / widthPixels) * durationSeconds, 0, durationSeconds);
}

type BucketAggregate = {
  cursorMoves: number;
  clicks: number;
};

type TimelineLaneLabels = {
  video: string;
  audio: string;
  events: string;
};

function clampUnit(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

function normalizePeaks(peaks: number[]): number[] {
  const ceiling = peaks.reduce((maximum, current) => Math.max(maximum, current), 0);
  if (ceiling <= Number.EPSILON) {
    return peaks.map(() => 0.06);
  }
  return peaks.map((peak) => clampUnit(Math.max(peak / ceiling, 0.06)));
}

export function buildEventMarkers(
  events: InputEvent[],
  durationSeconds: number,
  options?: {
    minimumBucketSeconds?: number;
    maximumMarkers?: number;
  },
): TimelineEventMarker[] {
  if (durationSeconds <= 0 || events.length === 0) {
    return [];
  }

  const minimumBucketSeconds = options?.minimumBucketSeconds ?? 1 / 30;
  const maximumMarkers = options?.maximumMarkers ?? 400;
  const adaptiveBucketSeconds = Math.max(minimumBucketSeconds, durationSeconds / maximumMarkers);
  const buckets = new Map<number, BucketAggregate>();

  for (const event of events) {
    if (event.timestamp < 0 || event.timestamp > durationSeconds) {
      continue;
    }
    const index = Math.floor(event.timestamp / adaptiveBucketSeconds);
    const aggregate = buckets.get(index) ?? { cursorMoves: 0, clicks: 0 };
    if (event.type === "cursorMoved") {
      aggregate.cursorMoves += 1;
    } else {
      aggregate.clicks += 1;
    }
    buckets.set(index, aggregate);
  }

  return [...buckets.entries()]
    .sort(([left], [right]) => left - right)
    .map(([bucketIndex, aggregate]) => {
      const start = bucketIndex * adaptiveBucketSeconds;
      const midpoint = Math.min(start + adaptiveBucketSeconds * 0.5, durationSeconds);
      const total = aggregate.cursorMoves + aggregate.clicks;
      const kind: TimelineEventMarkerKind =
        aggregate.clicks > 0 && aggregate.cursorMoves > 0
          ? "mixed"
          : aggregate.clicks > 0
            ? "click"
            : "move";
      return {
        id: `event-${bucketIndex}`,
        timestampSeconds: midpoint,
        kind,
        density: total,
      };
    });
}

export function buildEventWaveform(
  events: InputEvent[],
  durationSeconds: number,
  options?: {
    minimumBuckets?: number;
    maximumBuckets?: number;
  },
): TimelineWaveform | null {
  if (durationSeconds <= 0) {
    return null;
  }

  const minimumBuckets = options?.minimumBuckets ?? 300;
  const maximumBuckets = options?.maximumBuckets ?? 1200;
  const requestedBuckets = Math.round(durationSeconds * 40);
  const bucketCount = Math.min(Math.max(requestedBuckets, minimumBuckets), maximumBuckets);
  const buckets = Array.from({ length: bucketCount }, () => 0.05);

  for (const event of events) {
    if (event.timestamp < 0 || event.timestamp > durationSeconds) {
      continue;
    }
    const ratio = durationSeconds > 0 ? event.timestamp / durationSeconds : 0;
    const bucketIndex = Math.min(bucketCount - 1, Math.max(0, Math.floor(ratio * bucketCount)));
    const increment = event.type === "cursorMoved" ? 0.06 : 0.3;
    buckets[bucketIndex] += increment;

    if (bucketIndex > 0) {
      buckets[bucketIndex - 1] += increment * 0.45;
    }
    if (bucketIndex + 1 < bucketCount) {
      buckets[bucketIndex + 1] += increment * 0.45;
    }
  }

  return {
    peaks: normalizePeaks(buckets),
    bucketSeconds: durationSeconds / bucketCount,
    durationSeconds,
    source: "events",
  };
}

export function compileTimelineSegments(
  timeline: TimelineDocument | null | undefined,
): CompiledTimelineSegment[] {
  if (!timeline || timeline.segments.length === 0) {
    return [];
  }

  let programCursorSeconds = 0;
  const compiledSegments: CompiledTimelineSegment[] = [];

  for (const segment of timeline.segments) {
    const durationSeconds = Math.max(0, segment.sourceEndSeconds - segment.sourceStartSeconds);
    if (durationSeconds <= Number.EPSILON) {
      continue;
    }

    const programStartSeconds = programCursorSeconds;
    const programEndSeconds = programStartSeconds + durationSeconds;
    compiledSegments.push({
      ...segment,
      index: compiledSegments.length,
      programStartSeconds,
      programEndSeconds,
      durationSeconds,
    });
    programCursorSeconds = programEndSeconds;
  }

  return compiledSegments;
}

export function timelineDurationSeconds(segments: CompiledTimelineSegment[]): number {
  const lastSegment = segments[segments.length - 1];
  return lastSegment?.programEndSeconds ?? 0;
}

export function findTimelineSegmentAtProgramTime(
  segments: CompiledTimelineSegment[],
  programSeconds: number,
): CompiledTimelineSegment | null {
  if (segments.length === 0) {
    return null;
  }

  const boundedProgramSeconds = clampSeconds(programSeconds, 0, timelineDurationSeconds(segments));
  for (const segment of segments) {
    if (boundedProgramSeconds < segment.programEndSeconds) {
      return segment;
    }
  }

  return segments[segments.length - 1] ?? null;
}

export function mapProgramSecondsToSourceTime(
  segments: CompiledTimelineSegment[],
  programSeconds: number,
): { segment: CompiledTimelineSegment; sourceSeconds: number } | null {
  const segment = findTimelineSegmentAtProgramTime(segments, programSeconds);
  if (!segment) {
    return null;
  }

  const boundedProgramSeconds = clampSeconds(
    programSeconds,
    segment.programStartSeconds,
    segment.programEndSeconds,
  );
  return {
    segment,
    sourceSeconds:
      segment.sourceStartSeconds + (boundedProgramSeconds - segment.programStartSeconds),
  };
}

export function remapInputEventsToProgramTime(
  events: InputEvent[],
  segments: CompiledTimelineSegment[],
): InputEvent[] {
  if (events.length === 0 || segments.length === 0) {
    return [];
  }

  return segments.flatMap((segment, segmentIndex) =>
    events.flatMap((event) => {
      const includesTimestamp =
        event.timestamp >= segment.sourceStartSeconds &&
        (event.timestamp < segment.sourceEndSeconds ||
          (segmentIndex === segments.length - 1 && event.timestamp === segment.sourceEndSeconds));
      if (!includesTimestamp) {
        return [];
      }

      return [
        {
          ...event,
          timestamp: segment.programStartSeconds + (event.timestamp - segment.sourceStartSeconds),
        },
      ];
    }),
  );
}

export function buildTimelineLanes(params: {
  timeline: TimelineDocument;
  events: InputEvent[];
  audioWaveform?: TimelineWaveform | null;
  labels?: TimelineLaneLabels;
}): TimelineLane[] {
  const compiledSegments = compileTimelineSegments(params.timeline);
  const duration = timelineDurationSeconds(compiledSegments);
  const labels = params.labels ?? {
    video: "Video",
    audio: "Audio",
    events: "Events",
  };
  const remappedEvents = remapInputEventsToProgramTime(params.events, compiledSegments);
  const fallbackWaveform =
    params.audioWaveform ?? buildEventWaveform(remappedEvents, duration) ?? null;

  return [
    {
      id: "video",
      label: labels.video,
      clips: compiledSegments.map((segment) => ({
        id: segment.id,
        startSeconds: segment.programStartSeconds,
        endSeconds: segment.programEndSeconds,
        sourceStartSeconds: segment.sourceStartSeconds,
        sourceEndSeconds: segment.sourceEndSeconds,
        semantic: "screen" as const,
        waveform: null,
      })),
      markers: [],
    },
    {
      id: "audio",
      label: labels.audio,
      clips: compiledSegments.map((segment) => ({
        id: segment.id,
        startSeconds: segment.programStartSeconds,
        endSeconds: segment.programEndSeconds,
        sourceStartSeconds: segment.sourceStartSeconds,
        sourceEndSeconds: segment.sourceEndSeconds,
        semantic: "mix" as const,
        waveform: fallbackWaveform,
      })),
      markers: [],
    },
    {
      id: "events",
      label: labels.events,
      clips: [],
      markers: buildEventMarkers(remappedEvents, duration),
    },
  ];
}
