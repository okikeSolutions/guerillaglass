import type { InputEvent } from "@guerillaglass/engine-protocol";

export type TimelineClip = {
  id: string;
  startSeconds: number;
  endSeconds: number;
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

export function buildTimelineLanes(params: {
  recordingDurationSeconds: number;
  events: InputEvent[];
  labels?: TimelineLaneLabels;
}): TimelineLane[] {
  const duration = Math.max(0, params.recordingDurationSeconds);
  const labels = params.labels ?? {
    video: "Video",
    audio: "Audio",
    events: "Events",
  };
  const clip = {
    id: "clip-0",
    startSeconds: 0,
    endSeconds: duration,
  };

  return [
    {
      id: "video",
      label: labels.video,
      clips: duration > 0 ? [clip] : [],
      markers: [],
    },
    {
      id: "audio",
      label: labels.audio,
      clips: duration > 0 ? [clip] : [],
      markers: [],
    },
    {
      id: "events",
      label: labels.events,
      clips: [],
      markers: buildEventMarkers(params.events, duration),
    },
  ];
}
