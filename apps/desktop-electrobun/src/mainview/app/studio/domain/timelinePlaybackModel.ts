import {
  clampSeconds,
  timelineDurationSeconds,
  type CompiledTimelineItem,
} from "./timelineDomainModel";

type CompiledTimelineClip = Extract<CompiledTimelineItem, { kind: "clip" }>;
type CompiledTimelineGap = Extract<CompiledTimelineItem, { kind: "gap" }>;

export type TimelinePlaybackResolution =
  | {
      kind: "clip";
      item: CompiledTimelineClip;
      sourceSeconds: number;
    }
  | {
      kind: "gap";
      item: CompiledTimelineGap;
    }
  | {
      kind: "ended";
      durationSeconds: number;
    }
  | {
      kind: "empty";
    };

export function resolveTimelinePlaybackAtProgramTime(
  items: CompiledTimelineItem[],
  programSeconds: number,
): TimelinePlaybackResolution {
  const durationSeconds = timelineDurationSeconds(items);
  if (items.length === 0 || durationSeconds <= 0) {
    return { kind: "empty" };
  }

  if (!Number.isFinite(programSeconds)) {
    return resolveTimelinePlaybackAtProgramTime(items, 0);
  }

  if (programSeconds >= durationSeconds) {
    return { kind: "ended", durationSeconds };
  }

  const boundedProgramSeconds = clampSeconds(programSeconds, 0, durationSeconds);
  const item = items.find(
    (candidate) =>
      boundedProgramSeconds >= candidate.programStartSeconds &&
      boundedProgramSeconds < candidate.programEndSeconds,
  );

  if (!item) {
    return { kind: "ended", durationSeconds };
  }

  if (item.kind === "gap") {
    return { kind: "gap", item };
  }

  return {
    kind: "clip",
    item,
    sourceSeconds: item.sourceStartSeconds + (boundedProgramSeconds - item.programStartSeconds),
  };
}

export function findNextPlayableClipAfterProgramTime(
  items: CompiledTimelineItem[],
  programSeconds: number,
): CompiledTimelineClip | null {
  if (!Number.isFinite(programSeconds)) {
    return items.find((item): item is CompiledTimelineClip => item.kind === "clip") ?? null;
  }

  return (
    items.find(
      (item): item is CompiledTimelineClip =>
        item.kind === "clip" && item.programEndSeconds > programSeconds,
    ) ?? null
  );
}
