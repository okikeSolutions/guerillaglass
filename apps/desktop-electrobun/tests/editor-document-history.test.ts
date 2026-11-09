import { isoDateTimeSchema } from "@guerillaglass/engine-contract/schema-primitives";
import { describe, expect, test } from "vitest";
import { defaultBackgroundFramingSettings } from "@guerillaglass/engine-contract/shared/valueObjects";
import { createSingleSegmentTimelineDocument } from "@studio/domain/timelineDomainModel";
import {
  editorDocumentSignature,
  createEditorDocumentHistory,
  recordEditorDocumentEdit,
  rebaseGeneratedTimeline,
  undoEditorDocumentEdit,
  redoEditorDocumentEdit,
  type EditorDocument,
} from "@studio/domain/editorDocumentHistory";
import { timelineContentSignature } from "@studio/domain/editorStateSignature";
import { resetTimelineClipCamera } from "@studio/domain/timelineCommands";

describe("complete editor document history", () => {
  test("interleaved visual and timeline edits restore every persisted field", () => {
    const original: EditorDocument = {
      timeline: createSingleSegmentTimelineDocument(8),
      autoZoom: { isEnabled: true, intensity: 1, minimumKeyframeInterval: 1 / 30 },
      backgroundFraming: defaultBackgroundFramingSettings,
    };
    const visual = {
      ...original,
      backgroundFraming: { ...original.backgroundFraming, enabled: true, paddingFraction: 0.15 },
    };
    const timeline = { ...visual, timeline: { ...visual.timeline, items: [] } };
    const camera = { ...timeline, autoZoom: { ...timeline.autoZoom, isEnabled: false } };
    const history = recordEditorDocumentEdit(
      recordEditorDocumentEdit(
        recordEditorDocumentEdit(createEditorDocumentHistory(original), visual),
        timeline,
      ),
      camera,
    );
    expect(undoEditorDocumentEdit(history).present).toEqual(timeline);
    expect(undoEditorDocumentEdit(undoEditorDocumentEdit(history)).present).toEqual(visual);
    expect(
      undoEditorDocumentEdit(undoEditorDocumentEdit(undoEditorDocumentEdit(history))).present,
    ).toEqual(original);
    expect(redoEditorDocumentEdit(undoEditorDocumentEdit(history)).present).toEqual(camera);
    const branched = recordEditorDocumentEdit(undoEditorDocumentEdit(history), {
      ...timeline,
      backgroundFraming: { ...timeline.backgroundFraming, backgroundColor: "#123456" },
    });
    expect(branched.future).toEqual([]);
  });
  test("reset removes explicit scene camera including static override and remains undoable", () => {
    const timeline = createSingleSegmentTimelineDocument(8);
    const item = timeline.items[0]!;
    if (item.kind !== "clip") {
      throw new Error("Expected clip");
    }
    const override = { ...timeline, items: [{ ...item, camera: [] }] };
    const reset = resetTimelineClipCamera(override, item.id);
    expect(reset.changed).toBe(true);
    expect(reset.timeline.items[0]).not.toHaveProperty("camera");
    expect(resetTimelineClipCamera(reset.timeline, item.id).changed).toBe(false);
  });
});

test("native timestamp/key ordering is not an edit and preserves visual redo", () => {
  const original: EditorDocument = {
    timeline: createSingleSegmentTimelineDocument(8),
    autoZoom: { isEnabled: true, intensity: 1, minimumKeyframeInterval: 1 / 30 },
    backgroundFraming: defaultBackgroundFramingSettings,
  };
  const visual = {
    ...original,
    backgroundFraming: { ...original.backgroundFraming, enabled: true },
  };
  const undone = undoEditorDocumentEdit(
    recordEditorDocumentEdit(createEditorDocumentHistory(original), visual),
  );
  const native = {
    backgroundFraming: original.backgroundFraming,
    autoZoom: { minimumKeyframeInterval: 1 / 30, intensity: 1, isEnabled: true },
    timeline: {
      ...original.timeline,
      updatedAt: isoDateTimeSchema.make("2026-11-09T00:00:00.000Z"),
    },
  };
  expect(editorDocumentSignature(native)).toBe(editorDocumentSignature(original));
  expect(recordEditorDocumentEdit(undone, native)).toBe(undone);
  expect(redoEditorDocumentEdit(undone).present).toEqual(visual);
});

