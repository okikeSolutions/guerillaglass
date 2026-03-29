import { describe, expect, test } from "bun:test";
import type { SourcesResult } from "@guerillaglass/engine-protocol";
import {
  pickPreferredWindowId,
  resolveSelectedWindowId,
} from "@studio/domain/preferredWindowSelection";

function makeWindowSource(
  overrides: Partial<SourcesResult["windows"][number]>,
): SourcesResult["windows"][number] {
  return {
    id: 0,
    title: "",
    appName: "App",
    width: 1280,
    height: 720,
    isOnScreen: true,
    refreshHz: 60,
    supportedCaptureFrameRates: [24, 30, 60],
    ...overrides,
  };
}

describe("preferred window selection", () => {
  test("returns zero when no windows are available", () => {
    expect(pickPreferredWindowId([])).toBe(0);
    expect(resolveSelectedWindowId([], 55)).toBe(0);
  });

  test("prefers full-size windows over menu-band style windows", () => {
    const windows = [
      makeWindowSource({
        id: 101,
        title: "",
        appName: "SystemUIServer",
        width: 1512,
        height: 24,
      }),
      makeWindowSource({
        id: 202,
        title: "Untitled",
        appName: "TextEdit",
        width: 1280,
        height: 720,
      }),
    ];

    expect(pickPreferredWindowId(windows)).toBe(202);
  });

  test("keeps a valid explicit selection", () => {
    const windows = [
      makeWindowSource({
        id: 11,
        title: "Window A",
        width: 900,
        height: 700,
      }),
      makeWindowSource({
        id: 22,
        title: "Window B",
        width: 1200,
        height: 800,
      }),
    ];

    expect(resolveSelectedWindowId(windows, 11)).toBe(11);
  });

  test("falls back to the preferred window when selection is missing", () => {
    const windows = [
      makeWindowSource({
        id: 33,
        title: "",
        width: 1200,
        height: 80,
      }),
      makeWindowSource({
        id: 44,
        title: "Main",
        width: 1300,
        height: 900,
      }),
    ];

    expect(resolveSelectedWindowId(windows, 999)).toBe(44);
  });
});
