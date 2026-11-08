import { describe, expect, test } from "vitest";
import { Schema } from "effect";
import {
  EditStoryboard,
  EditRenderReview,
  compileStoryboard,
  describeSceneChanges,
} from "../src/domains/editWorkflow";

const raw = {
  version: 1,
  id: "demo",
  baseRevision: "a".repeat(64),
  sourceRevision: "b".repeat(64),
  brief: "Show the outcome, then setup.",
  scenes: [
    {
      title: "Outcome",
      purpose: "Lead with value",
      item: {
        kind: "clip",
        id: "result",
        sourceAssetId: "recording",
        sourceStartSeconds: 6,
        sourceEndSeconds: 7,
        camera: [{ timeSeconds: 6, centerX: 0.25, centerY: 0.5, zoom: 2 }],
      },
    },
    {
      title: "Pause",
      purpose: "Let it register",
      item: { kind: "gap", id: "pause", durationSeconds: 0.5 },
    },
  ],
};
const decode = Schema.decodeUnknownSync(EditStoryboard);
describe("external storyboard handoff", () => {
  test("compilation preserves source times, scene identities, revisions and cameras", () => {
    const storyboard = decode(raw);
    const plan = compileStoryboard(storyboard);
    expect(plan.timeline.items).toEqual(raw.scenes.map((scene) => scene.item));
    expect(plan.baseRevision).toBe(raw.baseRevision);
    expect(plan.sourceRevision).toBe(raw.sourceRevision);
    expect(plan.timeline.version).toBe(2);
  });
  test("rejects duplicate scene IDs and unversioned handoffs", () => {
    expect(() => decode({ ...raw, scenes: [raw.scenes[0], raw.scenes[0]] })).toThrow();
    expect(() => decode({ ...raw, version: 2 })).toThrow();
    expect(() => decode({ ...raw, scenes: [] })).toThrow();
  });
  test("differences distinguish removed, reordered and camera-edited scenes", () => {
    const plan = compileStoryboard(decode(raw));
    const changed = {
      ...plan.timeline,
      items: [
        plan.timeline.items[1]!,
        {
          ...plan.timeline.items[0]!,
          camera: [{ timeSeconds: 6, centerX: 0.75, centerY: 0.5, zoom: 2 }],
        },
      ],
    };
    const differences = describeSceneChanges(plan.timeline, changed);
    expect(differences.find((item) => item.id === "result")).toMatchObject({
      moved: true,
      modified: true,
      added: false,
    });
    expect(
      describeSceneChanges(plan.timeline, { version: 2, items: [plan.timeline.items[0]!] }).find(
        (item) => item.id === "pause",
      ),
    ).toMatchObject({ removed: true });
  });
  test("review approval and scene corrections have different completion criteria", () => {
    const review = {
      version: 1,
      revision: raw.baseRevision,
      summary: "Inspected full render",
      verdict: "approved",
      findings: [],
    };
    const decodeReview = Schema.decodeUnknownSync(EditRenderReview);
    expect(decodeReview(review).verdict).toBe("approved");
    expect(() => decodeReview({ ...review, verdict: "changes_requested" })).toThrow();
    expect(() =>
      decodeReview({ ...review, findings: [{ sceneId: "result", note: "Shorten it" }] }),
    ).toThrow();
    expect(
      decodeReview({
        ...review,
        verdict: "changes_requested",
        findings: [{ sceneId: "result", note: "Shorten it" }],
      }).findings,
    ).toHaveLength(1);
  });
});
