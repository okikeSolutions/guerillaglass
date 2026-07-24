import { describe, expect, it } from "vitest";
import {
  computeBackgroundFramingGeometry,
  type RenderSize,
} from "../src/mainview/app/studio/domain/backgroundFramingGeometry";
import {
  defaultBackgroundFramingSettings,
  type BackgroundFramingSettings,
} from "@guerillaglass/engine-contract/shared/valueObjects";

const enabledSettings: BackgroundFramingSettings = {
  ...defaultBackgroundFramingSettings,
  enabled: true,
};

function geometry(outputSize: RenderSize, sourceSize: RenderSize = { width: 1920, height: 1080 }) {
  const result = computeBackgroundFramingGeometry(outputSize, sourceSize, enabledSettings);
  expect(result).not.toBeNull();
  return result!;
}

describe("background framing geometry", () => {
  it("matches the v1 landscape geometry vector", () => {
    const result = geometry({ width: 1920, height: 1080 });

    expect(result.cardRect.x).toBeCloseTo(115.2, 8);
    expect(result.cardRect.y).toBeCloseTo(64.8, 8);
    expect(result.cardRect.width).toBeCloseTo(1689.6, 8);
    expect(result.cardRect.height).toBeCloseTo(950.4, 8);
    expect(result.cornerRadius).toBeCloseTo(23.76, 8);
    expect(result.shadowOpacity).toBeCloseTo(0.105, 8);
    expect(result.shadowBlurRadius).toBeCloseTo(13.23, 8);
    expect(result.shadowOffsetY).toBeCloseTo(4.536, 8);
  });

  it("aspect fits landscape content into a vertical output without cropping", () => {
    const result = geometry({ width: 1080, height: 1920 });

    expect(result.cardRect.x).toBeCloseTo(64.8, 8);
    expect(result.cardRect.y).toBeCloseTo(692.7, 8);
    expect(result.cardRect.width).toBeCloseTo(950.4, 8);
    expect(result.cardRect.height).toBeCloseTo(534.6, 8);
    expect(result.cardRect.width / result.cardRect.height).toBeCloseTo(16 / 9, 8);
  });

  it("keeps the legacy full-frame fit while disabled", () => {
    const result = computeBackgroundFramingGeometry(
      { width: 1920, height: 1080 },
      { width: 1920, height: 1080 },
      defaultBackgroundFramingSettings,
    );

    expect(result?.cardRect).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
    expect(result?.cornerRadius).toBe(0);
    expect(result?.shadowOpacity).toBe(0);
  });

  it("rejects empty and non-finite render dimensions", () => {
    expect(
      computeBackgroundFramingGeometry(
        { width: 0, height: 1080 },
        { width: 1920, height: 1080 },
        enabledSettings,
      ),
    ).toBeNull();
    expect(
      computeBackgroundFramingGeometry(
        { width: 1920, height: 1080 },
        { width: Number.POSITIVE_INFINITY, height: 1080 },
        enabledSettings,
      ),
    ).toBeNull();
  });
});
