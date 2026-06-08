import type {
  TimelineClipItem,
  TimelineDocument,
  TimelineGapItem,
  TimelineItem,
} from "@guerillaglass/engine/protocol/shared/valueObjects";
import { compileTimelineItems } from "./timelineDomainModel";

type TimelineIdFactory = () => string;

type TimelineEditResult = {
  timeline: TimelineDocument;
  changed: boolean;
};

type MoveTimelineItemsOptions =
  | {
      ripple: true;
      destinationIndex: number;
    }
  | {
      ripple: false;
      destinationGapId: string;
    };

function defaultTimelineIdFactory(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `timeline-${Math.random().toString(36).slice(2, 10)}`;
}

export function timelineItemDurationSeconds(item: TimelineItem): number {
  if (item.kind === "gap") {
    return Math.max(0, item.durationSeconds);
  }
  return Math.max(0, item.sourceEndSeconds - item.sourceStartSeconds);
}

export function normalizeTimelineDocument(timeline: TimelineDocument): TimelineDocument {
  const normalizedItems: TimelineItem[] = [];

  for (const item of timeline.items) {
    const durationSeconds = timelineItemDurationSeconds(item);
    if (durationSeconds <= Number.EPSILON) {
      continue;
    }

    if (item.kind === "gap") {
      const previousItem = normalizedItems[normalizedItems.length - 1];
      if (previousItem?.kind === "gap") {
        normalizedItems.splice(normalizedItems.length - 1, 1, {
          ...previousItem,
          durationSeconds: previousItem.durationSeconds + durationSeconds,
        });
        continue;
      }

      normalizedItems.push({
        ...item,
        durationSeconds,
      });
      continue;
    }

    normalizedItems.push(item);
  }

  return {
    version: 2,
    items: normalizedItems,
  };
}

function replaceItemRange(
  items: ReadonlyArray<TimelineItem>,
  startIndex: number,
  deleteCount: number,
  nextItems: ReadonlyArray<TimelineItem>,
): TimelineItem[] {
  const clone = [...items];
  clone.splice(startIndex, deleteCount, ...nextItems);
  return clone;
}

function selectedIndexRuns(
  items: ReadonlyArray<TimelineItem>,
  selectedItemIds: Set<string>,
): Array<[number, number]> {
  const runs: Array<[number, number]> = [];
  let index = 0;

  while (index < items.length) {
    if (!selectedItemIds.has(items[index]!.id)) {
      index += 1;
      continue;
    }

    const runStart = index;
    let runEnd = index;
    while (runEnd + 1 < items.length && selectedItemIds.has(items[runEnd + 1]!.id)) {
      runEnd += 1;
    }
    runs.push([runStart, runEnd]);
    index = runEnd + 1;
  }

  return runs;
}

function buildGapItem(durationSeconds: number, idFactory: TimelineIdFactory): TimelineGapItem {
  return {
    kind: "gap",
    id: idFactory(),
    durationSeconds,
  };
}

function normalizeIndex(index: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(index, minimum), maximum);
}

export function splitTimelineClipAtProgramTime(
  timeline: TimelineDocument,
  programSeconds: number,
  idFactory: TimelineIdFactory = defaultTimelineIdFactory,
): TimelineEditResult {
  const compiledItems = compileTimelineItems(timeline);
  const target = compiledItems.find((item) => {
    return (
      item.kind === "clip" &&
      programSeconds > item.programStartSeconds &&
      programSeconds < item.programEndSeconds
    );
  });

  if (!target || target.kind !== "clip") {
    return { timeline, changed: false };
  }

  const splitSeconds = target.sourceStartSeconds + (programSeconds - target.programStartSeconds);
  if (
    splitSeconds <= target.sourceStartSeconds + Number.EPSILON ||
    splitSeconds >= target.sourceEndSeconds - Number.EPSILON
  ) {
    return { timeline, changed: false };
  }

  const leftClip: TimelineClipItem = {
    kind: "clip",
    id: target.id,
    sourceAssetId: target.sourceAssetId,
    sourceStartSeconds: target.sourceStartSeconds,
    sourceEndSeconds: splitSeconds,
  };
  const rightClip: TimelineClipItem = {
    kind: "clip",
    id: idFactory(),
    sourceAssetId: target.sourceAssetId,
    sourceStartSeconds: splitSeconds,
    sourceEndSeconds: target.sourceEndSeconds,
  };

  return {
    timeline: normalizeTimelineDocument({
      version: 2,
      items: replaceItemRange(timeline.items, target.index, 1, [leftClip, rightClip]),
    }),
    changed: true,
  };
}

