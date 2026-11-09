import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { TimelineDocument } from "@guerillaglass/engine-contract/shared/valueObjects";
import {
  createEditorDocumentHistory,
  editorDocumentSignature,
  recordEditorDocumentEdit,
  undoEditorDocumentEdit,
  redoEditorDocumentEdit,
  type EditorDocument,
  type EditorDocumentHistory,
  type EditorVisualSettings,
} from "../../domain/editorDocumentHistory";
import { editorStateSignature } from "../../domain/editorStateSignature";

export type EditorSettingsAdapter = {
  getValues: () => EditorVisualSettings;
  restore: (settings: EditorVisualSettings) => void;
  subscribe: (listener: () => void) => () => void;
};
type Draft = { history: EditorDocumentHistory; sourceSignature: string; projectIdentity: string };

/** One undo history owns every persisted edit, including form-backed visual settings. */
export function useEditorDocumentHistory({
  baseline,
  projectIdentity,
  generatedTimeline,
  settings,
  canEdit,
}: {
  baseline: EditorDocument;
  projectIdentity: string;
  generatedTimeline: boolean;
  settings: EditorSettingsAdapter;
  canEdit: () => boolean;
}) {
  const sourceSignature = editorDocumentSignature(baseline);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pendingSave, setPendingSave] = useState<Draft | null>(null);
  const saved =
    pendingSave?.projectIdentity === projectIdentity &&
    pendingSave.sourceSignature === sourceSignature
      ? pendingSave
      : null;
  const currentHistory = saved
    ? recordEditorDocumentEdit(saved.history, baseline)
    : draft?.projectIdentity === projectIdentity
      ? draft.sourceSignature === sourceSignature
        ? draft.history
        : generatedTimeline
          ? createEditorDocumentHistory({ ...draft.history.present, timeline: baseline.timeline })
          : recordEditorDocumentEdit(draft.history, baseline)
      : createEditorDocumentHistory(baseline);
  // Reconcile native snapshots during this render; hydration below runs before
  // paint and suppresses form-store recording, never creating a second edit.
  if (draft?.projectIdentity !== projectIdentity || draft.sourceSignature !== sourceSignature) {
    setDraft({ history: currentHistory, sourceSignature, projectIdentity });
  }
  if (saved) {
    setPendingSave(null);
  }
  const historyRef = useRef(currentHistory);
  const restoring = useRef(false);
  const restoreVisuals = useCallback(
    (document: EditorDocument) => {
      const visual = { autoZoom: document.autoZoom, backgroundFraming: document.backgroundFraming };
      const current = settings.getValues();
      if (
        editorStateSignature(visual) ===
        editorStateSignature({
          autoZoom: current.autoZoom,
          backgroundFraming: current.backgroundFraming,
        })
      ) {
        return;
      }
      restoring.current = true;
      try {
        settings.restore(visual);
      } finally {
        restoring.current = false;
      }
    },
    [settings],
  );
  const commit = useCallback(
    (history: EditorDocumentHistory) => {
      historyRef.current = history;
      restoreVisuals(history.present);
      setDraft({ history, sourceSignature, projectIdentity });
    },
    [projectIdentity, sourceSignature, restoreVisuals],
  );
  useLayoutEffect(() => {
    historyRef.current = currentHistory;
    restoreVisuals(currentHistory.present);
  }, [currentHistory, restoreVisuals]);
  useLayoutEffect(
    () =>
      settings.subscribe(() => {
        if (restoring.current) {
          return;
        }
        const values = settings.getValues();
        const next = {
          ...historyRef.current.present,
          autoZoom: values.autoZoom,
          backgroundFraming: values.backgroundFraming,
        };
        const history = recordEditorDocumentEdit(historyRef.current, next);
        if (history === historyRef.current) {
          return;
        }
        if (!canEdit()) {
          restoreVisuals(historyRef.current.present);
          return;
        }
        commit(history);
      }),
    [settings, canEdit, commit, restoreVisuals],
  );
  const updateTimelineDocument = useCallback(
    (updater: (timeline: TimelineDocument) => TimelineDocument) => {
      if (!canEdit()) {
        return;
      }
      const present = historyRef.current.present;
      commit(
        recordEditorDocumentEdit(historyRef.current, {
          ...present,
          timeline: updater(present.timeline),
        }),
      );
    },
    [canEdit, commit],
  );
  const undoTimeline = useCallback(() => {
    if (canEdit()) {
      commit(undoEditorDocumentEdit(historyRef.current));
    }
  }, [canEdit, commit]);
  const redoTimeline = useCallback(() => {
    if (canEdit()) {
      commit(redoEditorDocumentEdit(historyRef.current));
    }
  }, [canEdit, commit]);
  const markSaved = useCallback((identity: string, document: EditorDocument) => {
    // The query cache publishes the new source/path separately. Preserve history
    // only when that exact explicit save snapshot arrives, never on arbitrary IO.
    setPendingSave({
      history: historyRef.current,
      projectIdentity: identity,
      sourceSignature: editorDocumentSignature(document),
    });
  }, []);
  const reset = useCallback(() => {
    setPendingSave(null);
    setDraft(null);
  }, []);
  return {
    currentHistory,
    timelineDocument: currentHistory.present.timeline,
    updateTimelineDocument,
    undoTimeline,
    redoTimeline,
    markSaved,
    reset,
  };
}
