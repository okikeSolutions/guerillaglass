import { describe, expect, test } from "vitest";
import { Result } from "effect";
import { decodeStoryboardForReview } from "../src/mainview/app/studio/view-model/storyboardDiagnostic";

const storyboardDiagnostic = (text: string) => {
  const decoded = decodeStoryboardForReview(text);
  return Result.isFailure(decoded) ? decoded.failure : null;
};

const storyboard = {
  version: 1,
  id: "demo",
  baseRevision: "a".repeat(64),
  sourceRevision: "b".repeat(64),
  brief: "Show the result",
  scenes: [
    {
      title: "Result",
      purpose: "Show outcome",
      item: {
        kind: "clip",
        id: "one",
        sourceAssetId: "recording",
        sourceStartSeconds: 0,
        sourceEndSeconds: 1,
      },
    },
  ],
};

describe("actionable storyboard diagnostics", () => {
  test("valid source remains accepted", () =>
    expect(storyboardDiagnostic(JSON.stringify(storyboard))).toBeNull());
  test("JSON syntax and unsupported version have different recovery", () => {
    expect(storyboardDiagnostic("{")).toEqual({ kind: "json" });
    expect(storyboardDiagnostic(JSON.stringify({ ...storyboard, version: 2 }))).toEqual({
      kind: "version",
    });
  });
  test("missing required field identifies its schema path", () => {
    expect(storyboardDiagnostic("{}")).toEqual({ kind: "missing", field: "version" });
    expect(
      storyboardDiagnostic(
        JSON.stringify({ ...storyboard, scenes: [{ ...storyboard.scenes[0], title: undefined }] }),
      ),
    ).toEqual({ kind: "missing", field: "scenes.0.title" });
  });
  test("duplicate IDs identify both scene positions", () => {
    expect(
      storyboardDiagnostic(
        JSON.stringify({ ...storyboard, scenes: [...storyboard.scenes, ...storyboard.scenes] }),
      ),
    ).toEqual({ kind: "duplicate", scene: 2, previous: 1 });
  });
  test("invalid scene values retain a field reference without raw input", () => {
    const diagnostic = storyboardDiagnostic(
      JSON.stringify({
        ...storyboard,
        scenes: [
          {
            ...storyboard.scenes[0],
            item: { ...storyboard.scenes[0]?.item, sourceStartSeconds: -1 },
          },
        ],
      }),
    );
    expect(diagnostic?.kind).toBe("value");
    expect(diagnostic).toHaveProperty("field", "scenes.0.item.sourceStartSeconds");
  });
});
