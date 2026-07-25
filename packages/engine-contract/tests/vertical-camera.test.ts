import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { exportRunPayloadSchema } from "../src/httpApi";

const basePayload = {
  outputURL: "/tmp/vertical.mp4",
  presetId: "h264-vertical-1080p-30",
};

describe("vertical camera export contract", () => {
  it("accepts an optional per-export auto-zoom override", () => {
    const decoded = Schema.decodeUnknownSync(exportRunPayloadSchema)({
      ...basePayload,
      autoZoom: {
        isEnabled: true,
        intensity: 0.75,
        minimumKeyframeInterval: 1 / 30,
      },
    });

    expect(decoded.autoZoom).toEqual({
      isEnabled: true,
      intensity: 0.75,
      minimumKeyframeInterval: 1 / 30,
    });
  });

  it("keeps the override optional for older clients", () => {
    expect(Schema.decodeUnknownSync(exportRunPayloadSchema)(basePayload).autoZoom).toBeUndefined();
  });
});
