import type {
  AutoZoomSettings,
  BackgroundFramingSettings,
  TimelineDocument,
} from "@guerillaglass/engine-contract/shared/valueObjects";
import { editorStateSignature, timelineContentSignature } from "./editorStateSignature";

export type EditorVisualSettings = {
  readonly autoZoom: AutoZoomSettings;
  readonly backgroundFraming: BackgroundFramingSettings;
};
export type EditorDocument = EditorVisualSettings & { readonly timeline: TimelineDocument };
export type EditorDocumentHistory = {
  readonly present: EditorDocument;
  readonly past: ReadonlyArray<EditorDocument>;
  readonly future: ReadonlyArray<EditorDocument>;
};

export function editorDocumentSignature(document: EditorDocument): string {
  return editorStateSignature({
    timeline: timelineContentSignature(document.timeline),
    autoZoom: document.autoZoom,
    backgroundFraming: document.backgroundFraming,
  });
}
export function createEditorDocumentHistory(document: EditorDocument): EditorDocumentHistory {
  return { present: document, past: [], future: [] };
}

/** Refine generated source metadata only where it remains unedited. Local cuts,
 * visual settings and both undo directions retain their ownership of the draft.
 */
export function rebaseGeneratedTimeline(
  history: EditorDocumentHistory,
  previousTimelineSignature: string,
  timeline: TimelineDocument,
): EditorDocumentHistory {
  if (timelineContentSignature(timeline) === previousTimelineSignature) {
    return history;
  }
  const rebase = (document: EditorDocument): EditorDocument =>
    timelineContentSignature(document.timeline) === previousTimelineSignature
      ? { ...document, timeline }
      : document;
  return {
    present: rebase(history.present),
    past: history.past.map(rebase),
    future: history.future.map(rebase),
  };
}
/** Native metadata and semantic no-ops preserve redo. New edits discard it. */
export function recordEditorDocumentEdit(
  history: EditorDocumentHistory,
  document: EditorDocument,
): EditorDocumentHistory {
  if (editorDocumentSignature(history.present) === editorDocumentSignature(document)) {
    return history;
  }
  return { present: document, past: [...history.past.slice(-99), history.present], future: [] };
}
export function undoEditorDocumentEdit(history: EditorDocumentHistory): EditorDocumentHistory {
  const previous = history.past[history.past.length - 1];
  if (!previous) {
    return history;
  }
  return {
    present: previous,
    past: history.past.slice(0, -1),
    future: [history.present, ...history.future],
  };
}
export function redoEditorDocumentEdit(history: EditorDocumentHistory): EditorDocumentHistory {
  const next = history.future[0];
  if (!next) {
    return history;
  }
  return {
    present: next,
    past: [...history.past, history.present],
    future: history.future.slice(1),
  };
}