test("camera ordering and absent versus empty overrides retain document identity", () => {
  const original: EditorDocument = {
    timeline: createSingleSegmentTimelineDocument(8),
    autoZoom: { isEnabled: true, intensity: 1, minimumKeyframeInterval: 1 / 30 },
    backgroundFraming: defaultBackgroundFramingSettings,
  };
  const item = original.timeline.items[0]!;
  if (item.kind !== "clip") {
    throw new Error("Expected clip");
  }
  const explicit = {
    ...original,
    timeline: { ...original.timeline, items: [{ ...item, camera: [] }] },
  };
  expect(editorDocumentSignature(explicit)).not.toBe(editorDocumentSignature(original));
  const keys = [
    { timeSeconds: 0, centerX: 0.5, centerY: 0.5, zoom: 1 },
    { timeSeconds: 1, centerX: 0.4, centerY: 0.5, zoom: 2 },
  ];
  const moving = {
    ...original,
    timeline: { ...original.timeline, items: [{ ...item, camera: keys }] },
  };
  const reversed = {
    ...original,
    timeline: { ...original.timeline, items: [{ ...item, camera: [...keys].reverse() }] },
  };
  expect(editorDocumentSignature(moving)).not.toBe(editorDocumentSignature(reversed));
});

test("history stays bounded and exhausted undo/redo preserve identity", () => {
  const original: EditorDocument = {
    timeline: createSingleSegmentTimelineDocument(8),
    autoZoom: { isEnabled: true, intensity: 1, minimumKeyframeInterval: 1 / 30 },
    backgroundFraming: defaultBackgroundFramingSettings,
  };
  let history = createEditorDocumentHistory(original);
  expect(undoEditorDocumentEdit(history)).toBe(history);
  expect(redoEditorDocumentEdit(history)).toBe(history);
  for (let index = 0; index < 150; index++) {
    history = recordEditorDocumentEdit(history, {
      ...original,
      autoZoom: { ...original.autoZoom, intensity: index / 150 },
    });
  }
  expect(history.past).toHaveLength(100);
});

test("generated duration refinement preserves cuts, visual edits and both history directions", () => {
  const original: EditorDocument = {
    timeline: createSingleSegmentTimelineDocument(8),
    autoZoom: { isEnabled: false, intensity: 1, minimumKeyframeInterval: 0.1 },
    backgroundFraming: defaultBackgroundFramingSettings,
  };
  const visual = {
    ...original,
    backgroundFraming: { ...original.backgroundFraming, enabled: true },
  };
  const edited = { ...visual, timeline: createSingleSegmentTimelineDocument(4) };
  const signature = timelineContentSignature(original.timeline);
  const history = recordEditorDocumentEdit(
    recordEditorDocumentEdit(createEditorDocumentHistory(original), visual),
    edited,
  );
  expect(rebaseGeneratedTimeline(history, signature, original.timeline)).toBe(history);
  const refined = rebaseGeneratedTimeline(
    history,
    signature,
    createSingleSegmentTimelineDocument(8.1),
  );
  expect(refined.present).toEqual(edited);
  expect(refined.past).toHaveLength(2);
  expect(undoEditorDocumentEdit(refined).present.timeline).toEqual(
    createSingleSegmentTimelineDocument(8.1),
  );
  expect(redoEditorDocumentEdit(undoEditorDocumentEdit(refined)).present).toEqual(edited);
  const undone = rebaseGeneratedTimeline(
    undoEditorDocumentEdit(history),
    signature,
    createSingleSegmentTimelineDocument(8.1),
  );
  expect(undone.present.autoZoom.isEnabled).toBe(false);
  expect(undone.future[0]).toEqual(edited);
  expect(undone.present.timeline).toEqual(createSingleSegmentTimelineDocument(8.1));
});
