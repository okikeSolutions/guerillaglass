import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { sceneCameraSchema } from "../src/shared/valueObjects";
import { EditPlan } from "../src/domains/editPlan";

describe("external edit plan", () => {
  const plan = {
    version: 1,
    id: "demo",
    baseRevision: "a".repeat(64),
    sourceRevision: "b".repeat(64),
    timeline: {
      version: 2,
      items: [
        {
          kind: "clip",
          id: "result",
          sourceAssetId: "recording",
          sourceStartSeconds: 6,
          sourceEndSeconds: 7,
        },
        { kind: "gap", id: "pause", durationSeconds: 0.5 },
        {
          kind: "clip",
          id: "setup",
          sourceAssetId: "recording",
          sourceStartSeconds: 0,
          sourceEndSeconds: 1,
        },
      ],
    },
  };
  it("accepts arbitrary scene order without narrative beat labels", () => {
    expect(Schema.decodeUnknownSync(EditPlan)(plan).timeline.items).toHaveLength(3);
  });
  it("rejects unknown versions and invalid revision identities", () => {
    expect(() => Schema.decodeUnknownSync(EditPlan)({ ...plan, version: 2 })).toThrow();
    expect(() => Schema.decodeUnknownSync(EditPlan)({ ...plan, baseRevision: "latest" })).toThrow();
  });
});

it("rejects empty, unordered, and out-of-range scene camera curves", () => {
  const key = { timeSeconds: 1, centerX: 0.5, centerY: 0.5, zoom: 2 };
  for (const camera of [[], [key, key], [{ ...key, zoom: 9 }], [{ ...key, centerX: -1 }]]) {
    expect(() => Schema.decodeUnknownSync(sceneCameraSchema)(camera)).toThrow();
  }
});