export function liftTimelineItems(
  timeline: TimelineDocument,
  selectedItemIds: string[],
  idFactory: TimelineIdFactory = defaultTimelineIdFactory,
): TimelineEditResult {
  if (selectedItemIds.length === 0) {
    return { timeline, changed: false };
  }

  const selectedSet = new Set(selectedItemIds);
  const runs = selectedIndexRuns(timeline.items, selectedSet);
  if (runs.length === 0) {
    return { timeline, changed: false };
  }

  let nextItems = [...timeline.items];
  for (let runIndex = runs.length - 1; runIndex >= 0; runIndex -= 1) {
    const [startIndex, endIndex] = runs[runIndex]!;
    const runItems = nextItems.slice(startIndex, endIndex + 1);
    const durationSeconds = runItems.reduce(
      (sum, item) => sum + timelineItemDurationSeconds(item),
      0,
    );
    const replacement =
      durationSeconds > Number.EPSILON ? [buildGapItem(durationSeconds, idFactory)] : [];
    nextItems = replaceItemRange(nextItems, startIndex, runItems.length, replacement);
  }

  return {
    timeline: normalizeTimelineDocument({
      version: 2,
      items: nextItems,
    }),
    changed: true,
  };
}

export function deleteTimelineItems(
  timeline: TimelineDocument,
  selectedItemIds: string[],
  options: { ripple: boolean },
  idFactory: TimelineIdFactory = defaultTimelineIdFactory,
): TimelineEditResult {
  if (selectedItemIds.length === 0) {
    return { timeline, changed: false };
  }

  if (!options.ripple) {
    return liftTimelineItems(timeline, selectedItemIds, idFactory);
  }

  const selectedSet = new Set(selectedItemIds);
  const nextItems = timeline.items.filter((item) => !selectedSet.has(item.id));
  if (nextItems.length === timeline.items.length) {
    return { timeline, changed: false };
  }

  return {
    timeline: normalizeTimelineDocument({
      version: 2,
      items: nextItems,
    }),
    changed: true,
  };
}

export function moveTimelineItems(
  timeline: TimelineDocument,
  selectedItemIds: string[],
  options: MoveTimelineItemsOptions,
  idFactory: TimelineIdFactory = defaultTimelineIdFactory,
): TimelineEditResult {
  if (selectedItemIds.length === 0) {
    return { timeline, changed: false };
  }

  const selectedSet = new Set(selectedItemIds);
  const movingItems = timeline.items.filter((item) => selectedSet.has(item.id));
  if (movingItems.length === 0) {
    return { timeline, changed: false };
  }

  if (options.ripple) {
    const indexedItems = timeline.items.map((item, index) => ({ item, index }));
    const selectedIndices = indexedItems
      .filter(({ item }) => selectedSet.has(item.id))
      .map(({ index }) => index);
    const firstSelectedIndex = selectedIndices[0];
    const lastSelectedIndex = selectedIndices[selectedIndices.length - 1];
    const destinationIndex = normalizeIndex(options.destinationIndex, 0, timeline.items.length);
    if (
      firstSelectedIndex == null ||
      lastSelectedIndex == null ||
      (destinationIndex >= firstSelectedIndex && destinationIndex <= lastSelectedIndex + 1)
    ) {
      return { timeline, changed: false };
    }

    const remainingItems = timeline.items.filter((item) => !selectedSet.has(item.id));
    const removedBeforeDestination = selectedIndices.filter(
      (index) => index < destinationIndex,
    ).length;
    const adjustedDestinationIndex = normalizeIndex(
      destinationIndex - removedBeforeDestination,
      0,
      remainingItems.length,
    );
    const nextItems = [...remainingItems];
    nextItems.splice(adjustedDestinationIndex, 0, ...movingItems);

    return {
      timeline: normalizeTimelineDocument({
        version: 2,
        items: nextItems,
      }),
      changed: true,
    };
  }

  const lifted = liftTimelineItems(timeline, selectedItemIds, idFactory);
  if (!lifted.changed) {
    return lifted;
  }

  const destinationIndex = lifted.timeline.items.findIndex(
    (item) => item.kind === "gap" && item.id === options.destinationGapId,
  );
  if (destinationIndex === -1) {
    return { timeline, changed: false };
  }

  const destinationGap = lifted.timeline.items[destinationIndex];
  if (!destinationGap || destinationGap.kind !== "gap") {
    return { timeline, changed: false };
  }

  const movingDurationSeconds = movingItems.reduce(
    (sum, item) => sum + timelineItemDurationSeconds(item),
    0,
  );
  if (movingDurationSeconds > destinationGap.durationSeconds + Number.EPSILON) {
    return { timeline, changed: false };
  }

  const gapRemainderSeconds = destinationGap.durationSeconds - movingDurationSeconds;
  const replacementItems: TimelineItem[] = [...movingItems];
  if (gapRemainderSeconds > Number.EPSILON) {
    replacementItems.push({
      kind: "gap",
      id: destinationGap.id,
      durationSeconds: gapRemainderSeconds,
    });
  }

  return {
    timeline: normalizeTimelineDocument({
      version: 2,
      items: replaceItemRange(lifted.timeline.items, destinationIndex, 1, replacementItems),
    }),
    changed: true,
  };
}
