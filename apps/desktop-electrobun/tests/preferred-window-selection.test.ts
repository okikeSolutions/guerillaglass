import { describe, expect, test } from "bun:test";
import {
  pickPreferredWindowId,
  resolveSelectedWindowId,
} from "../src/mainview/app/studio/model/preferredWindowSelection";

describe("preferred window selection", () => {
  test("returns zero when no windows are available", () => {
    expect(pickPreferredWindowId([])).toBe(0);
    expect(resolveSelectedWindowId([], 55)).toBe(0);
  });

  test("prefers full-size windows over menu-band style windows", () => {
    const windows = [
      {
        id: 101,
        title: "",
        appName: "SystemUIServer",
        width: 1512,
        height: 24,
        isOnScreen: true,
      },
      {
        id: 202,
        title: "Untitled",
        appName: "TextEdit",
        width: 1280,
        height: 720,
        isOnScreen: true,
      },
    ];

    expect(pickPreferredWindowId(windows)).toBe(202);
  });

  test("keeps a valid explicit selection", () => {
    const windows = [
      {
        id: 11,
        title: "Window A",
        appName: "App",
        width: 900,
        height: 700,
        isOnScreen: true,
      },
      {
        id: 22,
        title: "Window B",
        appName: "App",
        width: 1200,
        height: 800,
        isOnScreen: true,
      },
    ];

    expect(resolveSelectedWindowId(windows, 11)).toBe(11);
  });

  test("falls back to the preferred window when selection is missing", () => {
    const windows = [
      {
        id: 33,
        title: "",
        appName: "App",
        width: 1200,
        height: 80,
        isOnScreen: true,
      },
      {
        id: 44,
        title: "Main",
        appName: "App",
        width: 1300,
        height: 900,
        isOnScreen: true,
      },
    ];

    expect(resolveSelectedWindowId(windows, 999)).toBe(44);
  });
});
