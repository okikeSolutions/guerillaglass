import { describe, expect, test } from "bun:test";
import { formatCaptureTargetLabelFromMetadata } from "../src/mainview/app/studio/model/captureTargetLabelFormatter";

const formatInteger = (value: number): string => String(Math.trunc(value));

describe("capture target label", () => {
  test("returns null when metadata is unavailable", () => {
    expect(
      formatCaptureTargetLabelFromMetadata({
        metadata: null,
        displayLabel: "Display",
        windowLabel: "Window",
        untitledLabel: "Untitled",
        formatInteger,
      }),
    ).toBeNull();
  });

  test("formats display metadata", () => {
    expect(
      formatCaptureTargetLabelFromMetadata({
        metadata: {
          source: "display",
          window: null,
          contentRect: { x: 0, y: 0, width: 3024, height: 1964 },
          pixelScale: 2,
        },
        displayLabel: "Display",
        windowLabel: "Window",
        untitledLabel: "Untitled",
        formatInteger,
      }),
    ).toBe("Display");
  });

  test("formats window metadata with identity and dimensions", () => {
    expect(
      formatCaptureTargetLabelFromMetadata({
        metadata: {
          source: "window",
          window: { id: 42, appName: "Xcode", title: "Simulator" },
          contentRect: { x: 0, y: 0, width: 1280, height: 720 },
          pixelScale: 2,
        },
        displayLabel: "Display",
        windowLabel: "Window",
        untitledLabel: "Untitled",
        formatInteger,
      }),
    ).toBe("Xcode - Simulator (1280x720)");
  });

  test("falls back to generic window label when identity is missing", () => {
    expect(
      formatCaptureTargetLabelFromMetadata({
        metadata: {
          source: "window",
          window: null,
          contentRect: { x: 0, y: 0, width: 800, height: 600 },
          pixelScale: 1,
        },
        displayLabel: "Display",
        windowLabel: "Window",
        untitledLabel: "Untitled",
        formatInteger,
      }),
    ).toBe("Window (800x600)");
  });
});
