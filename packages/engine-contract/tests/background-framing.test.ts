import { describe, expect, it } from "vitest";
import { Schema } from "effect";
import { exportRunPayloadSchema, projectSavePayloadSchema } from "../src/httpApi";
import { projectStateSchema } from "../src/domains/project";
import {
  backgroundFramingSettingsSchema,
  defaultBackgroundFramingSettings,
} from "../src/shared/valueObjects";

const validSettings = {
  version: 1 as const,
  enabled: true,
  backgroundColor: "#a1b2c3",
  paddingFraction: 0.06,
  cornerRadiusFraction: 0.025,
  shadowStrength: 0.35,
};

const legacyProjectState = {
  autoZoom: {
    isEnabled: true,
    intensity: 1,
    minimumKeyframeInterval: 1 / 30,
  },
  timeline: { version: 2 as const, items: [] },
};

describe("background framing contract", () => {
  it("normalizes valid colors and encodes the complete v1 object", () => {
    const decoded = Schema.decodeUnknownSync(backgroundFramingSettingsSchema)(validSettings);
    expect(decoded).toEqual({ ...validSettings, backgroundColor: "#A1B2C3" });
    expect(Schema.encodeUnknownSync(backgroundFramingSettingsSchema)(decoded)).toEqual({
      ...validSettings,
      backgroundColor: "#A1B2C3",
    });
  });

  it("accepts every inclusive numeric boundary", () => {
    for (const settings of [
      { ...validSettings, paddingFraction: 0 },
      { ...validSettings, paddingFraction: 0.25 },
      { ...validSettings, cornerRadiusFraction: 0 },
      { ...validSettings, cornerRadiusFraction: 0.1 },
      { ...validSettings, shadowStrength: 0 },
      { ...validSettings, shadowStrength: 1 },
    ]) {
      expect(() =>
        Schema.decodeUnknownSync(backgroundFramingSettingsSchema)(settings),
      ).not.toThrow();
    }
  });

  it.each([
    ["invalid color", { ...validSettings, backgroundColor: "18181B" }],
    ["alpha color", { ...validSettings, backgroundColor: "#18181BFF" }],
    ["unsupported version", { ...validSettings, version: 2 }],
    ["negative padding", { ...validSettings, paddingFraction: -0.001 }],
    ["excess padding", { ...validSettings, paddingFraction: 0.251 }],
    ["negative radius", { ...validSettings, cornerRadiusFraction: -0.001 }],
    ["excess radius", { ...validSettings, cornerRadiusFraction: 0.101 }],
    ["negative shadow", { ...validSettings, shadowStrength: -0.001 }],
    ["excess shadow", { ...validSettings, shadowStrength: 1.001 }],
    ["NaN", { ...validSettings, paddingFraction: Number.NaN }],
    ["positive infinity", { ...validSettings, cornerRadiusFraction: Number.POSITIVE_INFINITY }],
    ["negative infinity", { ...validSettings, shadowStrength: Number.NEGATIVE_INFINITY }],
  ])("rejects %s", (_label, settings) => {
    expect(() => Schema.decodeUnknownSync(backgroundFramingSettingsSchema)(settings)).toThrow();
  });

  it("decodes and encodes the disabled compatibility defaults", () => {
    const decoded = Schema.decodeUnknownSync(backgroundFramingSettingsSchema)(
      defaultBackgroundFramingSettings,
    );
    expect(decoded).toEqual(defaultBackgroundFramingSettings);
    expect(Schema.encodeUnknownSync(backgroundFramingSettingsSchema)(decoded)).toEqual(
      defaultBackgroundFramingSettings,
    );
  });

  it("rejects malformed present project settings instead of partially defaulting", () => {
    expect(() =>
      Schema.decodeUnknownSync(projectStateSchema)({
        ...legacyProjectState,
        backgroundFraming: { enabled: true },
      }),
    ).toThrow();
  });

  it("accepts explicit normalized save and export payload settings", () => {
    const save = Schema.decodeUnknownSync(projectSavePayloadSchema)({
      backgroundFraming: validSettings,
    });
    const run = Schema.decodeUnknownSync(exportRunPayloadSchema)({
      outputURL: "/tmp/output.mp4",
      presetId: "h264-1080p-30",
      backgroundFraming: validSettings,
    });

    expect(save.backgroundFraming?.backgroundColor).toBe("#A1B2C3");
    expect(run.backgroundFraming?.backgroundColor).toBe("#A1B2C3");
  });

  it("keeps save and export payload fields optional for older clients", () => {
    expect(Schema.decodeUnknownSync(projectSavePayloadSchema)({})).toEqual({});
    expect(
      Schema.decodeUnknownSync(exportRunPayloadSchema)({
        outputURL: "/tmp/output.mp4",
        presetId: "h264-1080p-30",
      }).backgroundFraming,
    ).toBeUndefined();
  });
});
