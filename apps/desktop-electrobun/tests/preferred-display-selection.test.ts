import { describe, expect, test } from "vitest";
import {
  displaySourceSchema,
  type SourcesResult,
} from "@guerillaglass/engine-contract/domains/sources";
import { displayIdSchema } from "@guerillaglass/engine-contract/schema-primitives";
import {
  pickPreferredDisplayId,
  resolveSelectedDisplayId,
} from "@studio/domain/preferredDisplaySelection";

function makeDisplaySource(
  overrides: Omit<Partial<SourcesResult["displays"][number]>, "id"> & { id?: number },
): SourcesResult["displays"][number] {
  const { id = 0, ...rest } = overrides;
  return displaySourceSchema.make({
    id: displayIdSchema.make(id),
    displayName: "Display",
    isPrimary: false,
    width: 1920,
    height: 1080,
    pixelScale: 2,
    refreshHz: 60,
    supportedCaptureFrameRates: [24, 30, 60],
    ...rest,
  });
}

describe("preferred display selection", () => {
  test("returns zero when no displays are available", () => {
    expect(pickPreferredDisplayId([])).toBe(0);
    expect(resolveSelectedDisplayId([], 11)).toBe(0);
  });

  test("prefers the primary display when available", () => {
    const displays = [
      makeDisplaySource({ id: 22, displayName: "External", isPrimary: false }),
      makeDisplaySource({ id: 11, displayName: "Built-in", isPrimary: true }),
    ];

    expect(pickPreferredDisplayId(displays)).toBe(11);
  });

  test("keeps a valid explicit selection", () => {
    const displays = [
      makeDisplaySource({ id: 22, displayName: "External" }),
      makeDisplaySource({ id: 11, displayName: "Built-in", isPrimary: true }),
    ];

    expect(resolveSelectedDisplayId(displays, 22)).toBe(22);
  });

  test("falls back to the lowest display id when no display is primary", () => {
    const displays = [
      makeDisplaySource({ id: 44, displayName: "Display B" }),
      makeDisplaySource({ id: 33, displayName: "Display A" }),
    ];

    expect(resolveSelectedDisplayId(displays, 999)).toBe(33);
  });
});
