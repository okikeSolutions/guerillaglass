import type { TimelineDocument } from "@guerillaglass/engine-contract/shared/valueObjects";

/** Stable identity for JSON editor state across native object-key ordering changes.
 * Arrays retain order. Absent optional properties remain distinct from empty arrays.
 */
export function editorStateSignature(value: unknown): string {
  return (
    JSON.stringify(value, (_key, entry: unknown) => {
      if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
        return entry;
      }
      return Object.fromEntries(
        Object.entries(entry).sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)),
      );
    }) ?? "undefined"
  );
}

/** Native response timestamps are metadata, not undoable timeline content. */
export function timelineContentSignature(timeline: TimelineDocument): string {
  return editorStateSignature({ version: timeline.version, items: timeline.items });
}
